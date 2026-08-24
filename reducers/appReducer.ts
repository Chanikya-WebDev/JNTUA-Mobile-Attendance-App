import { StudentInfo, SubjectAttendanceData } from "../utils/automationScripts";
import { PreviousAttendanceResult } from "../utils/storage";

export interface AppState {
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
  isSelectionError: boolean;
  isStructureError: boolean;
  isOffline: boolean;
  isSplashDismissed: boolean;
  gatewayError: boolean;
}

export const initialState: AppState = {
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
  isSelectionError: false,
  isStructureError: false,
  isOffline: false,
  isSplashDismissed: false,
  gatewayError: false,
};

function preserveSession(state: AppState, webViewKeyDelta: number): AppState {
  return {
    ...initialState,
    webViewKey: state.webViewKey + webViewKeyDelta,
    hasPreviousResult: state.hasPreviousResult,
    previousResult: state.previousResult,
    isSplashDismissed: state.isSplashDismissed,
  };
}

export type AppAction =
  | { type: "RESET" }
  | { type: "SET_LOGGED_IN" }
  | { type: "SET_STUDENT_INFO"; data: StudentInfo }
  | { type: "SET_SUBJECT_COUNT"; count: number }
  | { type: "ADD_ATTENDANCE_ITEM"; data: SubjectAttendanceData }
  | { type: "SET_SCRAPING_FINISHED" }
  | { type: "SET_SELECTED_SUBJECT"; data: SubjectAttendanceData | null }
  | { type: "SET_PREVIOUS_RESULT"; result: PreviousAttendanceResult | null }
  | { type: "HYDRATE_PREVIOUS_RESULT"; data: PreviousAttendanceResult }
  | { type: "SET_SELECTION_ERROR" }
  | { type: "CLEAR_SELECTION_ERROR" }
  | { type: "SET_STRUCTURE_ERROR" }
  | { type: "SET_OFFLINE"; status: boolean }
  | { type: "SET_SPLASH_DISMISSED" }
  | { type: "SET_GATEWAY_ERROR" }
  | { type: "CLEAR_GATEWAY_ERROR" };

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "RESET":
      return preserveSession(state, 1);
    case "SET_LOGGED_IN":
      return { ...state, isLoggedIn: true };
    case "SET_STUDENT_INFO":
      return { ...state, studentInfo: action.data };
    case "SET_SUBJECT_COUNT":
      if (state.totalSubjects === action.count) return state;
      return { ...state, totalSubjects: action.count };
    case "ADD_ATTENDANCE_ITEM": {
      if (state.fetchedIndices.includes(state.currentIndex)) return state;
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
      return { ...state, isSelectionError: true };
    case "CLEAR_SELECTION_ERROR":
      return preserveSession(state, 0);
    case "SET_STRUCTURE_ERROR":
      return { ...state, isStructureError: true };
    case "SET_OFFLINE":
      if (state.isOffline === action.status) return state;
      return { ...state, isOffline: action.status };
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
    case "SET_SPLASH_DISMISSED":
      return { ...state, isSplashDismissed: true };
    case "SET_GATEWAY_ERROR":
      return { ...state, gatewayError: true };
    case "CLEAR_GATEWAY_ERROR":
      return preserveSession(state, 0);
    default:
      return state;
  }
}