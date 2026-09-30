import * as FileSystem from "expo-file-system/legacy";
import type {
  AttendanceRecord,
  StudentInfo,
  SubjectAttendanceData,
} from "./automationScripts";

export interface PreviousAttendanceResult {
  studentInfo: StudentInfo;
  subjectsData: SubjectAttendanceData[];
}

const FILE_NAME = "previous_attendance_result.json";
const MAX_FILE_BYTES = 1_000_000;

function getStorageUri(): string | null {
  if (!FileSystem.documentDirectory) return null;
  return `${FileSystem.documentDirectory}${FILE_NAME}`;
}

function isAttendanceRecord(data: unknown): data is AttendanceRecord {
  if (typeof data !== "object" || data === null) return false;
  const rec = data as Record<string, unknown>;
  return (
    typeof rec.date === "string" &&
    rec.date.length > 0 &&
    typeof rec.time === "string" &&
    (rec.status === "Present" ||
      rec.status === "Absent" ||
      rec.status === "Unknown")
  );
}

function isPreviousAttendanceResult(
  data: unknown
): data is PreviousAttendanceResult {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (typeof obj.studentInfo !== "object" || obj.studentInfo === null) {
    return false;
  }
  const info = obj.studentInfo as Record<string, unknown>;
  if (
    typeof info.name !== "string" ||
    typeof info.admissionNo !== "string" ||
    typeof info.className !== "string"
  ) {
    return false;
  }
  if (!Array.isArray(obj.subjectsData) || obj.subjectsData.length > 200)
    return false;
  return obj.subjectsData.every((item): item is SubjectAttendanceData => {
    if (typeof item !== "object" || item === null) return false;
    const rec = item as Record<string, unknown>;
    if (
      typeof rec.subjectName !== "string" ||
      rec.subjectName.length === 0 ||
      typeof rec.present !== "number" ||
      !Number.isFinite(rec.present) ||
      typeof rec.absent !== "number" ||
      !Number.isFinite(rec.absent) ||
      typeof rec.total !== "number" ||
      !Number.isFinite(rec.total) ||
      typeof rec.percentage !== "string" ||
      !Array.isArray(rec.records) ||
      rec.records.length > 1000
    ) {
      return false;
    }
    if (rec.present < 0 || rec.absent < 0 || rec.total < 0) return false;
    if (rec.total !== rec.present + rec.absent) return false;
    if (rec.subCode !== undefined && typeof rec.subCode !== "string")
      return false;
    return (rec.records as unknown[]).every(isAttendanceRecord);
  });
}

export async function savePreviousResult(
  result: PreviousAttendanceResult
): Promise<void> {
  try {
    const uri = getStorageUri();
    if (!uri) return;
    await FileSystem.writeAsStringAsync(uri, JSON.stringify(result));
  } catch {
    // Persistence is best-effort; never crash the scrape flow.
  }
}

export async function loadPreviousResult(): Promise<PreviousAttendanceResult | null> {
  try {
    const uri = getStorageUri();
    if (!uri) return null;
    const raw = await FileSystem.readAsStringAsync(uri);
    if (raw.length > MAX_FILE_BYTES) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isPreviousAttendanceResult(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearPreviousResult(): Promise<void> {
  try {
    const uri = getStorageUri();
    if (!uri) return;
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // ignore
  }
}
