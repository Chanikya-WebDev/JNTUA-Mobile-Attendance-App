import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { appReducer, initialState } from "../reducers/appReducer";

describe("appReducer", () => {
  it("dedupes attendance items by subCode", () => {
    const item = {
      subjectName: "Math",
      subCode: "CS101",
      present: 1,
      absent: 0,
      total: 1,
      percentage: "100.00",
      records: [],
    };
    const once = appReducer(
      { ...initialState, totalSubjects: 2 },
      { type: "ADD_ATTENDANCE_ITEM", data: item }
    );
    const twice = appReducer(once, {
      type: "ADD_ATTENDANCE_ITEM",
      data: item,
    });
    assert.equal(once.subjectsData.length, 1);
    assert.equal(twice.subjectsData.length, 1);
    assert.deepEqual(twice.fetchedSubCodes, ["CS101"]);
  });

  it("advances index on SUBJECT_SKIPPED without data", () => {
    const next = appReducer(
      { ...initialState, totalSubjects: 3, currentIndex: 1 },
      { type: "ADVANCE_INDEX" }
    );
    assert.equal(next.currentIndex, 2);
    assert.deepEqual(next.fetchedIndices, [1]);
  });

  it("preserves previous result across RESET", () => {
    const result = {
      studentInfo: { name: "A", admissionNo: "1", className: "CSE" },
      subjectsData: [],
    };
    const withPrev = appReducer(initialState, {
      type: "SET_PREVIOUS_RESULT",
      result,
    });
    const reset = appReducer(withPrev, { type: "RESET" });
    assert.equal(reset.hasPreviousResult, true);
    assert.equal(reset.webViewKey, 1);
  });

  it("stores structure error message", () => {
    const next = appReducer(initialState, {
      type: "SET_STRUCTURE_ERROR",
      message: "timeout",
    });
    assert.equal(next.isStructureError, true);
    assert.equal(next.structureErrorMessage, "timeout");
  });
});
