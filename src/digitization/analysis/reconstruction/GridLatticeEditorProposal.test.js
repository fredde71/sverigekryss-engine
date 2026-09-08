import {
  createGridLatticeEditorProposal
} from "./GridLatticeEditorProposal";

test("composes GridLattice dimensions with independent visual bounds", () => {
  const gridLattice = createLattice();
  const outerVisualExtent = createVisualExtent();

  expect(createGridLatticeEditorProposal({
    gridLattice,
    outerVisualExtent
  })).toMatchObject({
    type: "grid-lattice-editor-proposal",
    version: 1,
    status: "available",
    rows: 2,
    cols: 3,
    gridArea: { top: 8, left: 18, width: 304, height: 204 },
    horizontalLinePositions: [10.5, 110.5, 210.5],
    verticalLinePositions: [20.5, 120.5, 220.5, 320.5],
    linePositionCoordinateSpace: "document",
    cellTypes: Array(6).fill("empty"),
    competitionCells: [],
    provenance: {
      composition: "grid-dimensions-with-independent-outer-visual-extent"
    }
  });
  expect(gridLattice.extent.bounds).toEqual({
    top: 10.5,
    left: 20.5,
    width: 300,
    height: 200
  });
});

test("composes local-to-binary-image and binary-image-to-document exactly once", () => {
  const coordinateSystem = {
    space: "analysis-region-local",
    localToBinaryImage: {
      offsetX: 100,
      offsetY: 250,
      scaleX: 2,
      scaleY: 0.5
    },
    binaryImageToDocument: {
      scaleX: 0.25,
      scaleY: 3
    }
  };
  const result = createGridLatticeEditorProposal({
    gridLattice: createLattice({ coordinateSystem }),
    outerVisualExtent: createVisualExtent({
      coordinateSystem,
      bounds: { top: 8, left: 18, width: 304, height: 204 }
    })
  });

  expect(result.gridArea).toEqual({
    top: 762,
    left: 34,
    width: 152,
    height: 306
  });
  expect(result.horizontalLinePositions).toEqual([765.75, 915.75, 1065.75]);
  expect(result.verticalLinePositions).toEqual([35.25, 85.25, 135.25, 185.25]);
});

test("partial image-aligned research evidence cannot block the modeled lattice proposal", () => {
  const result = createGridLatticeEditorProposal({
    gridLattice: createLattice(),
    outerVisualExtent: createVisualExtent(),
    imageAlignedGridLineGeometry: createImageAlignedGeometry({
      status: "partial",
      horizontal: [null, 110.5, 210.5]
    })
  });

  expect(result.status).toBe("available");
  expect(result.horizontalLinePositions).toEqual([10.5, 110.5, 210.5]);
  expect(result.verticalLinePositions).toEqual([20.5, 120.5, 220.5, 320.5]);
  expect(result.provenance.gridLattice.linePositionSemantics)
    .toBe("modeled-grid-line-centers");
  expect(result.provenance).not.toHaveProperty(
    "imageAlignedGridLineGeometry"
  );
});

test("applies the document transform to rendered BinaryImage visual bounds", () => {
  const result = createGridLatticeEditorProposal({
    gridLattice: createLattice(),
    outerVisualExtent: createVisualExtent({
      coordinateSystem: {
        space: "rendered-binary-image-pixels",
        binaryImageToDocument: { scaleX: 0.5, scaleY: 2 }
      },
      bounds: { top: 8, left: 18, width: 304, height: 204 }
    })
  });

  expect(result.gridArea).toEqual({
    top: 16,
    left: 9,
    width: 152,
    height: 408
  });
});

test("identity transforms preserve the independent visual extent", () => {
  const outerVisualExtent = createVisualExtent();
  const result = createGridLatticeEditorProposal({
    gridLattice: createLattice(),
    outerVisualExtent
  });

  expect(result.gridArea).toEqual(outerVisualExtent.bounds);
  expect(result.gridArea).not.toBe(outerVisualExtent.bounds);
});

test.each(["unavailable", "partial", "ambiguous"])(
  "%s visual evidence does not fabricate an Editor proposal",
  status => {
    const result = createGridLatticeEditorProposal({
      gridLattice: createLattice(),
      outerVisualExtent: createVisualExtent({ status, bounds: null })
    });

    expect(result).toMatchObject({
      status,
      rows: null,
      cols: null,
      gridArea: null,
      cellTypes: [],
      competitionCells: []
    });
  }
);

