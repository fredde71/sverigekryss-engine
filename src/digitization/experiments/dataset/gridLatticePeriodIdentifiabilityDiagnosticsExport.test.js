import {
  createGridLatticePeriodIdentifiabilityDiagnosticsExport
} from "./gridLatticePeriodIdentifiabilityDiagnosticsExport";

test("creates deterministic two-space JSON with one trailing newline", () => {
  const report = createReport();
  const first = createGridLatticePeriodIdentifiabilityDiagnosticsExport(report);
  const second = createGridLatticePeriodIdentifiabilityDiagnosticsExport(report);

  expect(second).toEqual(first);
  expect(first).toEqual({
    fileName:
      "grid-lattice-period-identifiability-diagnostics-tt-dataset-v1.json",
    mimeType: "application/json",
    contents: `${JSON.stringify(report, null, 2)}\n`
  });
  expect(first.contents.endsWith("\n")).toBe(true);
  expect(first.contents.endsWith("\n\n")).toBe(false);
});

test("rejects anything except completed version 1 diagnostics", () => {
  expect(() => createGridLatticePeriodIdentifiabilityDiagnosticsExport())
    .toThrow(
      "Completed version 1 grid lattice period identifiability diagnostics are required"
    );
  expect(() => createGridLatticePeriodIdentifiabilityDiagnosticsExport({
    ...createReport(),
    status: "partial"
  })).toThrow(
    "Completed version 1 grid lattice period identifiability diagnostics are required"
  );
});

function createReport() {
  return {
    type: "grid-lattice-period-identifiability-diagnostics",
    version: 1,
    datasetId: "TT Dataset",
    status: "complete",
    items: []
  };
}
