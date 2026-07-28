import {
  createAnalysisContext,
  withGridDetection
} from "../analysis/AnalysisContext";
import { createDigitizationSuggestion } from "../domain/DigitizationSuggestion";
import { createGridDetection } from "./GridDetection";

export function detectGridFromAnalysisContext(context, options = {}) {
  const analysisContext = createAnalysisContext(context);
  const detector = options.detectGrid || detectGridFromGeometry;
  const gridDetection = detector(analysisContext, options);

  return withGridDetection(analysisContext, gridDetection);
}

export function createSuggestionFromGridDetection({
  source,
  gridDetection
}) {
  return createDigitizationSuggestion({
    sourceId: source?.id,
    grid: gridDetection?.geometry || null,
    confidence: gridDetection?.confidence || "unknown",
    diagnostics: gridDetection?.diagnostics || []
  });
}

export function createSuggestionFromAnalysisContext({
  source,
  context
}) {
  return createSuggestionFromGridDetection({
    source,
    gridDetection: context?.gridDetection
  });
}

function detectGridFromGeometry(context) {
  if (!context.gridGeometry) {
    return createGridDetection({
      geometry: null,
      confidence: "missing-grid-geometry",
      diagnostics: [
        "AnalysisContext has no gridGeometry"
      ]
    });
  }

  return createGridDetection({
    geometry: context.gridGeometry,
    confidence: "provided-grid-geometry",
    diagnostics: []
  });
}
