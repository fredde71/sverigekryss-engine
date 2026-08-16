import {
  createAnalysisContext,
  withBinaryImage,
  withGridGeometry,
  withImageData,
  withLineCandidates,
  withProjections
} from "../analysis/AnalysisContext";
import {
  createDocumentAnalysis,
  mapBinaryImageGeometryToDocument
} from "../analysis/DocumentAnalysis";
import { createCompatibilityAnalysisRegion } from "../analysis/AnalysisRegion";
import { createGridAnalysis } from "../analysis/GridAnalysis";
import { createGridDetection } from "./GridDetection";
import {
  createSuggestionFromAnalysisContext,
  detectGridFromAnalysisContext
} from "./gridDetectionEngine";

export async function detectGridFromImageSource({
  source,
  options = {},
  readImageData
}) {
  if (typeof readImageData !== "function") {
    throw new Error("readImageData is required");
  }

  const imageData = await readImageData(source);
  const documentAnalysis = createDocumentAnalysis({
    imageData,
    options
  });
  const analysisRegion = createCompatibilityAnalysisRegion(documentAnalysis);
  const gridAnalysis = await createGridAnalysis({
    analysisRegion,
    options
  });
  const gridGeometry = mapBinaryImageGeometryToDocument(
    documentAnalysis,
    gridAnalysis.gridGeometry
  );

  const analysisContext = withGridGeometry(
    withLineCandidates(
      withProjections(
        withBinaryImage(
          withImageData(
            createAnalysisContext(),
            documentAnalysis.imageData
          ),
          analysisRegion.binaryImage
        ),
        gridAnalysis.projections
      ),
      gridAnalysis.lineCandidates
    ),
    gridGeometry
  );
  const detectedContext = detectGridFromAnalysisContext(analysisContext, {
    detectGrid: context => createGridDetection({
      geometry: context.gridGeometry,
      confidence: context.gridGeometry ? "detected" : "missing-grid-geometry",
      diagnostics: gridAnalysis.diagnostics
    })
  });
  const suggestions = detectedContext.gridDetection.geometry
    ? [
      createSuggestionFromAnalysisContext({
        source,
        context: detectedContext
      })
    ]
    : [];

  return {
    context: detectedContext,
    gridDetection: detectedContext.gridDetection,
    suggestions,
    diagnostics: detectedContext.gridDetection.diagnostics
  };
}
