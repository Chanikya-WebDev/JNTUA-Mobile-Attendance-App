import type { AttendanceRecord, SubjectAttendanceData } from "./automationScripts";

export const ATTENDANCE_THRESHOLD = 75;

export interface OverallStats {
  overallClasses: number;
  overallPresent: number;
  overallAbsent: number;
  overallPercentageVal: number;
  overallPercentage: string;
  isShortage: boolean;
  maxOverallSkippable: number;
}

export function computeOverallStats(
  subjectsData: SubjectAttendanceData[]
): OverallStats {
  const overallClasses = subjectsData.reduce((acc, x) => acc + x.total, 0);
  const overallPresent = subjectsData.reduce((acc, x) => acc + x.present, 0);
  const overallAbsent = subjectsData.reduce((acc, x) => acc + x.absent, 0);
  const overallPercentageVal =
    overallClasses > 0 ? (overallPresent / overallClasses) * 100 : 0;
  return {
    overallClasses,
    overallPresent,
    overallAbsent,
    overallPercentageVal,
    overallPercentage: overallPercentageVal.toFixed(1),
    isShortage: overallPercentageVal < ATTENDANCE_THRESHOLD,
    maxOverallSkippable: Math.max(
      0,
      Math.floor((4 * overallPresent - 3 * overallClasses) / 3)
    ),
  };
}

/** Classes skippable while staying >= 75%. Pure, unit-testable. */
export function calculateCanSkip(
  present: number,
  total: number,
  maxOverallSkippable: number
): number {
  if (!Number.isFinite(present) || !Number.isFinite(total) || total <= 0)
    return 0;
  const clampedPresent = Math.max(0, Math.min(present, total));
  return Math.min(
    Math.max(0, Math.floor((4 * clampedPresent - 3 * total) / 3)),
    Math.max(0, maxOverallSkippable)
  );
}

/** Extra classes needed to reach 75%. Pure, unit-testable. */
export function calculateClassesToReach75(
  present: number,
  total: number
): number {
  if (!Number.isFinite(present) || !Number.isFinite(total) || total < 0)
    return 0;
  return Math.max(0, 3 * total - 4 * Math.max(0, present));
}

/** Last recorded class date for a subject card; null when no dated records exist. */
export function getLastAttendanceDate(
  records: AttendanceRecord[]
): string | null {
  for (let i = records.length - 1; i >= 0; i--) {
    const date = records[i].date.trim();
    if (date.length > 0) return date;
  }
  return null;
}

/** Sanitize persisted percentage strings; corrupt -> 0. */
export function sanitizePercentage(raw: string): number {
  const value = parseFloat(raw);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : 0;
}
