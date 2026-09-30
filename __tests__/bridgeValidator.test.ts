import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isBridgeMessage,
  parseBridgeMessage,
} from "../utils/bridgeValidator";

describe("bridgeValidator", () => {
  it("accepts all known message types", () => {
    assert.equal(
      isBridgeMessage({
        type: "STUDENT_INFO",
        data: { name: "A", admissionNo: "1", className: "CSE" },
      }),
      true
    );
    assert.equal(
      isBridgeMessage({ type: "SUBJECT_COUNT", count: 6 }),
      true
    );
    assert.equal(
      isBridgeMessage({
        type: "ATTENDANCE_ITEM",
        data: {
          subjectName: "Math",
          present: 1,
          absent: 0,
          total: 1,
          percentage: "100.00",
          records: [{ date: "d", time: "t", status: "Present" }],
        },
      }),
      true
    );
    assert.equal(
      isBridgeMessage({ type: "SUBJECT_SKIPPED", subcode: "CS101", index: 2 }),
      true
    );
    assert.equal(
      isBridgeMessage({ type: "SCRAPE_ERROR", message: "timeout" }),
      true
    );
    assert.equal(isBridgeMessage({ type: "STRUCTURE_CHANGED" }), true);
    assert.equal(isBridgeMessage({ type: "SCRAPING_COMPLETE" }), true);
  });

  it("rejects malformed and unknown payloads", () => {
    assert.equal(parseBridgeMessage("{bad"), null);
    assert.equal(parseBridgeMessage('{"type":"PWNED"}'), null);
    assert.equal(
      parseBridgeMessage('{"type":"SUBJECT_COUNT","count":-1}'),
      null
    );
    assert.equal(
      parseBridgeMessage(
        '{"type":"ATTENDANCE_ITEM","data":{"subjectName":"x"}}'
      ),
      null
    );
    assert.equal(parseBridgeMessage("x".repeat(1_000_001)), null);
  });
});
