import {
  createGridLatticeEditorProposal
} from "./GridLatticeEditorProposal";

test("maps an available rendered GridLattice to empty Editor state", () => {
  const lattice = createLattice();

  expect(createGridLatticeEditorProposal(lattice)).toEqual({
    rows: 2,
    cols: 3,
    gridArea: { top: 10.5, left: 20.5, width: 300, height: 200 },
    cellTypes: Array(6).fill("empty"),
    competitionCells: []
  });
});

test("applies the recorded local-to-binary-image transform when needed", () => {
  const lattice = createLattice({
    coordinateSystem: {
      space: "analysis-region-local",
      localToBinaryImage: {
        offsetX: 100,
        offsetY: 250,
        scaleX: 2,
        scaleY: 0.5
      }
    },
    bounds: { top: 10, left: 20, width: 300, height: 200 }
  });

  expect(createGridLatticeEditorProposal(lattice).gridArea).toEqual({
    top: 255,
    left: 140,
    width: 600,
    height: 100
  });
});

test("is deterministic and does not mutate the GridLattice", () => {
  const lattice = createLattice();
  const before = JSON.stringify(lattice);

  const first = createGridLatticeEditorProposal(lattice);
  const second = createGridLatticeEditorProposal(lattice);

  expect(second).toEqual(first);
  expect(second).not.toBe(first);
  expect(second.gridArea).not.toBe(lattice.extent.bounds);
  expect(JSON.stringify(lattice)).toBe(before);
});

test("rejects unavailable lattices and unsupported coordinate spaces", () => {
  expect(() => createGridLatticeEditorProposal(createLattice({
    status: "unavailable"
  }))).toThrow("GridLattice must be available");

  expect(() => createGridLatticeEditorProposal(createLattice({
    coordinateSystem: { space: "unknown-space" }
  }))).toThrow("GridLattice coordinate space is not supported by Editor");
});

function createLattice({
  status = "available",
  coordinateSystem = { space: "rendered-binary-image-pixels" },
  bounds = { top: 10.5, left: 20.5, width: 300, height: 200 }
} = {}) {
  return {
    type: "grid-lattice",
    status,
    gridDimensions: { rows: 2, cols: 3 },
    coordinateSystem,
    extent: {
      status: "available",
      coordinateSpace: coordinateSystem.space,
      bounds
    }
  };
}
