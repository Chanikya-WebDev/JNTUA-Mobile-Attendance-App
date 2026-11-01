import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  FlatList,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useAnimatedValue,
  View,
} from "react-native";
import type { WebView as WebViewType } from "react-native-webview";
import { WebView, WebViewMessageEvent, WebViewNavigation } from "react-native-webview";
import {
  getPortalPageScript,
  AttendanceRecord,
  StudentInfo,
  SubjectAttendanceData,
} from "./utils/automationScripts";
import {
  PreviousAttendanceResult,
  loadPreviousResult,
  savePreviousResult,
} from "./utils/storage";
import { shouldCheckOnMount, useUpdateManager } from "./utils/updateManager";

/* ------------------------------------------------------------------ */
/*  Claude editorial palette                                           */
/* ------------------------------------------------------------------ */
const COLORS = {
  canvas: "#faf9f5",
  surfaceCard: "#efe9de",
  creamStrong: "#e8e0d2",
  surfaceDark: "#181715",
  primary: "#cc785c",
  primaryActive: "#a9583e",
  ink: "#141413",
  body: "#3d3d3a",
  muted: "#6c6a64",
  mutedSoft: "#8e8b82",
  hairline: "#e6dfd8",
  hairlineSoft: "#ebe6df",
  onDark: "#faf9f5",
  onDarkSoft: "#a09d96",
  success: "#3e8a52",
  live: "#5db872",
  error: "#c64545",
  amber: "#e8a55a",
  overlay: "rgba(20, 20, 19, 0.58)",
};

const SERIF = Platform.OS === "ios" ? "Georgia" : "serif";
const GITHUB_URL = "https://github.com/Chanikya-WebDev/JNTUA-Mobile-Attendance-App";
const STALL_TIMEOUT_MS = 30000;

const STATUS_COLOR: Record<AttendanceRecord["status"], string> = {
  Present: COLORS.success,
  Absent: COLORS.error,
  Unknown: COLORS.muted,
};

