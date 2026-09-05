import {
  cloneDeterministicValue,
  deepFreeze
} from "./GridLatticeModelSupport";

const RENDERED_BINARY_IMAGE_SPACE = "rendered-binary-image-pixels";
const ANALYSIS_REGION_LOCAL_SPACE = "analysis-region-local";

export function createGridLatticeEditorProposal({
  gridLattice,
  outerVisualExtent
} = {}) {
  validateAvailableLattice(gridLattice);

  if (outerVisualExtent?.type !== "outer-visual-extent") {
    return createUnavailableProposal({
      gridLattice,
      outerVisualExtent,
      status: "unavailable",
      reason: "outer-visual-extent-unavailable"
    });
  }
  if (outerVisualExtent.status !== "available") {
    return createUnavailableProposal({
      gridLattice,
      outerVisualExtent,
      status: normalizeUnavailableStatus(outerVisualExtent.status),
      reason: `outer-visual-extent-${outerVisualExtent.status || "unavailable"}`
    });
  }

  try {
    validateBounds(outerVisualExtent.bounds, "OuterVisualExtent");
    validateCoordinateSystem(outerVisualExtent.coordinateSystem);
    const rows = gridLattice.gridDimensions.rows;
    const cols = gridLattice.gridDimensions.cols;
    const horizontalLinePositions = mapAxisPositionsToEditorSpace(
      gridLattice.axes?.horizontal?.positions,
      "horizontal",
      rows + 1,
      gridLattice.coordinateSystem
    );
    const verticalLinePositions = mapAxisPositionsToEditorSpace(
      gridLattice.axes?.vertical?.positions,
      "vertical",
      cols + 1,
      gridLattice.coordinateSystem
    );

    return deepFreeze({
      type: "grid-lattice-editor-proposal",
      version: 1,
      status: "available",
      rows,
      cols,
      gridArea: mapBoundsToEditorSpace(
        outerVisualExtent.bounds,
        outerVisualExtent.coordinateSystem
      ),
      horizontalLinePositions,
      verticalLinePositions,
      linePositionCoordinateSpace: "document",
      cellTypes: Array(rows * cols).fill("empty"),
      competitionCells: [],
      provenance: createProposalProvenance(gridLattice, outerVisualExtent),
      reasons: []
    });
  } catch (error) {
    return createUnavailableProposal({
      gridLattice,
      outerVisualExtent,
      status: "unavailable",
      reason: "outer-visual-extent-coordinate-transform-unavailable",
      diagnostic: error.message
    });
  }
}

function createUnavailableProposal({
  gridLattice,
  outerVisualExtent,
  status,
  reason,
  diagnostic = null
}) {
  return deepFreeze({
    type: "grid-lattice-editor-proposal",
    version: 1,
    status,
    rows: null,
    cols: null,
    gridArea: null,
    horizontalLinePositions: null,
    verticalLinePositions: null,
    linePositionCoordinateSpace: null,
    cellTypes: [],
    competitionCells: [],
    provenance: createProposalProvenance(gridLattice, outerVisualExtent),
    reasons: [reason],
    diagnostics: diagnostic ? [{ type: reason, message: diagnostic }] : []
  });
}

function createProposalProvenance(gridLattice, outerVisualExtent) {
  return {
    gridLattice: {
      id: gridLattice.id ?? null,
      coordinateSystem: cloneDeterministicValue(
        gridLattice.coordinateSystem ?? null
      ),
      extent: cloneDeterministicValue(gridLattice.extent ?? null),
      sourceCandidateReference: cloneDeterministicValue(
        gridLattice.sourceCandidateReference ?? null
      ),
      linePositionSemantics: "modeled-grid-line-centers"
    },
    outerVisualExtent: outerVisualExtent
      ? {
        id: outerVisualExtent.id ?? null,
        status: outerVisualExtent.status ?? null,
        coordinateSystem: cloneDeterministicValue(
          outerVisualExtent.coordinateSystem ?? null
        ),
        evidenceReferences: cloneDeterministicValue(
          outerVisualExtent.evidenceReferences ?? []
        ),
        provenance: cloneDeterministicValue(
          outerVisualExtent.provenance ?? null
        )
      }
      : null,
    composition: "grid-dimensions-with-independent-outer-visual-extent"
  };
}

