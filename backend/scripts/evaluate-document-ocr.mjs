import { createWorker } from "tesseract.js";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calculateOcrMetrics } from "./ocr-eval-utils.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const usage = "node evaluate-document-ocr.mjs --dev <dev.jsonl> --test <test.jsonl> [--output <metrics.json>]";

function parseArguments(args) {
  const options = { output: path.join(scriptDirectory, "ocr_metrics.json") };
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (!["--dev", "--test", "--output"].includes(key) || !args[index + 1]) {
      throw new Error(usage);
    }
    options[key.slice(2)] = path.resolve(args[index + 1]);
    index += 1;
  }
  if (!options.dev || !options.test) throw new Error(usage);
  return options;
}

async function loadManifest(filePath) {
  const source = await readFile(filePath, "utf8");
  return source.split(/\r?\n/).flatMap((line, index) => {
    if (!line.trim()) return [];
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      throw new Error(`Invalid JSON at ${path.basename(filePath)} line ${index + 1}`);
    }
    if (!record.image || !record.document_id || typeof record.expected_text !== "string") {
      throw new Error(`Manifest line ${index + 1} needs image, document_id, and expected_text`);
    }
    return [{
      image: path.resolve(path.dirname(filePath), record.image),
      documentId: String(record.document_id),
      expectedText: record.expected_text,
    }];
  });
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const [developmentRecords, testRecords] = await Promise.all([
    loadManifest(options.dev),
    loadManifest(options.test),
  ]);
  const developmentIds = new Set(developmentRecords.map((record) => record.documentId));
  const overlappingIds = testRecords.filter((record) => developmentIds.has(record.documentId));
  if (overlappingIds.length) {
    throw new Error("Development/test manifests overlap by document_id; split by document before evaluation");
  }
  if (!testRecords.length) throw new Error("Test manifest is empty");

  const language = process.env.OCR_LANGS || "eng";
  const worker = await createWorker(language, 1);
  try {
    const predictions = [];
    for (const record of testRecords) {
      const { data } = await worker.recognize(record.image);
      predictions.push({ expectedText: record.expectedText, predictedText: data.text });
    }

    const metrics = {
      model: "Tesseract.js",
      language,
      dataset: "MIDV-500 (user-provided manifests)",
      split_policy: "document_id-disjoint development and test manifests",
      development_documents: developmentIds.size,
      ...calculateOcrMetrics(predictions),
      limitations: "OCR transcription benchmark only; not Aadhaar/PAN validation or document-authenticity verification.",
    };
    await mkdir(path.dirname(options.output), { recursive: true });
    await writeFile(options.output, `${JSON.stringify(metrics, null, 2)}\n`, "utf8");
    console.log(JSON.stringify(metrics, null, 2));
  } finally {
    await worker.terminate();
  }
}

main().catch((error) => {
  console.error(error.message || "OCR evaluation failed");
  process.exitCode = 1;
});