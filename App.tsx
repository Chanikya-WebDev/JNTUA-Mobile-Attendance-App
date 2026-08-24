import React, { useCallback, useEffect, useReducer, useRef } from "react";
import { BackHandler, Platform, StyleSheet, Text, ToastAndroid, View } from "react-native";
import type { WebView as WebViewType } from "react-native-webview";
import { WebViewMessageEvent, WebViewNavigation } from "react-native-webview";
import * as SplashScreen from "expo-splash-screen";

import { COLORS } from "./constants/theme";
import { DateLogModal } from "./components/DateLogModal";
import { appReducer, initialState } from "./reducers/appReducer";
import { Dashboard } from "./views/Dashboard";
import { OverlayScreens } from "./views/OverlayScreens";
import { WebViewScraper } from "./views/WebViewScraper";

import {
  autoSubmitFirstSemesterScript,
  parseDetailedAttendanceAndGoHomeScript,
  selectSubjectByIndexScript,
  StudentInfo,
  SubjectAttendanceData,
} from "./utils/automationScripts";
import { loadPreviousResult, PreviousAttendanceResult, savePreviousResult } from "./utils/storage";
import { shouldCheckOnMount, useUpdateManager } from "./utils/updateManager";

const STALL_TIMEOUT_MS = 25000;

type MessagePayload =
  | { type: "STUDENT_INFO"; data: StudentInfo }
  | { type: "SUBJECT_COUNT"; count: number }
  | { type: "ATTENDANCE_ITEM"; data: SubjectAttendanceData }
  | { type: "STRUCTURE_CHANGED" }
  | { type: "SCRAPING_COMPLETE" };

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
    isOffline, isSplashDismissed, gatewayError,
  } = state;

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; });
  const lastActivityRef = useRef<number>(Date.now());
  const persistedSigRef = useRef<string | null>(null);

  const handleFullReset = useCallback(() => dispatch({ type: "RESET" }), []);
  const handleCloseModal = useCallback(() => dispatch({ type: "SET_SELECTED_SUBJECT", data: null }), []);
  const handlePreviousAttendance = useCallback(() => {
    if (previousResult) dispatch({ type: "HYDRATE_PREVIOUS_RESULT", data: previousResult });
  }, [previousResult]);

  const handleNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    const { url, loading } = navState;
    const { isLoggedIn: loggedIn, isScrapingFinished: scrapingFinished, currentIndex } = stateRef.current;
    const shouldInject = !loading && !scrapingFinished;

    if (url.includes("studenthome.php")) {
      if (!loggedIn) dispatch({ type: "SET_LOGGED_IN" });
      if (shouldInject) webViewRef.current?.injectJavaScript(autoSubmitFirstSemesterScript);
    } else if (url.includes("studentsubjects.php") && shouldInject) {
      webViewRef.current?.injectJavaScript(selectSubjectByIndexScript(currentIndex));
    } else if (url.includes("studentsubatt.php") && shouldInject) {
      webViewRef.current?.injectJavaScript(parseDetailedAttendanceAndGoHomeScript);
    }
  }, []);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data) as MessagePayload;
      lastActivityRef.current = Date.now();
      switch (payload.type) {
        case "STUDENT_INFO": dispatch({ type: "SET_STUDENT_INFO", data: payload.data }); break;
        case "SUBJECT_COUNT": dispatch({ type: "SET_SUBJECT_COUNT", count: payload.count }); break;
        case "ATTENDANCE_ITEM": dispatch({ type: "ADD_ATTENDANCE_ITEM", data: payload.data }); break;
        case "STRUCTURE_CHANGED": dispatch({ type: "SET_STRUCTURE_ERROR" }); break;
        case "SCRAPING_COMPLETE": dispatch({ type: "SET_SCRAPING_FINISHED" }); break;
      }
    } catch (err) {
      console.warn("WebView Message Error:", err);
    }
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
    const sig = `${studentInfo.name}|${subjectsData.length}|${overallClasses}|${overallPresent}`;
    if (persistedSigRef.current === sig) return;
    persistedSigRef.current = sig;
    const latestResult: PreviousAttendanceResult = { studentInfo, subjectsData };
    void savePreviousResult(latestResult);
    dispatch({ type: "SET_PREVIOUS_RESULT", result: latestResult });
  }, [isScrapingFinished, isLoggedIn, studentInfo, subjectsData]);

  const syncPct = totalSubjects ? Math.round((fetchedIndices.length / totalSubjects) * 100) : 0;

  return (
    <View style={styles.container}>
      {(update.status === "checking" || update.status === "applying") && (
        <View style={styles.updateBanner}>
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
        hasPreviousResult={hasPreviousResult}
        onLoadStart={() => {
          dispatch({ type: "SET_OFFLINE", status: false });
          if (stateRef.current.gatewayError) dispatch({ type: "CLEAR_GATEWAY_ERROR" });
          if (!stateRef.current.isSplashDismissed) {
            dispatch({ type: "SET_SPLASH_DISMISSED" });
            void SplashScreen.hideAsync();
          }
        }}
        onNavigationStateChange={handleNavigationStateChange}
        onMessage={handleMessage}
        onError={() => dispatch({ type: "SET_OFFLINE", status: true })}
        onHttpError={(event) => {
          if (event.nativeEvent.statusCode === 502) dispatch({ type: "SET_GATEWAY_ERROR" });
        }}
        onPreviousAttendance={handlePreviousAttendance}
      />

      <OverlayScreens
        gatewayError={gatewayError}
        isOffline={isOffline}
        isStructureError={isStructureError}
        isLoggedIn={isLoggedIn}
        isScrapingFinished={isScrapingFinished}
        isSelectionError={isSelectionError}
        totalSubjects={totalSubjects}
        fetchedIndicesCount={fetchedIndices.length}
        syncPct={syncPct}
        onFullReset={handleFullReset}
        onClearSelectionError={() => dispatch({ type: "CLEAR_SELECTION_ERROR" })}
      />

      {isLoggedIn && isScrapingFinished && (
        <Dashboard
          studentInfo={studentInfo}
          subjectsData={subjectsData}
          onSelectSubject={(item) => dispatch({ type: "SET_SELECTED_SUBJECT", data: item })}
          onFullReset={handleFullReset}
          isRefreshing={false}
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
  container: { flex: 1, backgroundColor: COLORS.canvas, paddingTop: 40 },
  updateBanner: {
    backgroundColor: COLORS.surfaceCard,
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
  },
  updateBannerText: { fontSize: 12, fontWeight: "600", color: COLORS.primaryActive, letterSpacing: 0.3 },
});