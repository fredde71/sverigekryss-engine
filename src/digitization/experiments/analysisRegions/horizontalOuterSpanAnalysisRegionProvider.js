import { createHorizontalProjection } from "../../analysis/Projection";
import { findLineCandidates } from "../../analysis/LineCandidate";

const PROVIDER_ID = "horizontal-outer-span";
const CANDIDATE_COVERAGE_RATIO = 0.8;
const SPAN_METHOD = "outermost-horizontal-candidate-runs";

export const horizontalOuterSpanAnalysisRegionProvider = Object.freeze({
  id: PROVIDER_ID,
  description: "Observe a full-width vertical span from the outermost qualifying horizontal candidate runs.",
  run(documentAnalysis) {
    return observeHorizontalOuterSpanAnalysisRegion(documentAnalysis);
  }
});

export function observeHorizontalOuterSpanAnalysisRegion(documentAnalysis) {
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
    minCoverageRatio: CANDIDATE_COVERAGE_RATIO
  });
  const candidatePositions = candidates.map(candidate => candidate.position);
  const provenance = freezeValue({
    source: "horizontal-image-evidence",
    method: SPAN_METHOD,
    candidateCoverageRatio: CANDIDATE_COVERAGE_RATIO,
    candidateCount: candidates.length,
    candidatePositions
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

  const firstCandidate = candidates[0];
  const lastCandidate = candidates[candidates.length - 1];
  const top = firstCandidate.start;
  const bottom = lastCandidate.end;
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
      regionId: `${PROVIDER_ID}-001`,
      regionType: "shadow-observation",
      bounds,
      dimensions,
      provenance
    }
  ]);
  const region = freezeValue({
    type: "analysis-region",
    version: 1,
    id: `${PROVIDER_ID}-001`,
    status: "measured",
    regionType: "shadow-observation",
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
