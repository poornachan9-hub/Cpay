export function normalizeOcrText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function editDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = previous[0];
    previous[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const above = previous[rightIndex];
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      previous[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + 1,
        diagonal + substitutionCost
      );
      diagonal = above;
    }
  }

  return previous[right.length];
}

function wordCounts(words) {
  const counts = new Map();
  for (const word of words) counts.set(word, (counts.get(word) || 0) + 1);
  return counts;
}

export function calculateOcrMetrics(records) {
  let exactMatches = 0;
  let characterErrors = 0;
  let referenceCharacters = 0;
  let wordErrors = 0;
  let referenceWords = 0;
  let truePositiveWords = 0;
  let falsePositiveWords = 0;
  let falseNegativeWords = 0;

  for (const { expectedText, predictedText } of records) {
    const expected = normalizeOcrText(expectedText);
    const predicted = normalizeOcrText(predictedText);
    if (expected === predicted) exactMatches += 1;

    characterErrors += editDistance(expected.replaceAll(" ", ""), predicted.replaceAll(" ", ""));
    referenceCharacters += expected.replaceAll(" ", "").length;

    const expectedWords = expected ? expected.split(" ") : [];
    const predictedWords = predicted ? predicted.split(" ") : [];
    wordErrors += editDistance(expectedWords, predictedWords);
    referenceWords += expectedWords.length;

    const expectedCounts = wordCounts(expectedWords);
    const predictedCounts = wordCounts(predictedWords);
    for (const [word, count] of predictedCounts) {
      const matched = Math.min(count, expectedCounts.get(word) || 0);
      truePositiveWords += matched;
      falsePositiveWords += count - matched;
    }
    for (const [word, count] of expectedCounts) {
      falseNegativeWords += count - Math.min(count, predictedCounts.get(word) || 0);
    }
  }

  const precision = truePositiveWords / (truePositiveWords + falsePositiveWords || 1);
  const recall = truePositiveWords / (truePositiveWords + falseNegativeWords || 1);

  return {
    test_records: records.length,
    exact_match_accuracy: exactMatches / (records.length || 1),
    character_error_rate: characterErrors / (referenceCharacters || 1),
    word_error_rate: wordErrors / (referenceWords || 1),
    word_precision: precision,
    word_recall: recall,
    word_f1: (2 * precision * recall) / (precision + recall || 1),
    word_counts: {
      true_positive: truePositiveWords,
      false_positive: falsePositiveWords,
      false_negative: falseNegativeWords,
    },
  };
}