import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculateCanSkip,
  calculateClassesToReach75,
  computeOverallStats,
  sanitizePercentage,
} from "../utils/attendanceMath";
import type { SubjectAttendanceData } from "../utils/automationScripts";

function subject(
  overrides: Partial<SubjectAttendanceData> = {}
): SubjectAttendanceData {
  return {
    subjectName: "Math",
    present: 30,
    absent: 10,
    total: 40,
    percentage: "75.00",
    records: [],
    ...overrides,
  };
}

describe("attendanceMath", () => {
  it("computes overall stats and 75% headroom", () => {
    const stats = computeOverallStats([subject(), subject()]);
    assert.equal(stats.overallClasses, 80);
    assert.equal(stats.overallPresent, 60);
    assert.equal(stats.overallPercentage, "75.0");
    assert.equal(stats.isShortage, false);
    assert.equal(stats.maxOverallSkippable, 0);
  });

  it("returns zeros for empty input", () => {
    const stats = computeOverallStats([]);
    assert.equal(stats.overallClasses, 0);
    assert.equal(stats.overallPercentageVal, 0);
    assert.equal(stats.isShortage, true);
  });

  it("calculates skippable classes with overall clamp", () => {
    assert.equal(calculateCanSkip(40, 40, 10), 10);
    assert.equal(calculateCanSkip(40, 40, 1), 1);
    assert.equal(calculateCanSkip(0, 0, 5), 0);
    assert.equal(calculateCanSkip(20, 40, 5), 0);
  });

  it("calculates classes needed to reach 75%", () => {
    assert.equal(calculateClassesToReach75(20, 40), 40);
    assert.equal(calculateClassesToReach75(30, 40), 0);
  });

  it("sanitizes corrupt percentages to 0", () => {
    assert.equal(sanitizePercentage("NaN"), 0);
    assert.equal(sanitizePercentage("abc"), 0);
    assert.equal(sanitizePercentage("82.50"), 82.5);
  });
});
