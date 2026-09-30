import React, { useCallback, useEffect, useReducer, useRef } from "react";
import { BackHandler, Platform, StatusBar, StyleSheet, Text, ToastAndroid, View } from "react-native";
import type { WebView as WebViewType } from "react-native-webview";
import type { WebViewMessageEvent, WebViewNavigation } from "react-native-webview";
import * as SplashScreen from "expo-splash-screen";

import { COLORS, STALL_TIMEOUT_MS } from "./constants/theme";
import { DateLogModal } from "./components/DateLogModal";
import { appReducer, initialState } from "./reducers/appReducer";
import { Dashboard } from "./views/Dashboard";
import { OverlayScreens } from "./views/OverlayScreens";
import { WebViewScraper, isPortalHost } from "./views/WebViewScraper";

import {
  autoSubmitFirstSemesterScript,
  parseDetailedAttendanceAndGoHomeScript,
  selectSubjectByIndexScript,
} from "./utils/automationScripts";
import type { SubjectAttendanceData } from "./utils/automationScripts";
import { parseBridgeMessage } from "./utils/bridgeValidator";
import { loadPreviousResult, savePreviousResult } from "./utils/storage";
import type { PreviousAttendanceResult } from "./utils/storage";
import { shouldCheckOnMount, useUpdateManager } from "./utils/updateManager";

