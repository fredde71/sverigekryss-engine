import {
  cloneDeterministicValue,
  deepFreeze,
  rejectEvaluationFields,
  validateArtifactBase,
  validateAxisPair,
  validateComponentStatus,
  validateCoordinateSystem,
  validateDeterministicArray,
  validateDeterministicObject,
  validateFiniteNumber,
  validateNonEmptyString,
  validatePositiveNumber
} from "./GridLatticeModelSupport";

const VERSION = 1;

export function createGridLattice({
  id,
  status,
  sourceCandidateId,
  coordinateSystem,
  axes,
  gridDimensions = null,
  extent,
  assumptions = [],
  provenance,
  diagnostics = [],
  reasons = []
} = {}) {
  validateArtifactBase({ id, status, provenance, diagnostics, reasons });
  validateNonEmptyString(sourceCandidateId, "sourceCandidateId");
  validateCoordinateSystem(coordinateSystem);
  validateAxisPair(axes, validateLatticeAxis);
  validateGridDimensions(gridDimensions);
  validateExtent(extent, coordinateSystem.space);
  validateLatticeGeometry(axes, gridDimensions, extent);
  validateDeterministicArray(assumptions, "assumptions");

  const result = {
    type: "grid-lattice",
    version: VERSION,
    id,
    status,
    sourceCandidateId,
    coordinateSystem: cloneDeterministicValue(coordinateSystem),
    axes: cloneDeterministicValue(axes),
    gridDimensions: cloneDeterministicValue(gridDimensions),
    extent: cloneDeterministicValue(extent),
    assumptions: cloneDeterministicValue(assumptions),
    provenance: cloneDeterministicValue(provenance),
    diagnostics: cloneDeterministicValue(diagnostics),
    reasons: cloneDeterministicValue(reasons)
  };

  rejectEvaluationFields(result, "gridLattice");
  return deepFreeze(result);
}

function validateGridDimensions(value) {
  if (value === null) {
    return;
  }
  validateDeterministicObject(value, "gridDimensions");
  for (const component of ["rows", "cols"]) {
    if (!Number.isInteger(value[component]) || value[component] <= 0) {
      throw new Error(`gridDimensions.${component} must be a positive integer`);
    }
  }
}

function validateLatticeGeometry(axes, gridDimensions, extent) {
  if (gridDimensions === null) {
    return;
  }
  if (extent.status !== "available") {
    throw new Error("extent must be available when gridDimensions are present");
  }
  const dimensions = {
    horizontal: gridDimensions.rows,
    vertical: gridDimensions.cols
  };
  for (const axis of ["horizontal", "vertical"]) {
    const value = axes[axis];
    const path = `axes.${axis}`;
    if (value.status !== "available") {
      throw new Error(`${path} must be available when gridDimensions are present`);
    }
    if (value.intervalCount !== dimensions[axis]) {
      throw new Error(`${path}.intervalCount must match gridDimensions`);
    }
    if (value.lineCount !== value.intervalCount + 1) {
      throw new Error(`${path}.lineCount must equal intervalCount plus one`);
    }
    validateDeterministicArray(value.positions, `${path}.positions`);
    if (value.positions.length !== value.lineCount) {
      throw new Error(`${path}.positions must contain lineCount positions`);
    }
    value.positions.forEach((position, index) => {
      validateFiniteNumber(position, `${path}.positions[${index}]`);
      if (position !== value.origin + index * value.period) {
        throw new Error(`${path}.positions must follow origin and period`);
      }
    });
  }
  const horizontalEnd = axes.horizontal.positions[
    axes.horizontal.positions.length - 1
  ];
  const verticalEnd = axes.vertical.positions[
    axes.vertical.positions.length - 1
  ];
  if (
    extent.bounds.top !== axes.horizontal.origin
    || extent.bounds.left !== axes.vertical.origin
    || extent.bounds.height !== horizontalEnd - axes.horizontal.origin
    || extent.bounds.width !== verticalEnd - axes.vertical.origin
  ) {
    throw new Error("extent bounds must match the materialized lattice positions");
  }
}

function validateLatticeAxis(value, axis, path) {
  validateComponentStatus(value, path);
  if (value.axis !== axis) {
    throw new Error(`${path}.axis must equal ${axis}`);
  }
  validateDeterministicArray(value.diagnostics, `${path}.diagnostics`);
  if (value.status === "unavailable") {
    if (value.origin !== null || value.period !== null) {
      throw new Error(`${path} unavailable origin and period must be null`);
    }
    return;
  }
  validateFiniteNumber(value.origin, `${path}.origin`);
  validatePositiveNumber(value.period, `${path}.period`);
}

function validateExtent(value, coordinateSpace) {
  validateComponentStatus(value, "extent");
  if (value.coordinateSpace !== coordinateSpace) {
    throw new Error("extent.coordinateSpace must match coordinateSystem.space");
  }
  if (value.status === "unavailable") {
    if (value.bounds !== null) {
      throw new Error("Unavailable extent.bounds must be null");
    }
    return;
  }
  validateDeterministicObject(value.bounds, "extent.bounds");
  validateFiniteNumber(value.bounds.top, "extent.bounds.top");
  validateFiniteNumber(value.bounds.left, "extent.bounds.left");
  validatePositiveNumber(value.bounds.width, "extent.bounds.width");
  validatePositiveNumber(value.bounds.height, "extent.bounds.height");
}
