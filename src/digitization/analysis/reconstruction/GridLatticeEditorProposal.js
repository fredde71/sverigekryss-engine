const RENDERED_BINARY_IMAGE_SPACE = "rendered-binary-image-pixels";
const ANALYSIS_REGION_LOCAL_SPACE = "analysis-region-local";

export function createGridLatticeEditorProposal(lattice) {
  validateAvailableLattice(lattice);

  const rows = lattice.gridDimensions.rows;
  const cols = lattice.gridDimensions.cols;
  const gridArea = mapBoundsToEditorSpace(
    lattice.extent.bounds,
    lattice.coordinateSystem
  );

  return {
    rows,
    cols,
    gridArea,
    cellTypes: Array(rows * cols).fill("empty"),
    competitionCells: []
  };
}

function mapBoundsToEditorSpace(bounds, coordinateSystem) {
  if (coordinateSystem.space === RENDERED_BINARY_IMAGE_SPACE) {
    return cloneBounds(bounds);
  }

  if (coordinateSystem.space !== ANALYSIS_REGION_LOCAL_SPACE) {
    throw new Error("GridLattice coordinate space is not supported by Editor");
  }

  const transform = coordinateSystem.localToBinaryImage;

  validateCoordinateTransform(transform);

  return {
    top: transform.offsetY + bounds.top * transform.scaleY,
    left: transform.offsetX + bounds.left * transform.scaleX,
    width: bounds.width * transform.scaleX,
    height: bounds.height * transform.scaleY
  };
}

function validateAvailableLattice(lattice) {
  if (
    !lattice
    || lattice.type !== "grid-lattice"
    || lattice.status !== "available"
  ) {
    throw new Error("GridLattice must be available");
  }

  const rows = lattice.gridDimensions?.rows;
  const cols = lattice.gridDimensions?.cols;

  if (!Number.isInteger(rows) || rows <= 0) {
    throw new Error("GridLattice rows must be a positive integer");
  }
  if (!Number.isInteger(cols) || cols <= 0) {
    throw new Error("GridLattice cols must be a positive integer");
  }
  if (lattice.extent?.status !== "available") {
    throw new Error("GridLattice extent must be available");
  }

  validateBounds(lattice.extent.bounds);

  if (!lattice.coordinateSystem || typeof lattice.coordinateSystem !== "object") {
    throw new Error("GridLattice coordinate system is required");
  }
  if (lattice.extent.coordinateSpace !== lattice.coordinateSystem.space) {
    throw new Error("GridLattice extent and coordinate system must use the same space");
  }
}

function validateBounds(bounds) {
  if (!bounds || typeof bounds !== "object") {
    throw new Error("GridLattice bounds are required");
  }
  for (const field of ["top", "left", "width", "height"]) {
    if (!Number.isFinite(bounds[field])) {
      throw new Error(`GridLattice bounds.${field} must be finite`);
    }
  }
  if (bounds.width <= 0 || bounds.height <= 0) {
    throw new Error("GridLattice bounds dimensions must be positive");
  }
}

function validateCoordinateTransform(transform) {
  if (!transform || typeof transform !== "object") {
    throw new Error("GridLattice localToBinaryImage transform is required");
  }
  for (const field of ["offsetX", "offsetY", "scaleX", "scaleY"]) {
    if (!Number.isFinite(transform[field])) {
      throw new Error(`GridLattice localToBinaryImage.${field} must be finite`);
    }
  }
  if (transform.scaleX <= 0 || transform.scaleY <= 0) {
    throw new Error("GridLattice coordinate scales must be positive");
  }
}

function cloneBounds(bounds) {
  return {
    top: bounds.top,
    left: bounds.left,
    width: bounds.width,
    height: bounds.height
  };
}
