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

const COMPATIBILITY_REGION_ID = "compatibility-full-binary-image";

export function createImageGridDetectionOrchestrator({
  analyzeDocument = createDocumentAnalysis,
  createProductionRegion = createCompatibilityAnalysisRegion,
  analyzeGrid = createGridAnalysis,
  normalizeGeometry = mapBinaryImageGeometryToDocument
} = {}) {
  validateDependency(analyzeDocument, "analyzeDocument");
  validateDependency(createProductionRegion, "createProductionRegion");
  validateDependency(analyzeGrid, "analyzeGrid");
  validateDependency(normalizeGeometry, "normalizeGeometry");

  return async function runImageGridDetection({
    source,
    options = {},
    readImageData
  }) {
    if (typeof readImageData !== "function") {
      throw new Error("readImageData is required");
    }

    const imageData = await readImageData(source);
    const documentAnalysis = analyzeDocument({
      imageData,
      options
    });
    const analysisRegion = createProductionRegion(documentAnalysis);

    assertCompatibilityRegion(analysisRegion);

    const gridAnalysis = await analyzeGrid({
      analysisRegion,
      options
    });
    const gridGeometry = normalizeGeometry(
      documentAnalysis,
      gridAnalysis.gridGeometry
    );
    const detectedContext = createDetectedContext({
      documentAnalysis,
      analysisRegion,
      gridAnalysis,
      gridGeometry
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
  };
}

export const runImageGridDetection = createImageGridDetectionOrchestrator();

function createDetectedContext({
  documentAnalysis,
  analysisRegion,
  gridAnalysis,
  gridGeometry
}) {
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

  return detectGridFromAnalysisContext(analysisContext, {
    detectGrid: context => createGridDetection({
      geometry: context.gridGeometry,
      confidence: context.gridGeometry ? "detected" : "missing-grid-geometry",
      diagnostics: gridAnalysis.diagnostics
    })
  });
}

function assertCompatibilityRegion(analysisRegion) {
  if (
    analysisRegion?.id !== COMPATIBILITY_REGION_ID
    || analysisRegion?.regionType !== "compatibility"
  ) {
    throw new Error("Production requires the compatibility AnalysisRegion");
  }
}

function validateDependency(dependency, name) {
  if (typeof dependency !== "function") {
    throw new Error(`${name} must be a function`);
  }
}
