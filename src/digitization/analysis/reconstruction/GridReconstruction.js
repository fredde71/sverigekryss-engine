const GRID_RECONSTRUCTION_VERSION = 1;
const RESULT_STATUSES = new Set([
  "available",
  "partial",
  "ambiguous",
  "unavailable"
]);
const AXIS_STATUSES = new Set(["available", "ambiguous", "unavailable"]);
const BOUNDS_STATUSES = new Set(["available", "partial", "unavailable"]);
const LINE_EVIDENCE_STATUSES = new Set(["observed-aligned", "inferred"]);
const FORBIDDEN_FIELD_NAMES = new Set([
  "score",
  "confidence",
  "rank",
  "ranking",
  "recommendation",
  "winner",
  "selection",
  "selectedhypothesis",
  "preferredhypothesis",
  "selectedregion",
  "preferredregion"
]);

export function createGridReconstruction({
  candidateEvidence,
  observedBounds,
  spacingEvidence,
  coordinateSystem,
  parameters,
  status,
  assumptions = [],
  axes,
  gridHypotheses = [],
  diagnostics = [],
  reasons = []
} = {}) {
  validateCandidateEvidence(candidateEvidence);
  validateCoordinateSystem(coordinateSystem);
  validateObservedBounds(observedBounds, coordinateSystem.space);
  validateSpacingEvidence(spacingEvidence);
  validateParameters(parameters);
  validateStatus(status, RESULT_STATUSES, "status");
  validateAssumptions(assumptions);
  validateAxes(axes);
  validateGridHypotheses(gridHypotheses);
  validateDiagnostics(diagnostics, "diagnostics");
  validateReasons(reasons);
  validateResultState({ status, axes, gridHypotheses, reasons });

  const result = {
    type: "grid-reconstruction",
    version: GRID_RECONSTRUCTION_VERSION,
    status,
    analysisRegionId: candidateEvidence.analysisRegionId,
    coordinateSystem: cloneDeterministicValue(coordinateSystem),
    observations: {
      rawCandidates: {
        horizontal: cloneDeterministicValue(candidateEvidence.horizontal),
        vertical: cloneDeterministicValue(candidateEvidence.vertical)
      },
      candidateAcceptancePolicy: cloneDeterministicValue(
        candidateEvidence.acceptancePolicy
      ),
      observedBounds: cloneDeterministicValue(observedBounds),
      spacingEvidence: cloneDeterministicValue(spacingEvidence)
    },
    parameters: cloneDeterministicValue(parameters),
    assumptions: cloneDeterministicValue(assumptions),
    axes: cloneDeterministicValue(axes),
    gridHypotheses: cloneDeterministicValue(gridHypotheses),
    diagnostics: cloneDeterministicValue(diagnostics),
    reasons: cloneDeterministicValue(reasons)
  };

  rejectForbiddenFields(result, "gridReconstruction");
  return deepFreeze(result);
}

function validateCandidateEvidence(candidateEvidence) {
  if (!isPlainObject(candidateEvidence)) {
    throw new Error("candidateEvidence must be an object");
  }

  validateNonEmptyString(
    candidateEvidence.analysisRegionId,
    "candidateEvidence.analysisRegionId"
  );

  if (!isPlainObject(candidateEvidence.acceptancePolicy)) {
    throw new Error("candidateEvidence.acceptancePolicy must be an object");
  }

  validateNonEmptyString(
    candidateEvidence.acceptancePolicy.source,
    "candidateEvidence.acceptancePolicy.source"
  );

  if (!isPlainObject(candidateEvidence.acceptancePolicy.parameters)) {
    throw new Error(
      "candidateEvidence.acceptancePolicy.parameters must be an object"
    );
  }

  validateDeterministicValue(
    candidateEvidence.acceptancePolicy,
    "candidateEvidence.acceptancePolicy"
  );
  validateCandidateAxis(candidateEvidence.horizontal, "horizontal");
  validateCandidateAxis(candidateEvidence.vertical, "vertical");
  rejectForbiddenFields(candidateEvidence, "candidateEvidence");
}

