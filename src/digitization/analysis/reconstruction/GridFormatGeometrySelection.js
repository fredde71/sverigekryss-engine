import {
  cloneDeterministicValue,
  deepFreeze,
  validateDeterministicObject
} from "./GridLatticeModelSupport";
import { GRID_FORMAT_GEOMETRY_CATALOG } from "./GridFormatGeometryCatalog";

const VERSION = 1;
const AXES = ["horizontal", "vertical"];

export function selectGridFormatGeometry({
  gridDimensions,
  acceptedIndexedAnchors,
  catalog = GRID_FORMAT_GEOMETRY_CATALOG
} = {}) {
  validateGridDimensions(gridDimensions);
  validateCatalog(catalog);
  const axes = normalizeAnchorEvidence({
    gridDimensions,
    acceptedIndexedAnchors
  });
  const compatibleFormats = catalog.formats.filter(format => (
    format.gridDimensions.rows === gridDimensions.rows
    && format.gridDimensions.cols === gridDimensions.cols
  ));
  const evidenceUnavailable = AXES.some(axis => axes[axis].status !== "available");
  const evaluations = evidenceUnavailable
    ? []
    : compatibleFormats.map((format, catalogOrder) => evaluateFormat({
      format,
      catalogOrder,
      axes
    }));
  const minimumEvaluations = findMinimumEvaluations(evaluations);
  const status = evidenceUnavailable || compatibleFormats.length === 0
    ? "unavailable"
    : minimumEvaluations.length === 1
      ? "selected"
      : "ambiguous";
  const selectedEvaluation = status === "selected"
    ? minimumEvaluations[0]
    : null;
  const reasons = createReasons({
    status,
    axes,
    compatibleFormats,
    minimumEvaluations
  });

  return deepFreeze({
    type: "grid-format-geometry-selection",
    version: VERSION,
    status,
    catalogId: catalog.id,
    gridDimensions: cloneDeterministicValue(gridDimensions),
    acceptedIndexedAnchors: cloneDeterministicValue(acceptedIndexedAnchors),
    normalizedAnchorEvidence: axes,
    evaluations,
    selectedFormatId: selectedEvaluation?.formatId ?? null,
    selectedFormat: selectedEvaluation
      ? catalog.formats[selectedEvaluation.catalogOrder]
      : null,
    competingFormatIds: minimumEvaluations.map(value => value.formatId),
    decisionPolicy: {
      compatibleDimensionsRequired: true,
      requiredAnchorEvidence:
        "both-outer-indexes-and-at-least-one-interior-index-per-axis",
      comparisonOrder: [
        "maximumAbsoluteNormalizedResidual",
        "rmsNormalizedResidual",
        "averageAbsoluteNormalizedResidual"
      ],
      exactComparison: true,
      exactTiesRemainAmbiguous: true
    },
    provenance: {
      source: "accepted-indexed-grid-line-anchors",
      catalogId: catalog.id
    },
    reasons
  });
}

function normalizeAnchorEvidence({ gridDimensions, acceptedIndexedAnchors }) {
  validateDeterministicObject(
    acceptedIndexedAnchors,
    "acceptedIndexedAnchors"
  );

  return deepFreeze(Object.fromEntries(AXES.map(axis => [
    axis,
    normalizeAxisAnchors({
      axis,
      anchors: acceptedIndexedAnchors[axis],
      intervalCount: axis === "horizontal"
        ? gridDimensions.rows
        : gridDimensions.cols
    })
  ])));
}

function normalizeAxisAnchors({ axis, anchors, intervalCount }) {
  if (!Array.isArray(anchors)) {
    throw new Error(`acceptedIndexedAnchors.${axis} must be an array`);
  }

  let previousIndex = -1;
  let previousPosition = -Infinity;
  anchors.forEach((anchor, order) => {
    validateDeterministicObject(
      anchor,
      `acceptedIndexedAnchors.${axis}[${order}]`
    );
    if (
      !Number.isInteger(anchor.latticeIndex)
      || anchor.latticeIndex < 0
      || anchor.latticeIndex > intervalCount
    ) {
      throw new Error(
        `acceptedIndexedAnchors.${axis}[${order}].latticeIndex is invalid`
      );
    }
    if (!Number.isFinite(anchor.observedPosition)) {
      throw new Error(
        `acceptedIndexedAnchors.${axis}[${order}].observedPosition must be finite`
      );
    }
    if (anchor.latticeIndex <= previousIndex) {
      throw new Error(`acceptedIndexedAnchors.${axis} indexes must increase`);
    }
    if (anchor.observedPosition <= previousPosition) {
      throw new Error(`acceptedIndexedAnchors.${axis} positions must increase`);
    }
    previousIndex = anchor.latticeIndex;
    previousPosition = anchor.observedPosition;
  });

  const start = anchors.find(anchor => anchor.latticeIndex === 0);
  const end = anchors.find(anchor => anchor.latticeIndex === intervalCount);
  const interiorCount = anchors.filter(anchor => (
    anchor.latticeIndex > 0 && anchor.latticeIndex < intervalCount
  )).length;
  const available = Boolean(
    start
    && end
    && end.observedPosition > start.observedPosition
    && interiorCount > 0
  );

  return {
    axis,
    status: available ? "available" : "unavailable",
    intervalCount,
    observedStart: start?.observedPosition ?? null,
    observedEnd: end?.observedPosition ?? null,
    observedSpan: start && end
      ? end.observedPosition - start.observedPosition
      : null,
    anchors: available
      ? anchors.map(anchor => ({
        latticeIndex: anchor.latticeIndex,
        observedPosition: anchor.observedPosition,
        normalizedPosition: (
          (anchor.observedPosition - start.observedPosition)
          / (end.observedPosition - start.observedPosition)
        ),
        evidenceReferences: Array.isArray(anchor.evidenceReferences)
          ? anchor.evidenceReferences.slice()
          : []
      }))
      : [],
    reasons: available
      ? []
      : ["outer-and-interior-indexed-anchor-evidence-required"]
  };
}

