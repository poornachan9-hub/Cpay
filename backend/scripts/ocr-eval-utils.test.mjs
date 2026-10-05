import test from "node:test";
import assert from "node:assert/strict";
import { calculateOcrMetrics, editDistance, normalizeOcrText } from "./ocr-eval-utils.mjs";

test("normalizes case, punctuation, and compatibility characters", () => {
  assert.equal(normalizeOcrText("ＡBC-123!"), "abc 123");
});

test("computes edit distance for strings and word arrays", () => {
  assert.equal(editDistance("kitten", "sitting"), 3);
  assert.equal(editDistance(["loan", "paid"], ["loan", "late"]), 1);
});

test("reports held-out OCR accuracy, error rates, and word F1", () => {
  const metrics = calculateOcrMetrics([
    { expectedText: "PAN 123", predictedText: "PAN 123" },
    { expectedText: "DOB 2020", predictedText: "DOB 2021" },
  ]);

  assert.equal(metrics.test_records, 2);
  assert.equal(metrics.exact_match_accuracy, 0.5);
  assert.equal(metrics.word_precision, 0.75);
  assert.equal(metrics.word_recall, 0.75);
  assert.equal(metrics.word_f1, 0.75);
  assert.ok(metrics.character_error_rate > 0);
  assert.ok(metrics.word_error_rate > 0);
});