function validateCandidateAxis(candidates, axis) {
  const path = `candidateEvidence.${axis}`;

  if (!Array.isArray(candidates)) {
    throw new Error(`${path} must be an array`);
  }

  candidates.forEach((candidate, index) => {
    const candidatePath = `${path}[${index}]`;

    if (!isPlainObject(candidate)) {
      throw new Error(`${candidatePath} must be an object`);
    }

    if (candidate.axis !== axis) {
      throw new Error(`${candidatePath}.axis must equal ${axis}`);
    }

    validateFiniteNumber(candidate.position, `${candidatePath}.position`);
    validateOptionalFiniteNumber(candidate.start, `${candidatePath}.start`);
    validateOptionalFiniteNumber(candidate.end, `${candidatePath}.end`);
    validateOptionalNonNegativeNumber(
      candidate.thickness,
      `${candidatePath}.thickness`
    );
    validateOptionalNonNegativeNumber(
      candidate.strength,
      `${candidatePath}.strength`
    );
    validateOptionalNonNegativeNumber(
      candidate.averageStrength,
      `${candidatePath}.averageStrength`
    );
    validateDeterministicValue(candidate, candidatePath);
  });
}

function validateCoordinateSystem(coordinateSystem) {
  if (!isPlainObject(coordinateSystem)) {
    throw new Error("coordinateSystem must be an object");
  }

  validateNonEmptyString(coordinateSystem.space, "coordinateSystem.space");

  if (coordinateSystem.origin !== "top-left") {
    throw new Error("coordinateSystem.origin must equal top-left");
  }

  if (coordinateSystem.xDirection !== "right") {
    throw new Error("coordinateSystem.xDirection must equal right");
  }

  if (coordinateSystem.yDirection !== "down") {
    throw new Error("coordinateSystem.yDirection must equal down");
  }

  if (coordinateSystem.linePosition !== "visual-line-center") {
    throw new Error(
      "coordinateSystem.linePosition must equal visual-line-center"
    );
  }

  const transform = coordinateSystem.localToBinaryImage;

  if (!isPlainObject(transform)) {
    throw new Error("coordinateSystem.localToBinaryImage must be an object");
  }

  validateFiniteNumber(transform.offsetX, "coordinateSystem.localToBinaryImage.offsetX");
  validateFiniteNumber(transform.offsetY, "coordinateSystem.localToBinaryImage.offsetY");
  validatePositiveNumber(transform.scaleX, "coordinateSystem.localToBinaryImage.scaleX");
  validatePositiveNumber(transform.scaleY, "coordinateSystem.localToBinaryImage.scaleY");
  validateDeterministicValue(coordinateSystem, "coordinateSystem");
  rejectForbiddenFields(coordinateSystem, "coordinateSystem");
}

function validateObservedBounds(observedBounds, coordinateSpace) {
  if (!isPlainObject(observedBounds)) {
    throw new Error("observedBounds must be an object");
  }

  validateStatus(observedBounds.status, BOUNDS_STATUSES, "observedBounds.status");

  if (observedBounds.coordinateSpace !== coordinateSpace) {
    throw new Error(
      "observedBounds.coordinateSpace must match coordinateSystem.space"
    );
  }

  if (observedBounds.semantics !== "outer-line-center-envelope") {
    throw new Error(
      "observedBounds.semantics must equal outer-line-center-envelope"
    );
  }

  if (observedBounds.status === "unavailable") {
    if (observedBounds.value !== null) {
      throw new Error("Unavailable observedBounds.value must be null");
    }

    validateNonEmptyString(observedBounds.reason, "observedBounds.reason");
  } else {
    validateBoundsValue(
      observedBounds.value,
      observedBounds.status === "partial",
      "observedBounds.value"
    );
  }

  if (observedBounds.components !== undefined) {
    if (!isPlainObject(observedBounds.components)) {
      throw new Error("observedBounds.components must be an object");
    }

    validateDeterministicValue(
      observedBounds.components,
      "observedBounds.components"
    );
  }

  validateDeterministicValue(observedBounds, "observedBounds");
  rejectForbiddenFields(observedBounds, "observedBounds");
}