/* ------------------------------------------------------------------ */
/*  Small building blocks                                              */
/* ------------------------------------------------------------------ */
function Spike({ size = 13, color = COLORS.primary }: { size?: number; color?: string }) {
  return (
    <View style={{ width: size, height: size }}>
      {[0, 45, 90, 135].map((a) => (
        <View
          key={a}
          style={{
            position: "absolute",
            left: size / 2 - 1.5,
            top: 0,
            width: 3,
            height: size,
            borderRadius: 2,
            backgroundColor: color,
            transform: [{ rotate: `${a}deg` }],
          }}
        />
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  State — unchanged workflow                                         */
/* ------------------------------------------------------------------ */
interface AppState {
  webViewKey: number;
  isLoggedIn: boolean;
  studentInfo: StudentInfo | null;
  currentIndex: number;
  totalSubjects: number | null;
  fetchedIndices: number[];
  subjectsData: SubjectAttendanceData[];
  isScrapingFinished: boolean;
  selectedSubject: SubjectAttendanceData | null;
  hasPreviousResult: boolean;
  previousResult: PreviousAttendanceResult | null;
  selectionError: string | null;
}

const initialState: AppState = {
  webViewKey: 0,
  isLoggedIn: false,
  studentInfo: null,
  currentIndex: 0,
  totalSubjects: null,
  fetchedIndices: [],
  subjectsData: [],
  isScrapingFinished: false,
  selectedSubject: null,
  hasPreviousResult: false,
  previousResult: null,
  selectionError: null,
};

function preserveSession(state: AppState, webViewKeyDelta: number): AppState {
  return {
    ...initialState,
    webViewKey: state.webViewKey + webViewKeyDelta,
    hasPreviousResult: state.hasPreviousResult,
    previousResult: state.previousResult,
  };
}

type AppAction =
  | { type: "RESET" }
  | { type: "SET_LOGGED_IN" }
  | { type: "SET_STUDENT_INFO"; data: StudentInfo }
  | { type: "SET_SUBJECT_COUNT"; count: number }
  | { type: "ADD_ATTENDANCE_ITEM"; index: number; data: SubjectAttendanceData }
  | { type: "SET_SCRAPING_FINISHED" }
  | { type: "SET_SELECTED_SUBJECT"; data: SubjectAttendanceData | null }
  | { type: "SET_PREVIOUS_RESULT"; result: PreviousAttendanceResult | null }
  | { type: "HYDRATE_PREVIOUS_RESULT"; data: PreviousAttendanceResult }
  | { type: "SET_SELECTION_ERROR"; message: string }
  | { type: "CLEAR_SELECTION_ERROR" };

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "RESET":
      return preserveSession(state, 1);
    case "SET_LOGGED_IN":
      return { ...state, isLoggedIn: true };
    case "SET_STUDENT_INFO":
      return { ...state, studentInfo: action.data };
    case "SET_SUBJECT_COUNT":
      return { ...state, totalSubjects: action.count };
    case "ADD_ATTENDANCE_ITEM": {
      if (action.index !== state.currentIndex || state.fetchedIndices.includes(action.index)) return state;
      const nextIndex = state.currentIndex + 1;
      const finished = state.totalSubjects !== null && nextIndex >= state.totalSubjects;
      return {
        ...state,
        fetchedIndices: [...state.fetchedIndices, state.currentIndex],
        subjectsData: [...state.subjectsData, action.data],
        currentIndex: finished ? state.currentIndex : nextIndex,
        isScrapingFinished: finished ? true : state.isScrapingFinished,
      };
    }
    case "SET_SCRAPING_FINISHED":
      return { ...state, isScrapingFinished: true };
    case "SET_SELECTION_ERROR":
      return { ...state, selectionError: action.message };
    case "CLEAR_SELECTION_ERROR":
      return preserveSession(state, 0);
    case "SET_SELECTED_SUBJECT":
      return { ...state, selectedSubject: action.data };
    case "SET_PREVIOUS_RESULT":
      return { ...state, previousResult: action.result, hasPreviousResult: action.result !== null };
    case "HYDRATE_PREVIOUS_RESULT":
      return {
        ...state,
        isLoggedIn: true,
        isScrapingFinished: true,
        studentInfo: action.data.studentInfo,
        subjectsData: action.data.subjectsData,
        currentIndex: 0,
        totalSubjects: action.data.subjectsData.length,
        fetchedIndices: action.data.subjectsData.map((_, i) => i),
      };
    default:
      return state;
  }
}

type MessagePayload =
  | { type: "SCRAPING_STARTED"; stage: "home" | "subjects" | "attendance" }
  | { type: "STUDENT_INFO"; data: StudentInfo }
  | { type: "SUBJECT_COUNT"; count: number }
  | { type: "ATTENDANCE_ITEM"; index: number; data: SubjectAttendanceData }
  | { type: "SCRAPING_COMPLETE" }
  | { type: "SCRAPING_DIAGNOSTIC"; data: unknown }
  | { type: "SCRAPING_ERROR"; message: string };

export default function Index() {
  const webViewRef = useRef<WebViewType>(null);
  const [state, dispatch] = useReducer(appReducer, initialState);
  const update = useUpdateManager();
  const { checkForUpdate } = update;

  useEffect(() => {
    if (shouldCheckOnMount()) void checkForUpdate();
  }, [checkForUpdate]);

  const {
    webViewKey, isLoggedIn, studentInfo, totalSubjects, fetchedIndices,
    subjectsData, isScrapingFinished, selectedSubject,
    hasPreviousResult, previousResult, selectionError,
  } = state;

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; });
  const lastActivityRef = useRef<number>(0);
  const scraperStageRef = useRef<"home" | "subjects" | "attendance" | null>(null);
  const persistedSigRef = useRef<string | null>(null);

  const handleFullReset = useCallback(() => {
    scraperStageRef.current = null;
    dispatch({ type: "RESET" });
  }, []);
  const handlePreviousAttendance = useCallback(() => {
    if (previousResult) dispatch({ type: "HYDRATE_PREVIOUS_RESULT", data: previousResult });
  }, [previousResult]);

  const handleNavigationStateChange = useCallback((navState: Pick<WebViewNavigation, "url" | "loading">) => {
    const { url, loading } = navState;
    const { isLoggedIn: loggedIn, isScrapingFinished: scrapingFinished, currentIndex } = stateRef.current;
    if (/\/(studenthome|studentsubjects|studentsubjectatt|studentcourseatt|studentsubatt)\.php(?:[?#]|$)/i.test(url)) {
      if (!loggedIn) dispatch({ type: "SET_LOGGED_IN" });
      if (!loading && !scrapingFinished) webViewRef.current?.injectJavaScript(getPortalPageScript(currentIndex));
    }
  }, []);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data) as MessagePayload;
      lastActivityRef.current = Date.now();
      switch (payload.type) {
        case "SCRAPING_STARTED":
          scraperStageRef.current = payload.stage;
          dispatch({ type: "SET_LOGGED_IN" });
          if (__DEV__) console.info("Attendance fetching started:", payload.stage);
          break;
        case "STUDENT_INFO": dispatch({ type: "SET_STUDENT_INFO", data: payload.data }); break;
        case "SUBJECT_COUNT":
          if (__DEV__) console.info("Attendance subjects found:", payload.count);
          dispatch({ type: "SET_SUBJECT_COUNT", count: payload.count });
          break;
        case "ATTENDANCE_ITEM": dispatch({ type: "ADD_ATTENDANCE_ITEM", index: payload.index, data: payload.data }); break;
        case "SCRAPING_COMPLETE": dispatch({ type: "SET_SCRAPING_FINISHED" }); break;
        case "SCRAPING_DIAGNOSTIC":
          if (__DEV__) console.info("Attendance portal layout:", JSON.stringify(payload.data));
          break;
        case "SCRAPING_ERROR":
          if (__DEV__) console.warn("Attendance fetching failed:", payload.message);
          dispatch({ type: "SET_SELECTION_ERROR", message: payload.message });
          break;
      }
    } catch (err) {
      console.warn("WebView Message Error:", err);
    }
  }, []);

  /* Aggregation math */
  const { overallClasses, overallPresent, overallAbsent } = subjectsData.reduce(
    (acc, x) => ({
      overallClasses: acc.overallClasses + x.total,
      overallPresent: acc.overallPresent + x.present,
      overallAbsent: acc.overallAbsent + x.absent,
    }),
    { overallClasses: 0, overallPresent: 0, overallAbsent: 0 },
  );
  const overallPercentageVal = overallClasses > 0 ? (overallPresent / overallClasses) * 100 : 0;
  const overallPercentage = overallPercentageVal.toFixed(1);
  const isShortage = overallPercentageVal < 75;
  const maxOverallSkippable = Math.max(0, Math.floor((4 * overallPresent - 3 * overallClasses) / 3));
  const getAttendanceColor = (percentage: number): string => {
    if (percentage < 75) return COLORS.error;
    if (percentage <= 77) return COLORS.amber;
    return COLORS.success;
  };
  const calculateCanSkip = (p: number, t: number): number =>
    Math.min(Math.max(0, Math.floor((4 * p - 3 * t) / 3)), maxOverallSkippable);
  const calculateClassesToReach75 = (p: number, t: number): number =>
    Math.max(0, 3 * t - 4 * p);

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
    const sig = `${studentInfo.name}|${subjectsData.length}|${overallClasses}|${overallPresent}`;
    if (persistedSigRef.current === sig) return;
    persistedSigRef.current = sig;
    const latestResult: PreviousAttendanceResult = { studentInfo, subjectsData };
    void savePreviousResult(latestResult);
    dispatch({ type: "SET_PREVIOUS_RESULT", result: latestResult });
  }, [isScrapingFinished, isLoggedIn, studentInfo, subjectsData, overallClasses, overallPresent]);

  /* Stall detection */
  useEffect(() => {
    if (!isLoggedIn || isScrapingFinished || selectionError) return;
    lastActivityRef.current = Date.now();
    const interval = setInterval(() => {
      if (Date.now() - lastActivityRef.current > STALL_TIMEOUT_MS) {
        const stage = scraperStageRef.current;
        const message = stage
          ? `The portal stopped responding while ${stage === "home" ? "opening your semester" : stage === "subjects" ? "opening a subject" : "reading attendance"}. Open the portal to check the page, then try again.`
          : "Fetching could not start on the portal page. Open the portal to check whether your semester or login needs attention, then try again.";
        dispatch({ type: "SET_SELECTION_ERROR", message });
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isLoggedIn, isScrapingFinished, selectionError]);

  const syncPct = totalSubjects ? Math.round((fetchedIndices.length / totalSubjects) * 100) : 0;
  const isFetching = isLoggedIn && !isScrapingFinished && !selectionError;
  const digging = useAnimatedValue(0);

  useEffect(() => {
    if (!isFetching) return;
    let disposed = false;
    const animation = Animated.loop(Animated.timing(digging, {
      toValue: 1,
      duration: 1400,
      easing: Easing.linear,
      useNativeDriver: true,
      isInteraction: false,
    }));
    const updateMotion = (reduceMotion: boolean): void => {
      animation.stop();
      digging.setValue(0);
      if (!reduceMotion && !disposed) animation.start();
    };
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", updateMotion);
    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion: boolean) => {
      if (!disposed) updateMotion(reduceMotion);
    }).catch(() => {
      if (!disposed) animation.start();
    });
    return () => {
      disposed = true;
      subscription.remove();
      animation.stop();
      digging.setValue(0);
    };
  }, [digging, isFetching]);

  return (
    <View style={styles.container}>
      {(update.status === "checking" || update.status === "applying") && (
        <View style={styles.updateBanner}>
          <Text style={styles.updateBannerText}>
            {update.status === "applying" ? "Applying update…" : "Checking for updates…"}
          </Text>
        </View>
      )}

      {!isLoggedIn && (
        <View style={styles.loginNotice}>
          <Text style={styles.loginNoticeTitle}>Before you log in</Text>
          <Text style={styles.loginNoticeText}>
            Wait for the “Verify you are human” check to show success before tapping Login.
          </Text>
        </View>
      )}

      {/* WebView stays full-size until scraping is done — overlays sit ON TOP,
          so the portal page can never flash through while loading. */}
      <View style={isScrapingFinished ? styles.hiddenWebView : styles.fullWebView}>
        <WebView
          key={webViewKey}
          ref={webViewRef}
          source={{ uri: "https://jntuaceastudents.classattendance.in/" }}
          onNavigationStateChange={handleNavigationStateChange}
          onLoadEnd={(event) => handleNavigationStateChange(event.nativeEvent)}
          onLoadProgress={(event) => {
            if (event.nativeEvent.progress >= 0.5) {
              handleNavigationStateChange({ url: event.nativeEvent.url, loading: false });
            }
          }}
          injectedJavaScriptBeforeContentLoaded={isScrapingFinished ? undefined : getPortalPageScript(state.currentIndex)}
          onError={(event) => dispatch({ type: "SET_SELECTION_ERROR", message: `The portal could not load: ${event.nativeEvent.description}` })}
          onMessage={handleMessage}
          javaScriptEnabled
          domStorageEnabled
          incognito={false}
        />
        {!isLoggedIn && hasPreviousResult && (
          <TouchableOpacity style={styles.prevBtn} onPress={handlePreviousAttendance} activeOpacity={0.88}>
            <Text style={styles.prevBtnIcon}>↺</Text>
            <Text style={styles.prevBtnText}>Previous Attendance</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ---------- SYNC · opaque overlay, no webpage flash ---------- */}
      {isFetching && (
        <View style={styles.overlayFull}>
          <View style={styles.digScene} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={styles.digBackdrop} />
            <View style={styles.digGround} />
            <View style={styles.digRock} />
            <Animated.View style={[styles.digWorker, { transform: [{
              translateY: digging.interpolate({ inputRange: [0, 0.4, 0.58, 1], outputRange: [0, -3, 2, 0] }),
            }] }]}>
              <View style={styles.digLegBack} />
              <View style={styles.digLegFront} />
              <View style={styles.digBody} />
              <View style={styles.digHead} />
              <View style={styles.digEye} />
              <View style={styles.digHelmet} />
              <View style={styles.digHelmetBrim} />
              <Animated.View style={[styles.digSwing, { transform: [{ rotate: digging.interpolate({
                inputRange: [0, 0.4, 0.58, 0.72, 1],
                outputRange: ["-35deg", "-85deg", "85deg", "85deg", "-35deg"],
              }) }] }]}>
                <View style={styles.digArm} />
                <View style={styles.digHandle} />
                <View style={styles.digHammer} />
              </Animated.View>
            </Animated.View>
            {[-1, 0, 1].map((direction: number) => (
              <Animated.View key={direction} style={[styles.digChip, {
                opacity: digging.interpolate({ inputRange: [0, 0.57, 0.6, 0.85, 1], outputRange: [0, 0, 1, 0, 0] }),
                transform: [
                  { translateX: digging.interpolate({ inputRange: [0, 0.58, 1], outputRange: [0, 0, direction * 38] }) },
                  { translateY: digging.interpolate({ inputRange: [0, 0.58, 0.72, 1], outputRange: [0, 0, -26 - Math.abs(direction) * 10, 8] }) },
                  { rotate: digging.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${direction * 150}deg`] }) },
                ],
              }]} />
            ))}
          </View>
          <Text style={styles.syncTitle}>Digging up your attendance</Text>
          <Text style={styles.syncPct} adjustsFontSizeToFit numberOfLines={1}>
            {syncPct}
            <Text style={styles.syncPctSign}>%</Text>
          </Text>
          <Text style={styles.syncDetail} accessibilityLiveRegion="polite">
            {totalSubjects === null ? "Finding your subjects..." : `${fetchedIndices.length} of ${totalSubjects} subjects fetched`}
          </Text>
        </View>
      )}

      {/* ---------- SELECTION ERROR · opaque overlay ---------- */}
      {!!selectionError && isLoggedIn && !isScrapingFinished && (
        <View style={styles.overlayFull}>
          <View style={styles.errorCard}>
            <TouchableOpacity style={styles.closeIcon} onPress={() => dispatch({ type: "CLEAR_SELECTION_ERROR" })}>
              <Text style={styles.closeIconText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.errorIcon}>!</Text>
            <Text style={styles.errorTitle}>Couldn’t load subjects right now</Text>
            <Text style={styles.errorBody}>
              {selectionError}
            </Text>
            <TouchableOpacity style={styles.errorBtn} onPress={handleFullReset}>
              <Text style={styles.errorBtnText}>Try again</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ---------- DASHBOARD · profile + overall scroll with the list ---------- */}
      {isLoggedIn && isScrapingFinished && (
        <View style={styles.dashboardContainer}>
          <FlatList
            style={{ flex: 1 }}
            data={subjectsData}
            keyExtractor={(item, index) => `${item.subjectName}-${index}`}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 16 }}
            ListHeaderComponent={
              <View>
                <View style={styles.profileCard}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={styles.profileName} numberOfLines={1}>{studentInfo?.name || "Attendance"}</Text>
                    {studentInfo && (
                      <View style={styles.profileMetaRow}>
                        <View style={styles.liveDot} />
                        <Text style={styles.profileMeta} numberOfLines={1}>
                          {studentInfo.admissionNo} • {studentInfo.className}
                        </Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity style={styles.iconBtn} onPress={handleFullReset} activeOpacity={0.7}>
                    <Text style={styles.iconBtnText}>↺</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.overallCard}>
                  <View style={styles.overallTopRow}>
                    <Text style={styles.eyebrowSm}>OVERALL ATTENDANCE</Text>
                    <View style={styles.badgePill}>
                      <Text style={styles.badgePillText}>{isShortage ? "Shortage" : "Semester 1"}</Text>
                    </View>
                  </View>
                  <Text style={[styles.bigPct, { color: getAttendanceColor(overallPercentageVal) }]}>
                    {overallPercentage}
                    <Text style={styles.bigPctSign}>%</Text>
                  </Text>
                  <View style={styles.miniStats}>
                    <View style={styles.miniStat}>
                      <Text style={styles.miniStatNum}>{overallClasses}</Text>
                      <Text style={styles.miniStatLabel}>TOT</Text>
                    </View>
                    <View style={styles.miniDivider} />
                    <View style={styles.miniStat}>
                      <Text style={styles.miniStatNum}>{overallPresent}</Text>
                      <Text style={styles.miniStatLabel}>ATT</Text>
                    </View>
                    <View style={styles.miniDivider} />
                    <View style={styles.miniStat}>
                      <Text style={styles.miniStatNum}>{overallAbsent}</Text>
                      <Text style={styles.miniStatLabel}>ABS</Text>
                    </View>
                  </View>
                  <View style={styles.skipRow}>
                    <View>
                      <Text style={styles.skipTitle}>Overall Safe to skip</Text>
                      <Text style={styles.skipSub}>while staying above 75%</Text>
                    </View>
                    <View style={[styles.badgeCoral, maxOverallSkippable <= 0 && styles.badgeMute]}>
                      <Text style={[styles.badgeCoralText, maxOverallSkippable <= 0 && styles.badgeMuteText]}>
                        {maxOverallSkippable} {maxOverallSkippable === 1 ? "class" : "classes"}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.listHead}>
                  <Text style={styles.eyebrowSm}>SUBJECTS</Text>
                  <Text style={styles.listCount}>{subjectsData.length}</Text>
                </View>
              </View>
            }
            ListFooterComponent={
              <View style={styles.footBand}>
                <Spike size={15} color={COLORS.onDark} />
                <Text style={styles.footTitle}>Open to Contribute</Text>
                <Text style={styles.footSub}>{"Found a bug or have an idea?\nThis app is open source."}</Text>
                <TouchableOpacity style={styles.btnCoral} activeOpacity={0.85} onPress={() => Linking.openURL(GITHUB_URL)}>
                  <Text style={styles.btnCoralText}>View on GitHub</Text>
                </TouchableOpacity>
                <Text style={styles.footCredit}>
                  Crafted by <Text style={styles.footCreditName}>J Chanikya</Text> · 2026
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const pVal = parseFloat(item.percentage);
              const isLow = pVal < 75;
              const canSkip = calculateCanSkip(item.present, item.total);
              const classesToReach75 = calculateClassesToReach75(item.present, item.total);
              return (
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.subjectCard}
                  onPress={() => dispatch({ type: "SET_SELECTED_SUBJECT", data: item })}
                >
                  <View style={styles.subjectRow1}>
                    <Text style={styles.subjectName} numberOfLines={2}>{item.subjectName}</Text>
                    <Text style={[styles.subjectPct, { color: getAttendanceColor(pVal) }]}>{item.percentage}%</Text>
                  </View>
                  <View style={styles.subjectRow2}>
                    <Text style={styles.shortStats}>
                      Tot <Text style={styles.shortStatsBold}>{item.total}</Text>
                      {" · "}Att <Text style={styles.shortStatsBold}>{item.present}</Text>
                      {" · "}Abs <Text style={styles.shortStatsBold}>{item.absent}</Text>
                    </Text>
                    <View style={[styles.badgeCoral, canSkip <= 0 && styles.badgeMute]}>
                      <Text style={[styles.badgeCoralText, canSkip <= 0 && styles.badgeMuteText]}>
                        {isLow
                          ? `Attend ${classesToReach75} more`
                          : canSkip > 0
                            ? `Skip ${canSkip} ${canSkip === 1 ? "class" : "classes"}`
                            : "Keep attending"}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {/* ---------- DATE LOG SHEET ---------- */}
      <Modal
        visible={!!selectedSubject}
        animationType="fade"
        transparent={true}
        onRequestClose={() => dispatch({ type: "SET_SELECTED_SUBJECT", data: null })}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            {selectedSubject && (
              <>
                <View style={styles.modalHandle} />
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={styles.modalTitle} numberOfLines={2}>{selectedSubject.subjectName}</Text>
                    <Text style={styles.modalSub}>
                      Attendance log · {selectedSubject.present} attended, {selectedSubject.absent} missed
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.closeIcon} onPress={() => dispatch({ type: "SET_SELECTED_SUBJECT", data: null })}>
                    <Text style={styles.closeIconText}>✕</Text>
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={selectedSubject.records}
                  keyExtractor={(_, index) => index.toString()}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <View style={styles.logRow}>
                      <View>
                        <Text style={styles.logDate}>{item.date}</Text>
                        {!!item.time && <Text style={styles.logTime}>{item.time}</Text>}
                      </View>
                      <View style={styles.logBadge}>
                        <Text
                          style={[styles.logBadgeText, { color: STATUS_COLOR[item.status] }]}
                        >
                          {item.status}
                        </Text>
                      </View>
                    </View>
                  )}
                />
              </>
            )}
          </View>
        </View>
      </Modal>
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

  loginNotice: {
    backgroundColor: COLORS.surfaceCard,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
  },
  loginNoticeTitle: { fontSize: 14, fontWeight: "600", color: COLORS.primaryActive, marginBottom: 4 },
  loginNoticeText: { fontSize: 13, lineHeight: 19, color: COLORS.body },

  hiddenWebView: { width: 0, height: 0, overflow: "hidden" },
  fullWebView: { flex: 1 },

  /* Previous attendance — floating coral pill, lifted off the bottom */
  prevBtn: {
    position: "absolute",
    bottom: 56,
    left: 28,
    right: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 9999,
    elevation: 6,
    shadowColor: "#181715",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  prevBtnIcon: { color: COLORS.onDark, fontSize: 16, fontWeight: "700", marginRight: 8 },
  prevBtnText: { color: COLORS.onDark, fontWeight: "600", fontSize: 14, letterSpacing: 0.2 },

  /* Opaque full-screen overlays — kill the webpage flash */
  overlayFull: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
    backgroundColor: COLORS.canvas,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },

  syncPct: { fontFamily: SERIF, fontSize: 96, letterSpacing: -3, color: COLORS.primary, lineHeight: 110, textAlign: "center" },
  syncPctSign: { fontSize: 40, color: COLORS.mutedSoft },
  syncTitle: { fontFamily: SERIF, fontSize: 23, color: COLORS.ink, textAlign: "center", marginTop: 12 },
  syncDetail: { fontSize: 13, color: COLORS.muted, textAlign: "center", marginTop: 4 },
  digScene: { width: 240, height: 180 },
  digBackdrop: { position: "absolute", width: 158, height: 158, borderRadius: 79, backgroundColor: COLORS.surfaceCard, left: 36, top: 2 },
  digGround: { position: "absolute", left: 12, right: 12, bottom: 15, height: 3, borderRadius: 2, backgroundColor: COLORS.creamStrong },
  digRock: { position: "absolute", left: 148, bottom: 18, width: 48, height: 27, borderTopLeftRadius: 22, borderTopRightRadius: 15, backgroundColor: COLORS.mutedSoft },
  digWorker: { position: "absolute", left: 54, top: 31, width: 124, height: 132 },
  digHead: { position: "absolute", left: 28, top: 19, width: 30, height: 30, borderRadius: 12, backgroundColor: "#e6b58e" },
  digEye: { position: "absolute", left: 50, top: 29, width: 3, height: 3, borderRadius: 2, backgroundColor: COLORS.ink },
  digHelmet: { position: "absolute", left: 23, top: 7, width: 38, height: 22, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: COLORS.amber },
  digHelmetBrim: { position: "absolute", left: 20, top: 24, width: 48, height: 6, borderRadius: 3, backgroundColor: COLORS.amber },
  digBody: { position: "absolute", left: 23, top: 47, width: 37, height: 45, borderRadius: 11, backgroundColor: COLORS.primary, transform: [{ rotate: "-10deg" }] },
  digLegBack: { position: "absolute", left: 23, top: 84, width: 15, height: 46, borderRadius: 6, backgroundColor: COLORS.body, transform: [{ rotate: "14deg" }] },
  digLegFront: { position: "absolute", left: 48, top: 84, width: 15, height: 46, borderRadius: 6, backgroundColor: COLORS.ink, transform: [{ rotate: "-17deg" }] },
  digSwing: { position: "absolute", left: 0, top: 19, width: 100, height: 90 },
  digArm: { position: "absolute", left: 44, top: 39, width: 41, height: 13, borderRadius: 7, backgroundColor: "#e6b58e" },
  digHandle: { position: "absolute", left: 79, top: 0, width: 7, height: 63, borderRadius: 3, backgroundColor: COLORS.primaryActive },
  digHammer: { position: "absolute", left: 64, top: 0, width: 37, height: 20, borderRadius: 5, backgroundColor: COLORS.body },
  digChip: { position: "absolute", left: 159, top: 131, width: 7, height: 7, borderRadius: 2, backgroundColor: COLORS.primary },

  errorCard: {
    width: "100%",
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
  },
  errorIcon: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.error, color: COLORS.onDark,
    fontSize: 20, fontWeight: "700", textAlign: "center", lineHeight: 34, overflow: "hidden",
  },
  errorTitle: { fontFamily: SERIF, fontSize: 19, letterSpacing: -0.3, color: COLORS.ink, marginTop: 12, textAlign: "center" },
  errorBody: { fontSize: 13, lineHeight: 19, color: COLORS.muted, marginTop: 8, textAlign: "center" },
  errorBtn: { backgroundColor: COLORS.error, borderRadius: 8, paddingVertical: 12, alignSelf: "stretch", alignItems: "center", marginTop: 16 },
  errorBtnText: { color: COLORS.onDark, fontWeight: "600", fontSize: 14 },
  closeIcon: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: COLORS.hairline,
    backgroundColor: COLORS.canvas, alignItems: "center", justifyContent: "center",
  },
  closeIconText: { fontSize: 13, color: COLORS.body, fontWeight: "600" },

  /* Dashboard */
  dashboardContainer: { flex: 1, paddingHorizontal: 20 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.canvas,
    borderWidth: 1, borderColor: COLORS.hairline, alignItems: "center", justifyContent: "center",
  },
  iconBtnText: { fontSize: 15, color: COLORS.body, fontWeight: "600" },

  profileCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: COLORS.surfaceDark, borderRadius: 12, padding: 18, marginBottom: 12,
  },
  profileName: { fontFamily: SERIF, fontSize: 24, letterSpacing: -0.5, color: COLORS.onDark },
  profileMetaRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.live, marginRight: 7 },
  profileMeta: { fontSize: 12.5, color: COLORS.onDarkSoft },

  overallCard: { backgroundColor: COLORS.surfaceCard, borderRadius: 12, padding: 20, marginBottom: 12 },
  overallTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  eyebrowSm: { fontSize: 10.5, fontWeight: "500", letterSpacing: 1.5, color: COLORS.muted },
  badgePill: { backgroundColor: COLORS.creamStrong, borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 4 },
  badgePillText: { fontSize: 11, fontWeight: "500", color: COLORS.ink },
  bigPct: { fontFamily: SERIF, fontSize: 52, letterSpacing: -1.5, color: COLORS.ink, lineHeight: 56, marginVertical: 4 },
  bigPctSign: { fontSize: 24, color: COLORS.muted },
  miniStats: { flexDirection: "row", borderTopWidth: 1, borderTopColor: COLORS.hairline, paddingTop: 12, marginTop: 8 },
  miniStat: { flex: 1, alignItems: "center" },
  miniStatNum: { fontFamily: SERIF, fontSize: 18, color: COLORS.body },
  miniStatLabel: { fontSize: 9.5, fontWeight: "500", letterSpacing: 1.2, color: COLORS.muted, marginTop: 3 },
  miniDivider: { width: 1, backgroundColor: COLORS.hairlineSoft },
  skipRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: COLORS.hairline, marginTop: 12, paddingTop: 12 },
  skipTitle: { fontSize: 13, fontWeight: "500", color: COLORS.body },
  skipSub: { fontSize: 10.5, color: COLORS.muted, marginTop: 2 },

  badgeCoral: { backgroundColor: COLORS.primary, borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 5 },
  badgeCoralText: { fontSize: 11, fontWeight: "500", letterSpacing: 0.4, color: COLORS.onDark },
  badgeMute: { backgroundColor: COLORS.creamStrong },
  badgeMuteText: { color: COLORS.muted },

  listHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginVertical: 8, paddingHorizontal: 2 },
  listCount: { fontSize: 12, color: COLORS.mutedSoft },

  subjectCard: {
    backgroundColor: COLORS.canvas, borderWidth: 1, borderColor: COLORS.hairline,
    borderRadius: 12, padding: 16, marginBottom: 10,
  },
  subjectRow1: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  subjectName: { flex: 1, fontSize: 14.5, fontWeight: "500", color: COLORS.ink, lineHeight: 20, marginRight: 10 },
  subjectPct: { fontFamily: SERIF, fontSize: 24, letterSpacing: -0.5, color: COLORS.ink },
  subjectRow2: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
  shortStats: { fontSize: 11.5, color: COLORS.muted },
  shortStatsBold: { fontWeight: "600", color: COLORS.body },

  footBand: { backgroundColor: COLORS.surfaceDark, borderRadius: 12, padding: 24, alignItems: "center", marginTop: 6, marginBottom: 8 },
  footTitle: { fontFamily: SERIF, fontSize: 21, letterSpacing: -0.3, color: COLORS.onDark, marginTop: 10 },
  footSub: { fontSize: 12.5, lineHeight: 19, color: COLORS.onDarkSoft, marginTop: 8, textAlign: "center" },
  btnCoral: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 20, marginTop: 14, alignSelf: "stretch", alignItems: "center" },
  btnCoralText: { fontSize: 14, fontWeight: "500", color: COLORS.onDark },
  footCredit: { fontSize: 11.5, color: COLORS.mutedSoft, marginTop: 14 },
  footCreditName: { fontFamily: SERIF, fontStyle: "italic", fontSize: 13, color: COLORS.primary },

  /* Modal */
  modalBackdrop: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: COLORS.canvas, borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 26, maxHeight: "78%",
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.creamStrong, alignSelf: "center", marginBottom: 14 },
  modalHeader: { flexDirection: "row", alignItems: "flex-start", paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.hairlineSoft, marginBottom: 4 },
  modalTitle: { fontFamily: SERIF, fontSize: 19, letterSpacing: -0.3, color: COLORS.ink, lineHeight: 24 },
  modalSub: { fontSize: 12, color: COLORS.muted, marginTop: 4 },
  logRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.hairlineSoft },
  logDate: { fontSize: 13, fontWeight: "500", color: COLORS.ink },
  logTime: { fontSize: 11.5, color: COLORS.mutedSoft, marginTop: 2 },
  logBadge: { backgroundColor: COLORS.surfaceCard, borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 4 },
  logBadgeText: { fontSize: 11, fontWeight: "500" },
});
