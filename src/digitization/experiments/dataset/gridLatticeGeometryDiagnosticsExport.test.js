import {
  createGridLatticeGeometryDiagnosticsExport
} from "./gridLatticeGeometryDiagnosticsExport";

test("creates deterministic two-space JSON with one trailing newline", () => {
  const report = createReport();
  const first = createGridLatticeGeometryDiagnosticsExport(report);
  const second = createGridLatticeGeometryDiagnosticsExport(report);

  expect(second).toEqual(first);
  expect(first).toEqual({
    fileName: "grid-lattice-geometry-diagnostics-tt-dataset-v1.json",
    mimeType: "application/json",
    contents: `${JSON.stringify(report, null, 2)}\n`
  });
  expect(first.contents.endsWith("\n")).toBe(true);
  expect(first.contents.endsWith("\n\n")).toBe(false);
});

test("rejects anything except completed version 1 diagnostics", () => {
  expect(() => createGridLatticeGeometryDiagnosticsExport()).toThrow(
    "Completed version 1 grid lattice geometry diagnostics are required"
  );
  expect(() => createGridLatticeGeometryDiagnosticsExport({
    ...createReport(),
    status: "partial"
  })).toThrow(
    "Completed version 1 grid lattice geometry diagnostics are required"
  );
});

function createReport() {
  return {
    type: "grid-lattice-geometry-diagnostics",
    version: 1,
    datasetId: "TT Dataset",
    status: "complete",
    items: []
  };
}