function validateBoundsValue(bounds, allowMissing, path) {
  if (!isPlainObject(bounds)) {
    throw new Error(`${path} must be an object`);
  }

  let availableCount = 0;

  for (const component of ["top", "left", "width", "height"]) {
    const value = bounds[component];

    if (allowMissing && value === null) {
      continue;
    }

    validateFiniteNumber(value, `${path}.${component}`);

    if ((component === "width" || component === "height") && value <= 0) {
      throw new Error(`${path}.${component} must be greater than zero`);
    }

    availableCount += 1;
  }

  if (allowMissing && (availableCount === 0 || availableCount === 4)) {
    throw new Error(`${path} must contain both available and unavailable components`);
  }
}

function validateSpacingEvidence(spacingEvidence) {
  if (!isPlainObject(spacingEvidence)) {
    throw new Error("spacingEvidence must be an object");
  }

  for (const axis of ["horizontal", "vertical"]) {
    if (!Array.isArray(spacingEvidence[axis])) {
      throw new Error(`spacingEvidence.${axis} must be an array`);
    }
  }

  validateDeterministicValue(spacingEvidence, "spacingEvidence");
  rejectForbiddenFields(spacingEvidence, "spacingEvidence");
}

function validateParameters(parameters) {
  if (!isPlainObject(parameters)) {
    throw new Error("parameters must be an object");
  }

  validateNonEmptyString(parameters.strategyId, "parameters.strategyId");
  validatePositiveInteger(
    parameters.minimumObservedCandidatesPerAxis,
    "parameters.minimumObservedCandidatesPerAxis"
  );
  validateRange(
    parameters.permittedIntervalCount,
    "parameters.permittedIntervalCount",
    validatePositiveInteger
  );
  validateRange(
    parameters.permittedCellSpacing,
    "parameters.permittedCellSpacing",
    validatePositiveNumber
  );
  validateNonNegativeInteger(
    parameters.maximumSkippedIntervalsBetweenCandidates,
    "parameters.maximumSkippedIntervalsBetweenCandidates"
  );
  validateNonNegativeInteger(
    parameters.maximumConsecutiveInferredLines,
    "parameters.maximumConsecutiveInferredLines"
  );
  validateRatio(
    parameters.maximumInferredLineFraction,
    "parameters.maximumInferredLineFraction"
  );
  validateNonNegativeNumber(
    parameters.candidateAlignmentTolerancePx,
    "parameters.candidateAlignmentTolerancePx"
  );
  validateNonNegativeNumber(
    parameters.boundsAlignmentTolerancePx,
    "parameters.boundsAlignmentTolerancePx"
  );

  if (parameters.positionQuantum !== null) {
    validatePositiveNumber(parameters.positionQuantum, "parameters.positionQuantum");
  }

  validatePositiveInteger(
    parameters.maximumHypothesisCount,
    "parameters.maximumHypothesisCount"
  );
  validateDeterministicValue(parameters, "parameters");
  rejectForbiddenFields(parameters, "parameters");
}

function validateRange(range, path, validateEndpoint) {
  if (!isPlainObject(range)) {
    throw new Error(`${path} must be an object`);
  }

  validateEndpoint(range.minimum, `${path}.minimum`);
  validateEndpoint(range.maximum, `${path}.maximum`);

  if (range.maximum < range.minimum) {
    throw new Error(`${path}.maximum must be at least minimum`);
  }
}

function validateAssumptions(assumptions) {
  if (!Array.isArray(assumptions)) {
    throw new Error("assumptions must be an array");
  }

  assumptions.forEach((assumption, index) => {
    if (!isPlainObject(assumption)) {
      throw new Error(`assumptions[${index}] must be an object`);
    }

    validateNonEmptyString(assumption.id, `assumptions[${index}].id`);
    validateNonEmptyString(assumption.status, `assumptions[${index}].status`);
    validateDeterministicValue(assumption, `assumptions[${index}]`);
  });

  rejectForbiddenFields(assumptions, "assumptions");
}