export default function App() {
  const splashPreventedRef = useRef(false);
  if (!splashPreventedRef.current) {
    splashPreventedRef.current = true;
    void SplashScreen.preventAutoHideAsync();
  }

  const webViewRef = useRef<WebViewType>(null);
  const [state, dispatch] = useReducer(appReducer, initialState);
  const update = useUpdateManager();
  const { checkForUpdate } = update;

  const {
    webViewKey, isLoggedIn, studentInfo, totalSubjects, fetchedIndices,
    subjectsData, isScrapingFinished, selectedSubject,
    hasPreviousResult, previousResult, isSelectionError, isStructureError,
    structureErrorMessage, isOffline, isSplashDismissed, gatewayError,
  } = state;

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; });
  const lastActivityRef = useRef<number>(Date.now());
  const lastInjectedUrlRef = useRef<string | null>(null);
  const persistedSigRef = useRef<string | null>(null);
  const backPressTimeRef = useRef<number>(0);

  const handleFullReset = useCallback(() => {
    lastInjectedUrlRef.current = null;
    lastActivityRef.current = Date.now();
    dispatch({ type: "RESET" });
  }, []);
  const handleCloseModal = useCallback(() => dispatch({ type: "SET_SELECTED_SUBJECT", data: null }), []);
  const handleSelectSubject = useCallback((item: SubjectAttendanceData) => {
    dispatch({ type: "SET_SELECTED_SUBJECT", data: item });
  }, []);
  const handlePreviousAttendance = useCallback(() => {
    if (previousResult) dispatch({ type: "HYDRATE_PREVIOUS_RESULT", data: previousResult });
  }, [previousResult]);
  const handleRefreshRequest = useCallback(() => {
    // Manual reload mid-scrape would corrupt index tracking; reset first.
    lastInjectedUrlRef.current = null;
    lastActivityRef.current = Date.now();
  }, []);

  const handleNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    const { url, loading } = navState;
    const snapshot = stateRef.current;
    if (!isPortalHost(url)) return;
    if (snapshot.isSelectionError || snapshot.isStructureError || snapshot.gatewayError) return;
    const shouldInject = !loading && !snapshot.isScrapingFinished;
    if (!shouldInject) return;
    const injectKey = `${url}|${snapshot.isLoggedIn}|${snapshot.currentIndex}`;
    if (lastInjectedUrlRef.current === injectKey) return;
    lastInjectedUrlRef.current = injectKey;
    lastActivityRef.current = Date.now();

    if (url.includes("studenthome.php")) {
      if (!snapshot.isLoggedIn) dispatch({ type: "SET_LOGGED_IN" });
      webViewRef.current?.injectJavaScript(autoSubmitFirstSemesterScript);
    } else if (url.includes("studentsubjects.php")) {
      webViewRef.current?.injectJavaScript(selectSubjectByIndexScript(snapshot.currentIndex));
    } else if (url.includes("studentsubatt.php")) {
      webViewRef.current?.injectJavaScript(parseDetailedAttendanceAndGoHomeScript);
    }
  }, []);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    const payload = parseBridgeMessage(event.nativeEvent.data);
    if (!payload) {
      if (__DEV__) console.warn("WebView message ignored: invalid payload.");
      return;
    }
    lastActivityRef.current = Date.now();
    switch (payload.type) {
      case "STUDENT_INFO": dispatch({ type: "SET_STUDENT_INFO", data: payload.data }); break;
      case "SUBJECT_COUNT": dispatch({ type: "SET_SUBJECT_COUNT", count: payload.count }); break;
      case "ATTENDANCE_ITEM": dispatch({ type: "ADD_ATTENDANCE_ITEM", data: payload.data }); break;
      case "SUBJECT_SKIPPED": dispatch({ type: "ADVANCE_INDEX" }); break;
      case "SCRAPE_ERROR": dispatch({ type: "SET_STRUCTURE_ERROR", message: payload.message }); break;
      case "STRUCTURE_CHANGED": dispatch({ type: "SET_STRUCTURE_ERROR" }); break;
      case "SCRAPING_COMPLETE": dispatch({ type: "SET_SCRAPING_FINISHED" }); break;
    }
  }, []);

  /* Stall detection: logged in but no bridge activity within timeout. */
  useEffect(() => {
    if (!isLoggedIn || isScrapingFinished || isSelectionError || isStructureError || isOffline) return;
    const interval = setInterval(() => {
      if (Date.now() - lastActivityRef.current > STALL_TIMEOUT_MS) {
        dispatch({ type: "SET_SELECTION_ERROR" });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isLoggedIn, isScrapingFinished, isSelectionError, isStructureError, isOffline]);

  /* Android back: modal -> dashboard home -> selection error -> double-tap exit. */
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const onBackPress = (): boolean => {
      const snapshot = stateRef.current;
      if (snapshot.selectedSubject) {
        dispatch({ type: "SET_SELECTED_SUBJECT", data: null });
        return true;
      }
      if (snapshot.isScrapingFinished && snapshot.isLoggedIn) {
        lastInjectedUrlRef.current = null;
        dispatch({ type: "RESET" });
        return true;
      }
      if (snapshot.isSelectionError) {
        dispatch({ type: "CLEAR_SELECTION_ERROR" });
        return true;
      }
      const now = Date.now();
      if (now - backPressTimeRef.current < 2000) {
        BackHandler.exitApp();
        return true;
      }
      backPressTimeRef.current = now;
      ToastAndroid.show("Press back again to exit", ToastAndroid.SHORT);
      return true;
    };
    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => subscription.remove();
  }, []);

  /* Defer OTA update check until after the initial portal load is ready */
  useEffect(() => {
    if (isSplashDismissed && shouldCheckOnMount()) void checkForUpdate();
  }, [isSplashDismissed, checkForUpdate]);

  /* Persist latest result */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await loadPreviousResult();
      if (!cancelled) dispatch({ type: "SET_PREVIOUS_RESULT", result });
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!(isScrapingFinished && isLoggedIn && studentInfo && subjectsData.length > 0)) return;
    const overallClasses = subjectsData.reduce((acc, x) => acc + x.total, 0);
    const overallPresent = subjectsData.reduce((acc, x) => acc + x.present, 0);
    const overallAbsent = subjectsData.reduce((acc, x) => acc + x.absent, 0);
    const sig = `${studentInfo.name}|${subjectsData.length}|${overallClasses}|${overallPresent}|${overallAbsent}`;
    if (persistedSigRef.current === sig) return;
    persistedSigRef.current = sig;
    const latestResult: PreviousAttendanceResult = { studentInfo, subjectsData };
    void savePreviousResult(latestResult);
    dispatch({ type: "SET_PREVIOUS_RESULT", result: latestResult });
  }, [isScrapingFinished, isLoggedIn, studentInfo, subjectsData]);

  const syncPct = totalSubjects ? Math.round((fetchedIndices.length / totalSubjects) * 100) : 0;

  const handleLoadStart = useCallback(() => {
    dispatch({ type: "SET_OFFLINE", status: false });
    if (stateRef.current.gatewayError) dispatch({ type: "CLEAR_GATEWAY_ERROR" });
    if (!stateRef.current.isSplashDismissed) {
      dispatch({ type: "SET_SPLASH_DISMISSED" });
      void SplashScreen.hideAsync();
    }
  }, []);

  const handleWebViewError = useCallback(() => {
    dispatch({ type: "SET_OFFLINE", status: true });
  }, []);

  const handleWebViewHttpError = useCallback((event: { nativeEvent: { statusCode: number } }) => {
    if (event.nativeEvent.statusCode === 502) dispatch({ type: "SET_GATEWAY_ERROR" });
  }, []);

  const handleClearSelectionError = useCallback(() => {
    dispatch({ type: "CLEAR_SELECTION_ERROR" });
  }, []);

  return (
    <View style={styles.container}>
      {(update.status === "checking" || update.status === "applying") && (
        <View style={styles.updateBanner} pointerEvents="none">
          <Text style={styles.updateBannerText}>
            {update.status === "applying" ? "Applying update…" : "Checking for updates…"}
          </Text>
        </View>
      )}

      <WebViewScraper
        webViewRef={webViewRef}
        webViewKey={webViewKey}
        isScrapingFinished={isScrapingFinished}
        isLoggedIn={isLoggedIn}
        isScrapingActive={isLoggedIn && !isScrapingFinished}
        hasPreviousResult={hasPreviousResult}
        onLoadStart={handleLoadStart}
        onNavigationStateChange={handleNavigationStateChange}
        onMessage={handleMessage}
        onError={handleWebViewError}
        onHttpError={handleWebViewHttpError}
        onPreviousAttendance={handlePreviousAttendance}
        onRefreshRequest={handleRefreshRequest}
      />

      <OverlayScreens
        gatewayError={gatewayError}
        isOffline={isOffline}
        isStructureError={isStructureError}
        structureErrorMessage={structureErrorMessage}
        isLoggedIn={isLoggedIn}
        isScrapingFinished={isScrapingFinished}
        isSelectionError={isSelectionError}
        totalSubjects={totalSubjects}
        fetchedIndicesCount={fetchedIndices.length}
        syncPct={syncPct}
        onFullReset={handleFullReset}
        onClearSelectionError={handleClearSelectionError}
      />

      {isLoggedIn && isScrapingFinished && (
        <Dashboard
          studentInfo={studentInfo}
          subjectsData={subjectsData}
          onSelectSubject={handleSelectSubject}
          onFullReset={handleFullReset}
        />
      )}

      <DateLogModal
        selectedSubject={selectedSubject}
        onClose={handleCloseModal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.canvas,
    paddingTop: StatusBar.currentHeight ?? 40,
  },
  updateBanner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: COLORS.surfaceCard,
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
  },
  updateBannerText: { fontSize: 12, fontWeight: "600", color: COLORS.primaryActive, letterSpacing: 0.3 },
});