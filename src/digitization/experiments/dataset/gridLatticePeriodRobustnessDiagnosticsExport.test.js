import {
  createGridLatticePeriodRobustnessDiagnosticsExport
} from "./gridLatticePeriodRobustnessDiagnosticsExport";

test("creates deterministic two-space JSON with one trailing newline", () => {
  const report = createReport();
  const first = createGridLatticePeriodRobustnessDiagnosticsExport(report);
  const second = createGridLatticePeriodRobustnessDiagnosticsExport(report);

  expect(second).toEqual(first);
  expect(first).toEqual({
    fileName: "grid-lattice-period-robustness-diagnostics-tt-dataset-v1.json",
    mimeType: "application/json",
    contents: `${JSON.stringify(report, null, 2)}\n`
  });
  expect(first.contents.endsWith("\n")).toBe(true);
  expect(first.contents.endsWith("\n\n")).toBe(false);
});

test("rejects anything except completed version 1 diagnostics", () => {
  expect(() => createGridLatticePeriodRobustnessDiagnosticsExport()).toThrow(
    "Completed version 1 grid lattice period robustness diagnostics are required"
  );
  expect(() => createGridLatticePeriodRobustnessDiagnosticsExport({
    ...createReport(),
    version: 2
  })).toThrow(
    "Completed version 1 grid lattice period robustness diagnostics are required"
  );
});

function createReport() {
  return {
    type: "grid-lattice-period-robustness-diagnostics",
    version: 1,
    datasetId: "TT Dataset",
    status: "complete",
    items: []
  };
}