function validateAxes(axes) {
  if (!isPlainObject(axes)) {
    throw new Error("axes must be an object");
  }

  for (const axis of ["horizontal", "vertical"]) {
    const axisResult = axes[axis];
    const path = `axes.${axis}`;

    if (!isPlainObject(axisResult)) {
      throw new Error(`${path} must be an object`);
    }

    validateStatus(axisResult.status, AXIS_STATUSES, `${path}.status`);

    if (!Array.isArray(axisResult.hypotheses)) {
      throw new Error(`${path}.hypotheses must be an array`);
    }

    const ids = new Set();

    axisResult.hypotheses.forEach((hypothesis, index) => {
      validateAxisHypothesis(hypothesis, `${path}.hypotheses[${index}]`);

      if (ids.has(hypothesis.id)) {
        throw new Error(`${path}.hypotheses must have unique ids`);
      }

      ids.add(hypothesis.id);
    });

    if (axisResult.status === "unavailable" && axisResult.hypotheses.length !== 0) {
      throw new Error(`${path} unavailable status cannot contain hypotheses`);
    }

    if (axisResult.status === "available" && axisResult.hypotheses.length !== 1) {
      throw new Error(`${path} available status requires exactly one hypothesis`);
    }

    if (axisResult.status === "ambiguous" && axisResult.hypotheses.length < 2) {
      throw new Error(`${path} ambiguous status requires multiple hypotheses`);
    }
  }

  rejectForbiddenFields(axes, "axes");
}

function validateAxisHypothesis(hypothesis, path) {
  if (!isPlainObject(hypothesis)) {
    throw new Error(`${path} must be an object`);
  }

  validateNonEmptyString(hypothesis.id, `${path}.id`);
  validatePositiveInteger(hypothesis.intervalCount, `${path}.intervalCount`);
  validateFiniteNumber(hypothesis.origin, `${path}.origin`);
  validatePositiveNumber(hypothesis.spacing, `${path}.spacing`);
  validateReconstructedLines(
    hypothesis.lines,
    hypothesis.intervalCount,
    `${path}.lines`
  );

  if (!Array.isArray(hypothesis.candidateAssignments)) {
    throw new Error(`${path}.candidateAssignments must be an array`);
  }

  validateDeterministicValue(
    hypothesis.candidateAssignments,
    `${path}.candidateAssignments`
  );
  validateDiagnostics(hypothesis.diagnostics, `${path}.diagnostics`);
}

function validateGridHypotheses(gridHypotheses) {
  if (!Array.isArray(gridHypotheses)) {
    throw new Error("gridHypotheses must be an array");
  }

  const ids = new Set();

  gridHypotheses.forEach((hypothesis, index) => {
    const path = `gridHypotheses[${index}]`;

    if (!isPlainObject(hypothesis)) {
      throw new Error(`${path} must be an object`);
    }

    validateNonEmptyString(hypothesis.id, `${path}.id`);
    validateNonEmptyString(
      hypothesis.horizontalHypothesisId,
      `${path}.horizontalHypothesisId`
    );
    validateNonEmptyString(
      hypothesis.verticalHypothesisId,
      `${path}.verticalHypothesisId`
    );
    validatePositiveInteger(hypothesis.rows, `${path}.rows`);
    validatePositiveInteger(hypothesis.cols, `${path}.cols`);
    validateBoundsValue(hypothesis.bounds, false, `${path}.bounds`);

    if (!isPlainObject(hypothesis.lines)) {
      throw new Error(`${path}.lines must be an object`);
    }

    validateReconstructedLines(
      hypothesis.lines.horizontal,
      hypothesis.rows,
      `${path}.lines.horizontal`
    );
    validateReconstructedLines(
      hypothesis.lines.vertical,
      hypothesis.cols,
      `${path}.lines.vertical`
    );

    if (!isPlainObject(hypothesis.candidateAssignments)) {
      throw new Error(`${path}.candidateAssignments must be an object`);
    }

    for (const axis of ["horizontal", "vertical"]) {
      if (!Array.isArray(hypothesis.candidateAssignments[axis])) {
        throw new Error(`${path}.candidateAssignments.${axis} must be an array`);
      }
    }

    validateDeterministicValue(
      hypothesis.candidateAssignments,
      `${path}.candidateAssignments`
    );
    validateDiagnostics(hypothesis.diagnostics, `${path}.diagnostics`);

    if (ids.has(hypothesis.id)) {
      throw new Error("gridHypotheses must have unique ids");
    }

    ids.add(hypothesis.id);
  });

  rejectForbiddenFields(gridHypotheses, "gridHypotheses");
}

