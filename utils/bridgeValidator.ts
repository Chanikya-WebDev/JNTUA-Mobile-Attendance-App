import type {
  AttendanceRecord,
  StudentInfo,
  SubjectAttendanceData,
} from "./automationScripts";

export type BridgeMessage =
  | { type: "STUDENT_INFO"; data: StudentInfo }
  | { type: "SUBJECT_COUNT"; count: number }
  | { type: "ATTENDANCE_ITEM"; data: SubjectAttendanceData }
  | { type: "SUBJECT_SKIPPED"; subcode: string; index: number }
  | { type: "SCRAPE_ERROR"; message: string }
  | { type: "STRUCTURE_CHANGED" }
  | { type: "SCRAPING_COMPLETE" };

const KNOWN_TYPES: ReadonlySet<string> = new Set([
  "STUDENT_INFO",
  "SUBJECT_COUNT",
  "ATTENDANCE_ITEM",
  "SUBJECT_SKIPPED",
  "SCRAPE_ERROR",
  "STRUCTURE_CHANGED",
  "SCRAPING_COMPLETE",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isStudentInfo(value: unknown): value is StudentInfo {
  if (!isRecord(value)) return false;
  return (
    typeof value.name === "string" &&
    typeof value.admissionNo === "string" &&
    typeof value.className === "string"
  );
}

export function isAttendanceRecord(value: unknown): value is AttendanceRecord {
  if (!isRecord(value)) return false;
  return (
    typeof value.date === "string" &&
    typeof value.time === "string" &&
    (value.status === "Present" ||
      value.status === "Absent" ||
      value.status === "Unknown")
  );
}

export function isSubjectAttendanceData(
  value: unknown
): value is SubjectAttendanceData {
  if (!isRecord(value)) return false;
  return (
    typeof value.subjectName === "string" &&
    typeof value.present === "number" &&
    Number.isFinite(value.present) &&
    typeof value.absent === "number" &&
    Number.isFinite(value.absent) &&
    typeof value.total === "number" &&
    Number.isFinite(value.total) &&
    typeof value.percentage === "string" &&
    Array.isArray(value.records) &&
    value.records.every(isAttendanceRecord)
  );
}

/** Runtime guard for WebView bridge payloads. TS casts are not validation. */
export function isBridgeMessage(value: unknown): value is BridgeMessage {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  if (!KNOWN_TYPES.has(value.type)) return false;
  switch (value.type) {
    case "STUDENT_INFO":
      return isStudentInfo(value.data);
    case "SUBJECT_COUNT":
      return (
        typeof value.count === "number" &&
        Number.isInteger(value.count) &&
        value.count >= 0 &&
        value.count <= 200
      );
    case "ATTENDANCE_ITEM":
      return isSubjectAttendanceData(value.data);
    case "SUBJECT_SKIPPED":
      return (
        typeof value.subcode === "string" &&
        typeof value.index === "number" &&
        Number.isInteger(value.index) &&
        value.index >= 0
      );
    case "SCRAPE_ERROR":
      return typeof value.message === "string";
    case "STRUCTURE_CHANGED":
    case "SCRAPING_COMPLETE":
      return true;
    default:
      return false;
  }
}

/** Parse raw WebView string; returns null on malformed/unknown payloads. */
export function parseBridgeMessage(raw: string): BridgeMessage | null {
  if (typeof raw !== "string" || raw.length > 1_000_000) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isBridgeMessage(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
