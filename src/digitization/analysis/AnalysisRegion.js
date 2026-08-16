const ANALYSIS_REGION_VERSION = 1;
const COMPATIBILITY_REGION_ID = "compatibility-full-binary-image";

export function createCompatibilityAnalysisRegion(documentAnalysis) {
  validateDocumentAnalysis(documentAnalysis);

  const binaryImage = documentAnalysis.binaryImage;
  const bounds = freezeValue({
    top: 0,
    left: 0,
    width: binaryImage.width,
    height: binaryImage.height
  });
  const coordinateRelationship = freezeValue({
    type: "identity",
    localToBinaryImage: {
      offsetX: 0,
      offsetY: 0,
      scaleX: 1,
      scaleY: 1
    },
    binaryImageToLocal: {
      offsetX: 0,
      offsetY: 0,
      scaleX: 1,
      scaleY: 1
    }
  });
  const diagnostics = freezeValue([
    {
      type: "analysis-region",
      version: ANALYSIS_REGION_VERSION,
      status: "measured",
      regionId: COMPATIBILITY_REGION_ID,
      regionType: "compatibility",
      bounds,
      coordinateRelationship
    }
  ]);

  return Object.freeze({
    type: "analysis-region",
    version: ANALYSIS_REGION_VERSION,
    id: COMPATIBILITY_REGION_ID,
    status: "measured",
    regionType: "compatibility",
    bounds,
    binaryImage,
    coordinateRelationship,
    diagnostics
  });
}

export function mapAnalysisRegionPointToBinaryImage(analysisRegion, point) {
  validateAnalysisRegion(analysisRegion);

  return {
    x: point.x,
    y: point.y
  };
}

export function mapBinaryImagePointToAnalysisRegion(analysisRegion, point) {
  validateAnalysisRegion(analysisRegion);

  return {
    x: point.x,
    y: point.y
  };
}

export function validateAnalysisRegion(analysisRegion) {
  if (
    !analysisRegion
    || analysisRegion.type !== "analysis-region"
    || analysisRegion.status !== "measured"
  ) {
    throw new Error("Measured AnalysisRegion is required");
  }

  if (!analysisRegion.binaryImage) {
    throw new Error("AnalysisRegion BinaryImage is required");
  }
}

function validateDocumentAnalysis(documentAnalysis) {
  if (
    !documentAnalysis
    || documentAnalysis.type !== "document-analysis"
    || documentAnalysis.status !== "measured"
    || !documentAnalysis.binaryImage
  ) {
    throw new Error("Measured DocumentAnalysis is required");
  }
}

function freezeValue(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(freezeValue);
  return Object.freeze(value);
}
