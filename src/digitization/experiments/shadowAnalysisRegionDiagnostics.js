import { runShadowAnalysisRegionProviders } from "./analysisRegions/shadowAnalysisRegionRunner";

export const shadowAnalysisRegionDiagnosticsExperiment = Object.freeze({
  id: "shadow-analysis-region-observations",
  description: "Observe development-only AnalysisRegions without running grid analysis or changing production detection.",
  run(binaryImage, _context) {
    return createShadowAnalysisRegionDiagnostics(binaryImage);
  }
});

export function createShadowAnalysisRegionDiagnostics(binaryImage, {
  runProviders = runShadowAnalysisRegionProviders
} = {}) {
  const documentAnalysis = createExperimentDocumentAnalysis(binaryImage);

  return runProviders(documentAnalysis);
}

function createExperimentDocumentAnalysis(binaryImage) {
  if (!binaryImage) {
    throw new Error("BinaryImage is required");
  }

  return Object.freeze({
    type: "document-analysis",
    version: 1,
    status: "measured",
    binaryImage,
    dimensions: Object.freeze({
      document: Object.freeze({
        width: binaryImage.width,
        height: binaryImage.height
      }),
      binaryImage: Object.freeze({
        width: binaryImage.width,
        height: binaryImage.height
      })
    }),
    coordinateRelationship: Object.freeze({
      type: "identity"
    }),
    diagnostics: Object.freeze([
      Object.freeze({
        type: "experiment-document-analysis-observation",
        status: "measured"
      })
    ])
  });
}
