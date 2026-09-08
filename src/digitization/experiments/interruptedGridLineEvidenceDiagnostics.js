import {
  createGridLineObservations
} from "../analysis/GridLineObservation";
import {
  createGridLineIntersectionObservations
} from "../analysis/GridLineIntersectionObservation";
import {
  createHorizontalProjection,
  createVerticalProjection
} from "../analysis/Projection";

const ALLOWED_ENVIRONMENTS = new Set(["development", "test"]);
const AXES = Object.freeze(["horizontal", "vertical"]);
const VERTICAL_CONTINUITY_EXPERIMENT_ID =
  "vertical-continuity-diagnostics";
const VERTICAL_COMPONENT_EXPERIMENT_ID = "vertical-line-mask-diagnostics";

export const interruptedGridLineEvidenceDiagnosticsExperiment = Object.freeze({
  id: "interrupted-grid-line-evidence-diagnostics",
  description: "Compare pre-admission projection, continuity, component and orthogonal-intersection evidence without changing candidate admission.",
  run(binaryImage, context = {}, execution) {
    return createInterruptedGridLineEvidenceDiagnostics({
      binaryImage,
      analysisContext: context,
      continuityDiagnostics: execution?.getSuccessfulDiagnostics?.(
        VERTICAL_CONTINUITY_EXPERIMENT_ID
      ) ?? null,
      componentDiagnostics: execution?.getSuccessfulDiagnostics?.(
        VERTICAL_COMPONENT_EXPERIMENT_ID
      ) ?? null
    });
  }
});

export function createInterruptedGridLineEvidenceDiagnostics({
  binaryImage,
  analysisContext = {},
  continuityDiagnostics = null,
  componentDiagnostics = null,
  readEnvironment = () => process.env.NODE_ENV
} = {}) {
  assertDevelopmentEnvironment(readEnvironment());
  const stableBinaryImage = snapshotBinaryImage(binaryImage);
  const projections = snapshotProjections(
    analysisContext.projections,
    stableBinaryImage
  );
  const analysisRegion = createAnalysisRegionEvidence({
    binaryImage: stableBinaryImage,
    coordinateProvenance: analysisContext.coordinateProvenance
  });
  const lineObservations = createGridLineObservations({
    projections,
    binaryImage: stableBinaryImage,
    analysisRegion
  });
  const intersections = createGridLineIntersectionObservations({
    lineObservations,
    binaryImage: stableBinaryImage
  });
  const intersectionEvidence = summarizeIntersections({
    lineObservations,
    intersections
  });
  const labProfiles = {
    verticalContinuityScores: readVisualizationSeries(
      continuityDiagnostics,
      "scores"
    ),
    verticalContinuityMask: readVisualizationSeries(
      continuityDiagnostics,
      "mask"
    ),
    verticalComponentMask: readVisualizationSeries(
      componentDiagnostics,
      "mask"
    )
  };
  const axes = Object.fromEntries(AXES.map(axis => [
    axis,
    createAxisEvidence({
      axis,
      observations: lineObservations.axes[axis].observations,
      intersectionEvidence,
      labProfiles,
      binaryImage: stableBinaryImage
    })
  ]));

  return freezeValue({
    type: "interrupted-grid-line-evidence-diagnostics",
    version: 1,
    status: "complete",
    coordinateSpace: lineObservations.coordinateSpace,
    analysisRegionProvenance:
      lineObservations.analysisRegionProvenance,
    currentAdmissionPolicy: {
      type: "whole-axis-projection-coverage",
      coverageRatio: lineObservations.parameters.wholeAxisCoverageRatio,
      behavior: "observed-not-modified"
    },
    sourceArtifacts: {
      lineObservations: {
        type: lineObservations.type,
        version: lineObservations.version,
        status: lineObservations.status
      },
      intersectionObservations: {
        type: intersections.type,
        version: intersections.version,
        status: intersections.status,
        pairCount: intersections.pairCount
      },
      verticalContinuityDiagnostics: createDiagnosticReference(
        continuityDiagnostics,
        VERTICAL_CONTINUITY_EXPERIMENT_ID
      ),
      verticalComponentDiagnostics: createDiagnosticReference(
        componentDiagnostics,
        VERTICAL_COMPONENT_EXPERIMENT_ID
      )
    },
    axes,
    comparisonCohorts: {
      currentRuleSatisfied: AXES.flatMap(axis => (
        axes[axis].observations
          .filter(value => value.wholeAxisRuleSatisfied === true)
          .map(value => value.id)
      )),
      currentRuleNotSatisfied: AXES.flatMap(axis => (
        axes[axis].observations
          .filter(value => value.wholeAxisRuleSatisfied === false)
          .map(value => value.id)
      ))
    },
    diagnostics: [{
      code: "interrupted-grid-line-evidence-is-observational",
      admissionChanged: false,
      classificationApplied: false,
      groundTruthAccessed: false
    }],
    reasons: []
  });
}

