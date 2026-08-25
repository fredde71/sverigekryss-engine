import {
  createGridLatticePeriodicityDiagnosticsExport
} from "./gridLatticePeriodicityDiagnosticsExport";

test("creates deterministic two-space JSON with one trailing newline", () => {
  const report = createReport();
  const first = createGridLatticePeriodicityDiagnosticsExport(report);
  const second = createGridLatticePeriodicityDiagnosticsExport(report);

  expect(second).toEqual(first);
  expect(first).toEqual({
    fileName: "grid-lattice-periodicity-diagnostics-tt-dataset-v1.json",
    mimeType: "application/json",
    contents: `${JSON.stringify(report, null, 2)}\n`
  });
  expect(first.contents.endsWith("\n")).toBe(true);
  expect(first.contents.endsWith("\n\n")).toBe(false);
});

test("rejects anything except completed version 1 diagnostics", () => {
  expect(() => createGridLatticePeriodicityDiagnosticsExport()).toThrow(
    "Completed version 1 grid lattice periodicity diagnostics are required"
  );
  expect(() => createGridLatticePeriodicityDiagnosticsExport({
    ...createReport(),
    version: 2
  })).toThrow(
    "Completed version 1 grid lattice periodicity diagnostics are required"
  );
});

function createReport() {
  return {
    type: "grid-lattice-periodicity-diagnostics",
    version: 1,
    datasetId: "TT Dataset",
    status: "complete",
    items: []
  };
}