function mapAxisPositionsToEditorSpace(
  positions,
  axis,
  expectedCount,
  coordinateSystem
) {
  if (!Array.isArray(positions) || positions.length !== expectedCount) {
    throw new Error(`GridLattice ${axis} line positions are unavailable`);
  }

  const mapped = positions.map((position, index) => {
    if (!Number.isFinite(position)) {
      throw new Error(
        `GridLattice ${axis} line position ${index} must be finite`
      );
    }
    if (index > 0 && position <= positions[index - 1]) {
      throw new Error(`GridLattice ${axis} line positions must increase`);
    }

    return mapPositionToEditorSpace(position, axis, coordinateSystem);
  });

  return mapped;
}

function mapPositionToEditorSpace(position, axis, coordinateSystem) {
  validateCoordinateSystem(coordinateSystem);
  const horizontal = axis === "horizontal";
  let binaryImagePosition;

  if (coordinateSystem.space === RENDERED_BINARY_IMAGE_SPACE) {
    binaryImagePosition = position;
  } else if (coordinateSystem.space === ANALYSIS_REGION_LOCAL_SPACE) {
    const transform = coordinateSystem.localToBinaryImage;
    validateCoordinateTransform(transform, "localToBinaryImage", true);
    binaryImagePosition = horizontal
      ? transform.offsetY + position * transform.scaleY
      : transform.offsetX + position * transform.scaleX;
  } else {
    throw new Error("GridLattice coordinate space is not supported by Editor");
  }

  const documentTransform = coordinateSystem.binaryImageToDocument;
  validateCoordinateTransform(
    documentTransform,
    "binaryImageToDocument",
    false
  );
  return binaryImagePosition * (
    horizontal ? documentTransform.scaleY : documentTransform.scaleX
  );
}

function mapBoundsToEditorSpace(bounds, coordinateSystem) {
  let binaryImageBounds;

  if (coordinateSystem.space === RENDERED_BINARY_IMAGE_SPACE) {
    binaryImageBounds = cloneBounds(bounds);
  } else if (coordinateSystem.space === ANALYSIS_REGION_LOCAL_SPACE) {
    binaryImageBounds = mapLocalBoundsToBinaryImage(
      bounds,
      coordinateSystem.localToBinaryImage
    );
  } else {
    throw new Error("OuterVisualExtent coordinate space is not supported by Editor");
  }

  return mapBinaryImageBoundsToDocument(
    binaryImageBounds,
    coordinateSystem.binaryImageToDocument
  );
}

function mapLocalBoundsToBinaryImage(bounds, transform) {
  validateCoordinateTransform(transform, "localToBinaryImage", true);

  return {
    top: transform.offsetY + bounds.top * transform.scaleY,
    left: transform.offsetX + bounds.left * transform.scaleX,
    width: bounds.width * transform.scaleX,
    height: bounds.height * transform.scaleY
  };
}

function mapBinaryImageBoundsToDocument(bounds, transform) {
  validateCoordinateTransform(transform, "binaryImageToDocument", false);

  return {
    top: bounds.top * transform.scaleY,
    left: bounds.left * transform.scaleX,
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

  validateBounds(lattice.extent.bounds, "GridLattice");
}

function validateCoordinateSystem(coordinateSystem) {
  if (!coordinateSystem || typeof coordinateSystem !== "object") {
    throw new Error("OuterVisualExtent coordinate system is required");
  }
}

function validateBounds(bounds, artifactName) {
  if (!bounds || typeof bounds !== "object") {
    throw new Error(`${artifactName} bounds are required`);
  }
  for (const field of ["top", "left", "width", "height"]) {
    if (!Number.isFinite(bounds[field])) {
      throw new Error(`${artifactName} bounds.${field} must be finite`);
    }
  }
  if (bounds.width <= 0 || bounds.height <= 0) {
    throw new Error(`${artifactName} bounds dimensions must be positive`);
  }
}

function validateCoordinateTransform(transform, name, requiresOffset) {
  if (!transform || typeof transform !== "object") {
    throw new Error(`OuterVisualExtent ${name} transform is required`);
  }
  const fields = requiresOffset
    ? ["offsetX", "offsetY", "scaleX", "scaleY"]
    : ["scaleX", "scaleY"];

  for (const field of fields) {
    if (!Number.isFinite(transform[field])) {
      throw new Error(`OuterVisualExtent ${name}.${field} must be finite`);
    }
  }
  if (transform.scaleX <= 0 || transform.scaleY <= 0) {
    throw new Error("OuterVisualExtent coordinate scales must be positive");
  }
}

function normalizeUnavailableStatus(status) {
  return status === "ambiguous" || status === "partial"
    ? status
    : "unavailable";
}

function cloneBounds(bounds) {
  return {
    top: bounds.top,
    left: bounds.left,
    width: bounds.width,
    height: bounds.height
  };
}