function createAxisEvidence({
  axis,
  observations,
  intersectionEvidence,
  labProfiles,
  binaryImage
}) {
  const tangentialLength = axis === "horizontal"
    ? binaryImage.width
    : binaryImage.height;
  const values = observations.map(observation => {
    const intersection = intersectionEvidence.get(observation.id);

    return {
      id: observation.id,
      sourceOrder: observation.sourceOrder,
      axis,
      position: observation.position,
      runStart: observation.runStart,
      runEnd: observation.runEnd,
      thickness: observation.thickness,
      projectionStrength: observation.projectionStrength,
      coverageRatio: observation.coverageRatio,
      neighboringProjectionSamples: cloneValue(
        observation.neighboringProjectionSamples
      ),
      longestContinuousTangentialRun:
        observation.longestContinuousTangentialRun,
      longestContinuousTangentialRunRatio:
        finiteRatio(
          observation.longestContinuousTangentialRun,
          tangentialLength
        ),
      segmentCount: observation.segmentCount,
      wholeAxisRuleSatisfied: observation.wholeAxisRule.satisfied,
      evidenceAvailability: cloneValue(observation.evidenceAvailability),
      intersectionEvidence: cloneValue(intersection),
      labEvidence: createLabEvidence({
        axis,
        observation,
        labProfiles
      }),
      sourceObservationReference: observation.id,
      reasons: cloneValue(observation.reasons)
    };
  });

  return {
    status: "available",
    axis,
    observationCount: values.length,
    currentRuleSatisfiedCount: values.filter(
      value => value.wholeAxisRuleSatisfied === true
    ).length,
    currentRuleNotSatisfiedCount: values.filter(
      value => value.wholeAxisRuleSatisfied === false
    ).length,
    observations: values
  };
}

function summarizeIntersections({ lineObservations, intersections }) {
  const summaries = new Map();
  const admittedIds = new Set(AXES.flatMap(axis => (
    lineObservations.axes[axis].observations
      .filter(value => value.wholeAxisRule.satisfied === true)
      .map(value => value.id)
  )));

  AXES.forEach(axis => {
    lineObservations.axes[axis].observations.forEach(observation => {
      summaries.set(observation.id, {
        status: "available",
        totalCrossingCount: 0,
        strokePresentCount: 0,
        strokeMissingCount: 0,
        unavailableCount: 0,
        strokePresentRatio: null,
        currentRuleSatisfiedPerpendicular: {
          crossingCount: 0,
          strokePresentCount: 0,
          strokeMissingCount: 0,
          unavailableCount: 0,
          strokePresentRatio: null
        }
      });
    });
  });

  intersections.pairs.forEach(pair => {
    AXES.forEach(axis => {
      const perpendicularAxis = axis === "horizontal"
        ? "vertical"
        : "horizontal";
      const sourceId = pair.sourceObservationReferences[axis];
      const perpendicularId =
        pair.sourceObservationReferences[perpendicularAxis];
      const summary = summaries.get(sourceId);
      addCrossing(summary, pair.strokeEvidence.present);
      if (admittedIds.has(perpendicularId)) {
        addCrossing(
          summary.currentRuleSatisfiedPerpendicular,
          pair.strokeEvidence.present
        );
      }
    });
  });

  summaries.forEach(summary => {
    summary.strokePresentRatio = finiteRatio(
      summary.strokePresentCount,
      summary.strokePresentCount + summary.strokeMissingCount
    );
    const admitted = summary.currentRuleSatisfiedPerpendicular;
    admitted.strokePresentRatio = finiteRatio(
      admitted.strokePresentCount,
      admitted.strokePresentCount + admitted.strokeMissingCount
    );
  });

  return summaries;
}

