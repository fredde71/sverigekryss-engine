import { freezeAnalysisValue } from "../analysis/AnalysisContext";
import { detectGridFromImageSource } from "../detection/imageGridDetectionEngine";

export async function runDigitizationJob({
  job,
  readImageData,
  options = {}
}) {
  if (!job?.source) {
    throw new Error("DigitizationJob source is required");
  }

  const effectiveOptions = {
    ...(job.options || {}),
    ...options
  };
  const detectionResult = await detectGridFromImageSource({
    source: job.source,
    options: effectiveOptions,
    readImageData
  });

  return freezeAnalysisValue({
    jobId: job.jobId,
    sourceId: job.source.id,
    status: "completed",
    context: detectionResult.context,
    gridDetection: detectionResult.gridDetection,
    suggestions: detectionResult.suggestions,
    diagnostics: detectionResult.diagnostics
  });
}
