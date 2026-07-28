import { freezeAnalysisValue } from "../analysis/AnalysisContext";

export function createDigitizationSuggestion({
  sourceId,
  grid,
  confidence = "unknown",
  diagnostics = []
} = {}) {
  return freezeAnalysisValue({
    sourceId,
    grid: grid || null,
    confidence,
    diagnostics: Array.isArray(diagnostics) ? diagnostics : []
  });
}
