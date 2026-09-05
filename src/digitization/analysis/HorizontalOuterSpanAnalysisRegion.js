import { createHorizontalProjection } from "./Projection";
import { findLineCandidates } from "./LineCandidate";
import { createCompatibilityAnalysisRegion } from "./AnalysisRegion";

export const HORIZONTAL_OUTER_SPAN_COVERAGE_RATIO = 0.8;
export const HORIZONTAL_OUTER_SPAN_METHOD =
  "outermost-horizontal-candidate-runs";

const DEFAULT_REGION_ID = "horizontal-outer-span-001";
const DEFAULT_REGION_TYPE = "observed-analysis-region";
export const PRODUCTION_HORIZONTAL_OUTER_SPAN_REGION_ID =
  "production-horizontal-outer-span-001";

export function createProductionAnalysisRegion(documentAnalysis) {
  const observation = observeHorizontalOuterSpanAnalysisRegion(
    documentAnalysis,
    {
      regionId: PRODUCTION_HORIZONTAL_OUTER_SPAN_REGION_ID,
      regionType: "production-analysis-region"
    }
  );

  return observation.regions[0]
    || createCompatibilityAnalysisRegion(documentAnalysis);
}

export function observeHorizontalOuterSpanAnalysisRegion(
  documentAnalysis,
  {
    regionId = DEFAULT_REGION_ID,
    regionType = DEFAULT_REGION_TYPE
  } = {}
) {
  validateDocumentAnalysis(documentAnalysis);

  const source = documentAnalysis.binaryImage;
  const binaryImage = {
    width: source.width,
    height: source.height,
    data: source.data
  };
  const projection = createHorizontalProjection(binaryImage);
  const candidates = findLineCandidates(projection, {
    axis: "horizontal",
    axisLength: binaryImage.width,
    minCoverageRatio: HORIZONTAL_OUTER_SPAN_COVERAGE_RATIO
  });
  const provenance = freezeValue({
    source: "horizontal-image-evidence",
    method: HORIZONTAL_OUTER_SPAN_METHOD,
    candidateCoverageRatio: HORIZONTAL_OUTER_SPAN_COVERAGE_RATIO,
    candidateCount: candidates.length,
    candidatePositions: candidates.map(candidate => candidate.position)
  });

  if (candidates.length < 2) {
    return freezeValue({
      status: "unavailable",
      reason: "fewer-than-two-horizontal-candidates",
      regions: [],
      provenance,
      diagnostics: [
        {
          type: "horizontal-outer-span-analysis-region-observation",
          status: "unavailable",
          reason: "fewer-than-two-horizontal-candidates",
          provenance
        }
      ]
    });
  }

  const top = candidates[0].start;
  const bottom = candidates[candidates.length - 1].end;
  const bounds = freezeValue({
    top,
    left: 0,
    width: binaryImage.width,
    height: bottom - top + 1
  });
  const dimensions = freezeValue({
    width: bounds.width,
    height: bounds.height
  });
  const coordinateRelationship = freezeValue({
    type: "translation",
    localToBinaryImage: {
      offsetX: 0,
      offsetY: top,
      scaleX: 1,
      scaleY: 1
    },
    binaryImageToLocal: {
      offsetX: 0,
      offsetY: -top,
      scaleX: 1,
      scaleY: 1
    }
  });
  const start = top * binaryImage.width;
  const end = (bottom + 1) * binaryImage.width;
  const regionBinaryImage = freezeValue({
    width: dimensions.width,
    height: dimensions.height,
    data: binaryImage.data.subarray(start, end)
  });
  const regionDiagnostics = freezeValue([
    {
      type: "analysis-region-observation",
      version: 1,
      status: "measured",
      regionId,
      regionType,
      bounds,
      dimensions,
      provenance
    }
  ]);
  const region = freezeValue({
    type: "analysis-region",
    version: 1,
    id: regionId,
    status: "measured",
    regionType,
    bounds,
    dimensions,
    binaryImage: regionBinaryImage,
    coordinateRelationship,
    provenance,
    diagnostics: regionDiagnostics
  });

  return freezeValue({
    status: "available",
    reason: null,
    regions: [region],
    provenance,
    diagnostics: [
      {
        type: "horizontal-outer-span-analysis-region-observation",
        status: "measured",
        bounds,
        dimensions,
        provenance
      }
    ]
  });
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
  if (
    !value
    || typeof value !== "object"
    || ArrayBuffer.isView(value)
    || Object.isFrozen(value)
  ) {
    return value;
  }

  Object.values(value).forEach(freezeValue);
  return Object.freeze(value);
}