test("missing required transforms do not fabricate document coordinates", () => {
  const result = createGridLatticeEditorProposal({
    gridLattice: createLattice(),
    outerVisualExtent: createVisualExtent({
      coordinateSystem: {
        space: "analysis-region-local",
        localToBinaryImage: {
          offsetX: 0,
          offsetY: 0,
          scaleX: 1,
          scaleY: 1
        }
      }
    })
  });

  expect(result).toMatchObject({
    status: "unavailable",
    gridArea: null,
    horizontalLinePositions: null,
    verticalLinePositions: null,
    reasons: ["outer-visual-extent-coordinate-transform-unavailable"]
  });
});

test("retains provenance and does not mutate either input", () => {
  const gridLattice = deepFreeze(createLattice());
  const outerVisualExtent = deepFreeze(createVisualExtent());
  const imageAlignedGridLineGeometry = deepFreeze(createImageAlignedGeometry());
  const latticeBefore = JSON.stringify(gridLattice);
  const extentBefore = JSON.stringify(outerVisualExtent);
  const geometryBefore = JSON.stringify(imageAlignedGridLineGeometry);

  const first = createGridLatticeEditorProposal({
    gridLattice,
    outerVisualExtent,
    imageAlignedGridLineGeometry
  });
  const second = createGridLatticeEditorProposal({
    gridLattice,
    outerVisualExtent,
    imageAlignedGridLineGeometry
  });

  expect(second).toEqual(first);
  expect(second).not.toBe(first);
  expect(second.provenance.gridLattice.extent).toEqual(gridLattice.extent);
  expect(second.provenance.outerVisualExtent).toMatchObject({
    id: outerVisualExtent.id,
    evidenceReferences: outerVisualExtent.evidenceReferences,
    provenance: outerVisualExtent.provenance
  });
  expect(Object.isFrozen(first.gridArea)).toBe(true);
  expect(JSON.stringify(gridLattice)).toBe(latticeBefore);
  expect(JSON.stringify(outerVisualExtent)).toBe(extentBefore);
  expect(JSON.stringify(imageAlignedGridLineGeometry)).toBe(geometryBefore);
});

test("still requires an available GridLattice", () => {
  expect(() => createGridLatticeEditorProposal({
    gridLattice: createLattice({ status: "unavailable" }),
    outerVisualExtent: createVisualExtent()
  })).toThrow("GridLattice must be available");
});

function createLattice({
  status = "available",
  coordinateSystem = {
    space: "rendered-binary-image-pixels",
    binaryImageToDocument: { scaleX: 1, scaleY: 1 }
  },
  bounds = { top: 10.5, left: 20.5, width: 300, height: 200 }
} = {}) {
  return {
    type: "grid-lattice",
    id: "lattice-a",
    status,
    gridDimensions: { rows: 2, cols: 3 },
    coordinateSystem,
    axes: {
      horizontal: {
        positions: [
          bounds.top,
          bounds.top + bounds.height / 2,
          bounds.top + bounds.height
        ]
      },
      vertical: {
        positions: [
          bounds.left,
          bounds.left + bounds.width / 3,
          bounds.left + (bounds.width * 2) / 3,
          bounds.left + bounds.width
        ]
      }
    },
    extent: {
      status: "available",
      coordinateSpace: coordinateSystem.space,
      bounds
    },
    sourceCandidateReference: { candidateId: "candidate-a" }
  };
}

function createVisualExtent({
  status = "available",
  coordinateSystem = {
    space: "rendered-binary-image-pixels",
    binaryImageToDocument: { scaleX: 1, scaleY: 1 }
  },
  bounds = { top: 8, left: 18, width: 304, height: 204 }
} = {}) {
  return {
    type: "outer-visual-extent",
    version: 1,
    id: "visual-a",
    status,
    coordinateSystem,
    bounds,
    evidenceReferences: [{ artifactType: "outer-line-geometry" }],
    provenance: { source: "factual-continuity-observations" }
  };
}

function createImageAlignedGeometry({
  status = "available",
  coordinateSystem = {
    space: "rendered-binary-image-pixels",
    binaryImageToDocument: { scaleX: 1, scaleY: 1 }
  },
  horizontal = [10.5, 110.5, 210.5],
  vertical = [20.5, 120.5, 220.5, 320.5]
} = {}) {
  return {
    type: "image-aligned-grid-line-geometry",
    version: 1,
    id: "image-aligned-a",
    status,
    coordinateSystem,
    selectedCandidateReference: { candidateId: "candidate-a" },
    axes: {
      horizontal: createImageAlignedAxis("horizontal", horizontal, status),
      vertical: createImageAlignedAxis("vertical", vertical, status)
    },
    provenance: { source: "selected-axis-candidate-assignments" }
  };
}

function createImageAlignedAxis(axis, positions, status) {
  return {
    axis,
    status,
    linePositions: positions.map((position, latticeIndex) => ({
      latticeIndex,
      position,
      status: position === null ? "unavailable" : "observed"
    }))
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
