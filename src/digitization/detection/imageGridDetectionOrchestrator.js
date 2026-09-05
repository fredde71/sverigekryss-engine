import {
  createAnalysisContext,
  withBinaryImage,
  withDocumentBinaryImage,
  withGridGeometry,
  withImageData,
  withLineCandidates,
  withProjections
} from "../analysis/AnalysisContext";
import {
  createDocumentAnalysis,
  mapBinaryImageGeometryToDocument
} from "../analysis/DocumentAnalysis";
import {
  COMPATIBILITY_REGION_ID,
  mapAnalysisRegionGeometryToBinaryImage
} from "../analysis/AnalysisRegion";
import {
  createProductionAnalysisRegion,
  PRODUCTION_HORIZONTAL_OUTER_SPAN_REGION_ID
} from "../analysis/HorizontalOuterSpanAnalysisRegion";
import { createGridAnalysis } from "../analysis/GridAnalysis";
import { createGridDetection } from "./GridDetection";
import {
  createSuggestionFromAnalysisContext,
  detectGridFromAnalysisContext
} from "./gridDetectionEngine";

export function createImageGridDetectionOrchestrator({
  analyzeDocument = createDocumentAnalysis,
  createProductionRegion = createProductionAnalysisRegion,
  analyzeGrid = createGridAnalysis,
  normalizeGeometry = normalizeAnalysisRegionGeometryToDocument
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

    assertProductionRegion(analysisRegion);

    const gridAnalysis = await analyzeGrid({
      analysisRegion,
      options
    });
    const gridGeometry = normalizeGeometry(
      documentAnalysis,
      gridAnalysis.gridGeometry,
      analysisRegion
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
  const coordinateProvenance = createCoordinateProvenance({
    documentAnalysis,
    analysisRegion
  });
  const analysisContext = withGridGeometry(
    withLineCandidates(
      withProjections(
        withBinaryImage(
          withImageData(
            createAnalysisContext({ coordinateProvenance }),
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

  return withDocumentBinaryImage(
    detectedContext,
    documentAnalysis.binaryImage
  );
}

function createCoordinateProvenance({ documentAnalysis, analysisRegion }) {
  return {
    type: "digitization-coordinate-provenance",
    version: 1,
    spaces: {
      local: "analysis-region-local",
      binaryImage: "binary-image-pixels",
      document: "document"
    },
    analysisRegion: {
      id: analysisRegion?.id ?? null,
      regionType: analysisRegion?.regionType ?? null,
      relationshipType:
        analysisRegion?.coordinateRelationship?.type ?? null,
      localToBinaryImage:
        analysisRegion?.coordinateRelationship?.localToBinaryImage ?? null,
      owner: "analysis-region"
    },
    documentAnalysis: {
      type: documentAnalysis?.type ?? null,
      version: documentAnalysis?.version ?? null,
      relationshipType:
        documentAnalysis?.coordinateRelationship?.type ?? null,
      binaryImageToDocument:
        documentAnalysis?.coordinateRelationship?.binaryImageToDocument
          ?? null,
      owner: "document-analysis"
    }
  };
}

function assertProductionRegion(analysisRegion) {
  const isCompatibilityRegion = (
    analysisRegion?.id === COMPATIBILITY_REGION_ID
    && analysisRegion?.regionType === "compatibility"
  );
  const isObservedProductionRegion = (
    analysisRegion?.id === PRODUCTION_HORIZONTAL_OUTER_SPAN_REGION_ID
    && analysisRegion?.regionType === "production-analysis-region"
  );

  if (!isCompatibilityRegion && !isObservedProductionRegion) {
    throw new Error("Production requires a production-owned AnalysisRegion");
  }
}

function normalizeAnalysisRegionGeometryToDocument(
  documentAnalysis,
  gridGeometry,
  analysisRegion
) {
  return mapBinaryImageGeometryToDocument(
    documentAnalysis,
    mapAnalysisRegionGeometryToBinaryImage(analysisRegion, gridGeometry)
  );
}

function validateDependency(dependency, name) {
  if (typeof dependency !== "function") {
    throw new Error(`${name} must be a function`);
  }
}