function validateReconstructedLines(lines, intervalCount, path) {
  if (!Array.isArray(lines) || lines.length !== intervalCount + 1) {
    throw new Error(`${path} must contain intervalCount + 1 lines`);
  }

  let previousPosition = null;

  lines.forEach((line, index) => {
    const linePath = `${path}[${index}]`;

    if (!isPlainObject(line)) {
      throw new Error(`${linePath} must be an object`);
    }

    if (line.index !== index) {
      throw new Error(`${linePath}.index must equal its ordered index`);
    }

    validateFiniteNumber(line.position, `${linePath}.position`);

    if (previousPosition !== null && line.position <= previousPosition) {
      throw new Error(`${path} positions must be strictly increasing`);
    }

    validateLineEvidence(line.evidence, `${linePath}.evidence`);
    previousPosition = line.position;
  });
}

function validateLineEvidence(evidence, path) {
  if (!isPlainObject(evidence)) {
    throw new Error(`${path} must be an object`);
  }

  validateStatus(evidence.status, LINE_EVIDENCE_STATUSES, `${path}.status`);

  if (evidence.status === "inferred") {
    for (const field of ["candidateIndex", "observedPosition", "delta"]) {
      if (evidence[field] !== null) {
        throw new Error(`${path}.${field} must be null for inferred lines`);
      }
    }
  } else {
    validateNonNegativeInteger(evidence.candidateIndex, `${path}.candidateIndex`);
    validateFiniteNumber(evidence.observedPosition, `${path}.observedPosition`);
    validateFiniteNumber(evidence.delta, `${path}.delta`);
  }

  validateDeterministicValue(evidence, path);
}

function validateDiagnostics(diagnostics, path) {
  if (!Array.isArray(diagnostics)) {
    throw new Error(`${path} must be an array`);
  }

  diagnostics.forEach((diagnostic, index) => {
    const diagnosticPath = `${path}[${index}]`;

    if (!isPlainObject(diagnostic)) {
      throw new Error(`${diagnosticPath} must be an object`);
    }

    validateNonEmptyString(diagnostic.type, `${diagnosticPath}.type`);
    validateDeterministicValue(diagnostic, diagnosticPath);
  });

  rejectForbiddenFields(diagnostics, path);
}

function validateReasons(reasons) {
  if (!Array.isArray(reasons)) {
    throw new Error("reasons must be an array");
  }

  reasons.forEach((reason, index) => {
    const path = `reasons[${index}]`;

    if (typeof reason === "string") {
      validateNonEmptyString(reason, path);
      return;
    }

    if (!isPlainObject(reason)) {
      throw new Error(`${path} must be a string or object`);
    }

    validateNonEmptyString(reason.code, `${path}.code`);
    validateDeterministicValue(reason, path);
  });

  rejectForbiddenFields(reasons, "reasons");
}

