import { freezeAnalysisValue } from "../analysis/AnalysisContext";

export function createDigitizationJob({
  jobId,
  source,
  options = {}
} = {}) {
  return freezeAnalysisValue({
    jobId,
    source,
    options
  });
}
