const FORBIDDEN_FIELD_NAMES = new Set([
  "score",
  "confidence",
  "confidencevalue",
  "confidencescore",
  "rank",
  "ranking",
  "recommendation",
  "winner",
  "selection",
  "selectedcandidate",
  "preferredcandidate",
  "selectedlattice",
  "preferredlattice"
]);

export const ARTIFACT_STATUSES = new Set([
  "available",
  "partial",
  "ambiguous",
  "unavailable"
]);

export const COMPONENT_STATUSES = new Set([
  "available",
  "partial",
  "unavailable"
]);

export function validateArtifactBase({ id, status, provenance, diagnostics, reasons }) {
  validateNonEmptyString(id, "id");
  validateStatus(status, ARTIFACT_STATUSES, "status");
  validateDeterministicObject(provenance, "provenance");
  validateDeterministicArray(diagnostics, "diagnostics");
  validateDeterministicArray(reasons, "reasons");

  if (status === "unavailable" && reasons.length === 0) {
    throw new Error("Unavailable artifacts require at least one reason");
  }
}

export function validateCoordinateSystem(coordinateSystem) {
  validateDeterministicObject(coordinateSystem, "coordinateSystem");
  validateNonEmptyString(coordinateSystem.space, "coordinateSystem.space");
  validateNonEmptyString(coordinateSystem.unit, "coordinateSystem.unit");

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
}

export function validateEvidenceReferences(references, path = "evidenceReferences") {
  if (!Array.isArray(references)) {
    throw new Error(`${path} must be an array`);
  }

  const seen = new Set();
  references.forEach((reference, index) => {
    validateNonEmptyString(reference, `${path}[${index}]`);
    if (seen.has(reference)) {
      throw new Error(`${path} must not contain duplicate references`);
    }
    seen.add(reference);
  });
}

export function validateAxisPair(axes, validateAxis) {
  validateDeterministicObject(axes, "axes");
  for (const axis of ["horizontal", "vertical"]) {
    validateAxis(axes[axis], axis, `axes.${axis}`);
  }
}

export function validateComponentStatus(component, path) {
  validateDeterministicObject(component, path);
  validateStatus(component.status, COMPONENT_STATUSES, `${path}.status`);
}

export function validateStrictlyIncreasingFiniteNumbers(values, path) {
  if (!Array.isArray(values)) {
    throw new Error(`${path} must be an array`);
  }

  values.forEach((value, index) => {
    validateFiniteNumber(value, `${path}[${index}]`);
    if (index > 0 && value <= values[index - 1]) {
      throw new Error(`${path} must be strictly increasing`);
    }
  });
}

export function validateFiniteNumber(value, path) {
  if (!Number.isFinite(value)) {
    throw new Error(`${path} must be finite`);
  }
}

export function validatePositiveNumber(value, path) {
  validateFiniteNumber(value, path);
  if (value <= 0) {
    throw new Error(`${path} must be greater than zero`);
  }
}

export function validateNonEmptyString(value, path) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${path} must be a non-empty string`);
  }
}

export function validateStatus(value, allowed, path) {
  if (!allowed.has(value)) {
    throw new Error(`${path} is invalid`);
  }
}

export function validateDeterministicObject(value, path) {
  if (!isPlainObject(value)) {
    throw new Error(`${path} must be an object`);
  }
  validateDeterministicValue(value, path);
}

export function validateDeterministicArray(value, path) {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array`);
  }
  validateDeterministicValue(value, path);
}

export function validateDeterministicValue(value, path, ancestors = new Set()) {
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
    value.forEach((entry, index) => (
      validateDeterministicValue(entry, `${path}[${index}]`, ancestors)
    ));
  } else {
    Object.keys(value).forEach(key => (
      validateDeterministicValue(value[key], `${path}.${key}`, ancestors)
    ));
  }
  ancestors.delete(value);
}

export function rejectEvaluationFields(value, path) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => (
      rejectEvaluationFields(entry, `${path}[${index}]`)
    ));
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  Object.entries(value).forEach(([key, entry]) => {
    const normalized = key.replace(/[-_]/g, "").toLowerCase();
    if (FORBIDDEN_FIELD_NAMES.has(normalized)) {
      throw new Error(`${path}.${key} is not allowed`);
    }
    rejectEvaluationFields(entry, `${path}.${key}`);
  });
}

export function cloneDeterministicValue(value) {
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

export function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