function evaluateFormat({ format, catalogOrder, axes }) {
  const axisEvaluations = Object.fromEntries(AXES.map(axis => {
    const formatPositions = format.axes[axis].normalizedLinePositions;
    const observations = axes[axis].anchors.map(anchor => {
      const expectedNormalizedPosition = formatPositions[anchor.latticeIndex];
      const residual = anchor.normalizedPosition - expectedNormalizedPosition;
      return {
        latticeIndex: anchor.latticeIndex,
        observedPosition: anchor.observedPosition,
        normalizedPosition: anchor.normalizedPosition,
        expectedNormalizedPosition,
        residual,
        absoluteResidual: Math.abs(residual),
        evidenceReferences: anchor.evidenceReferences.slice()
      };
    });
    return [axis, {
      axis,
      observations,
      ...summarizeResiduals(observations.map(value => value.residual))
    }];
  }));
  const residuals = AXES.flatMap(axis => (
    axisEvaluations[axis].observations.map(value => value.residual)
  ));
  const summary = summarizeResiduals(residuals);

  return {
    formatId: format.id,
    catalogOrder,
    axes: axisEvaluations,
    ...summary,
    comparisonVector: [
      summary.maximumAbsoluteNormalizedResidual,
      summary.rmsNormalizedResidual,
      summary.averageAbsoluteNormalizedResidual
    ],
    provenance: cloneDeterministicValue(format.provenance)
  };
}

function summarizeResiduals(residuals) {
  const absolute = residuals.map(Math.abs);
  return {
    observationCount: residuals.length,
    maximumAbsoluteNormalizedResidual: Math.max(...absolute),
    averageAbsoluteNormalizedResidual:
      absolute.reduce((sum, value) => sum + value, 0) / absolute.length,
    rmsNormalizedResidual: Math.sqrt(
      residuals.reduce((sum, value) => sum + value * value, 0)
      / residuals.length
    )
  };
}

function findMinimumEvaluations(evaluations) {
  if (evaluations.length === 0) {
    return [];
  }
  let minimum = evaluations[0].comparisonVector;
  evaluations.slice(1).forEach(evaluation => {
    if (compareVectors(evaluation.comparisonVector, minimum) < 0) {
      minimum = evaluation.comparisonVector;
    }
  });
  return evaluations.filter(evaluation => (
    compareVectors(evaluation.comparisonVector, minimum) === 0
  ));
}

function compareVectors(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return left[index] < right[index] ? -1 : 1;
    }
  }
  return 0;
}

function createReasons({
  status,
  axes,
  compatibleFormats,
  minimumEvaluations
}) {
  if (status === "selected") {
    return [];
  }
  const unavailableAxes = AXES.filter(axis => axes[axis].status !== "available");
  if (unavailableAxes.length > 0) {
    return unavailableAxes.map(axis => `${axis}-anchor-evidence-unavailable`);
  }
  if (compatibleFormats.length === 0) {
    return ["compatible-grid-format-geometry-unavailable"];
  }
  if (minimumEvaluations.length > 1) {
    return ["grid-format-geometry-evidence-ambiguous"];
  }
  return ["grid-format-geometry-selection-unavailable"];
}

function validateGridDimensions(value) {
  validateDeterministicObject(value, "gridDimensions");
  for (const field of ["rows", "cols"]) {
    if (!Number.isInteger(value[field]) || value[field] <= 0) {
      throw new Error(`gridDimensions.${field} must be a positive integer`);
    }
  }
}

function validateCatalog(value) {
  validateDeterministicObject(value, "catalog");
  if (value.type !== "grid-format-geometry-catalog") {
    throw new Error("catalog must be a GridFormatGeometryCatalog");
  }
  if (!Array.isArray(value.formats)) {
    throw new Error("catalog.formats must be an array");
  }
}