function addCrossing(summary, present) {
  summary.totalCrossingCount += 1;
  if (present === true) {
    summary.strokePresentCount += 1;
  } else if (present === false) {
    summary.strokeMissingCount += 1;
  } else {
    summary.unavailableCount += 1;
  }
}

function createLabEvidence({ axis, observation, labProfiles }) {
  if (axis !== "vertical") {
    return {
      status: "unavailable",
      reason: "existing-lab-continuity-and-component-evidence-is-vertical-only",
      verticalContinuityScores: null,
      verticalContinuityMask: null,
      verticalComponentMask: null
    };
  }

  const result = {
    status: "available",
    reason: null,
    verticalContinuityScores: readProfileRun(
      labProfiles.verticalContinuityScores,
      observation
    ),
    verticalContinuityMask: readProfileRun(
      labProfiles.verticalContinuityMask,
      observation
    ),
    verticalComponentMask: readProfileRun(
      labProfiles.verticalComponentMask,
      observation
    )
  };
  if (Object.values(result).some(value => value?.status === "unavailable")) {
    result.status = "partial";
    result.reason = "one-or-more-existing-lab-profiles-unavailable";
  }
  return result;
}

function readProfileRun(profile, observation) {
  if (!Array.isArray(profile)) {
    return {
      status: "unavailable",
      samples: [],
      maximum: null,
      reason: "profile-unavailable"
    };
  }
  if (
    observation.runStart < 0
    || observation.runEnd >= profile.length
  ) {
    return {
      status: "unavailable",
      samples: [],
      maximum: null,
      reason: "observation-run-outside-profile"
    };
  }
  const samples = profile.slice(
    observation.runStart,
    observation.runEnd + 1
  );
  return {
    status: "available",
    samples,
    maximum: Math.max(...samples),
    reason: null
  };
}

function readVisualizationSeries(diagnostics, seriesId) {
  const visualizations = Array.isArray(diagnostics?.visualizations)
    ? diagnostics.visualizations
    : [];
  for (const visualization of visualizations) {
    const series = visualization?.data?.series?.find(
      value => value?.id === seriesId
    );
    if (Array.isArray(series?.values)) {
      return series.values.slice();
    }
  }
  return null;
}

function createDiagnosticReference(diagnostics, expectedType) {
  return {
    status: diagnostics ? "available" : "unavailable",
    expectedExperimentId: expectedType,
    diagnosticType: diagnostics?.type ?? null
  };
}

function snapshotProjections(source, binaryImage) {
  return {
    horizontal: source?.horizontal
      ? Array.from(source.horizontal)
      : Array.from(createHorizontalProjection(binaryImage)),
    vertical: source?.vertical
      ? Array.from(source.vertical)
      : Array.from(createVerticalProjection(binaryImage))
  };
}

function createAnalysisRegionEvidence({ binaryImage, coordinateProvenance }) {
  const source = coordinateProvenance?.analysisRegion;
  const transform = source?.localToBinaryImage ?? null;
  return {
    id: source?.id ?? null,
    regionType: source?.regionType ?? null,
    bounds: {
      top: transform?.offsetY ?? 0,
      left: transform?.offsetX ?? 0,
      width: binaryImage.width,
      height: binaryImage.height
    },
    coordinateRelationship: {
      type: source?.relationshipType ?? null,
      localToBinaryImage: cloneValue(transform)
    }
  };
}

function snapshotBinaryImage(binaryImage) {
  const width = binaryImage?.width;
  const height = binaryImage?.height;
  const data = binaryImage?.data;
  if (
    !Number.isInteger(width)
    || width <= 0
    || !Number.isInteger(height)
    || height <= 0
    || !data
    || data.length !== width * height
  ) {
    throw new Error("BinaryImage is required");
  }
  return { width, height, data };
}

function finiteRatio(value, total) {
  return Number.isFinite(value) && Number.isFinite(total) && total > 0
    ? value / total
    : null;
}

function assertDevelopmentEnvironment(environment) {
  if (!ALLOWED_ENVIRONMENTS.has(environment)) {
    throw new Error(
      "Interrupted grid-line evidence diagnostics are available only in development or test"
    );
  }
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(
      ([key, nested]) => [key, cloneValue(nested)]
    ));
  }
  return value;
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
