import {
  cloneDeterministicValue,
  deepFreeze,
  validateDeterministicObject,
  validateNonEmptyString,
  validateStrictlyIncreasingFiniteNumbers
} from "./GridLatticeModelSupport";

const VERSION = 1;
const AXES = ["horizontal", "vertical"];

export function createGridFormatGeometry({
  id,
  gridDimensions,
  axes,
  provenance = {}
} = {}) {
  validateNonEmptyString(id, "id");
  validateGridDimensions(gridDimensions);
  validateDeterministicObject(axes, "axes");
  validateDeterministicObject(provenance, "provenance");

  AXES.forEach(axis => validateAxisGeometry({
    axis,
    value: axes[axis],
    expectedLineCount: lineCountForAxis(gridDimensions, axis)
  }));

  return deepFreeze({
    type: "grid-format-geometry",
    version: VERSION,
    id,
    coordinateSpace: "normalized-grid-format",
    gridDimensions: cloneDeterministicValue(gridDimensions),
    axes: cloneDeterministicValue(axes),
    provenance: cloneDeterministicValue(provenance)
  });
}

function validateGridDimensions(value) {
  validateDeterministicObject(value, "gridDimensions");
  for (const field of ["rows", "cols"]) {
    if (!Number.isInteger(value[field]) || value[field] <= 0) {
      throw new Error(`gridDimensions.${field} must be a positive integer`);
    }
  }
}

function validateAxisGeometry({ axis, value, expectedLineCount }) {
  validateDeterministicObject(value, `axes.${axis}`);
  const positions = value.normalizedLinePositions;
  validateStrictlyIncreasingFiniteNumbers(
    positions,
    `axes.${axis}.normalizedLinePositions`
  );

  if (positions.length !== expectedLineCount) {
    throw new Error(
      `axes.${axis}.normalizedLinePositions must contain ${expectedLineCount} positions`
    );
  }
  if (positions[0] !== 0 || positions[positions.length - 1] !== 1) {
    throw new Error(
      `axes.${axis}.normalizedLinePositions must start at 0 and end at 1`
    );
  }
}

function lineCountForAxis(gridDimensions, axis) {
  return (axis === "horizontal"
    ? gridDimensions.rows
    : gridDimensions.cols) + 1;
}