function validateResultState({ status, axes, gridHypotheses, reasons }) {
  const horizontalAvailable = axes.horizontal.status !== "unavailable";
  const verticalAvailable = axes.vertical.status !== "unavailable";

  if (status === "available") {
    if (
      axes.horizontal.status !== "available"
      || axes.vertical.status !== "available"
      || gridHypotheses.length !== 1
    ) {
      throw new Error(
        "Available reconstruction requires one available hypothesis per axis and one grid hypothesis"
      );
    }
  }

  if (status === "partial") {
    if (horizontalAvailable === verticalAvailable || gridHypotheses.length !== 0) {
      throw new Error(
        "Partial reconstruction requires exactly one available axis and no grid hypotheses"
      );
    }
  }

  if (status === "ambiguous") {
    if (!horizontalAvailable || !verticalAvailable) {
      throw new Error("Ambiguous reconstruction requires evidence on both axes");
    }

    if (
      axes.horizontal.status !== "ambiguous"
      && axes.vertical.status !== "ambiguous"
      && gridHypotheses.length < 2
    ) {
      throw new Error("Ambiguous reconstruction requires multiple hypotheses");
    }
  }

  if (status === "unavailable" && gridHypotheses.length !== 0) {
    throw new Error("Unavailable reconstruction cannot contain grid hypotheses");
  }

  if (status !== "available" && reasons.length === 0) {
    throw new Error(`${status} reconstruction requires at least one reason`);
  }
}

function validateDeterministicValue(value, path, ancestors = new Set()) {
  if (
    value === null
    || typeof value === "string"
    || typeof value === "boolean"
  ) {
    return;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`${path} must contain only finite numbers`);
    }
    return;
  }

  if (typeof value !== "object") {
    throw new Error(`${path} must contain only deterministic JSON values`);
  }

  if (ancestors.has(value)) {
    throw new Error(`${path} must not contain circular references`);
  }

  if (!Array.isArray(value) && !isPlainObject(value)) {
    throw new Error(`${path} must contain only arrays and plain objects`);
  }

  ancestors.add(value);

  if (Array.isArray(value)) {
    value.forEach((nested, index) => (
      validateDeterministicValue(nested, `${path}[${index}]`, ancestors)
    ));
  } else {
    Object.keys(value).forEach(key => (
      validateDeterministicValue(value[key], `${path}.${key}`, ancestors)
    ));
  }

  ancestors.delete(value);
}

function rejectForbiddenFields(value, path) {
  if (Array.isArray(value)) {
    value.forEach((nested, index) => rejectForbiddenFields(nested, `${path}[${index}]`));
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  for (const [key, nested] of Object.entries(value)) {
    const normalizedKey = key.replace(/[-_]/g, "").toLowerCase();

    if (FORBIDDEN_FIELD_NAMES.has(normalizedKey)) {
      throw new Error(`${path}.${key} is not allowed in GridReconstruction`);
    }

    rejectForbiddenFields(nested, `${path}.${key}`);
  }
}

function cloneDeterministicValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneDeterministicValue);
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, cloneDeterministicValue(value[key])])
    );
  }

  return value;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function validateStatus(status, allowed, path) {
  if (!allowed.has(status)) {
    throw new Error(`${path} is invalid`);
  }
}

function validateNonEmptyString(value, path) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${path} must be a non-empty string`);
  }
}

function validateFiniteNumber(value, path) {
  if (!Number.isFinite(value)) {
    throw new Error(`${path} must be finite`);
  }
}

function validateOptionalFiniteNumber(value, path) {
  if (value !== undefined) {
    validateFiniteNumber(value, path);
  }
}

function validatePositiveNumber(value, path) {
  validateFiniteNumber(value, path);

  if (value <= 0) {
    throw new Error(`${path} must be greater than zero`);
  }
}

function validateNonNegativeNumber(value, path) {
  validateFiniteNumber(value, path);

  if (value < 0) {
    throw new Error(`${path} must be non-negative`);
  }
}

function validateOptionalNonNegativeNumber(value, path) {
  if (value !== undefined) {
    validateNonNegativeNumber(value, path);
  }
}

function validatePositiveInteger(value, path) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${path} must be a positive integer`);
  }
}

function validateNonNegativeInteger(value, path) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${path} must be a non-negative integer`);
  }
}

function validateRatio(value, path) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${path} must be between zero and one`);
  }
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
