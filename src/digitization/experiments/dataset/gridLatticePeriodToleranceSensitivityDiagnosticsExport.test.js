import {
  createGridLatticePeriodToleranceSensitivityDiagnosticsExport
} from "./gridLatticePeriodToleranceSensitivityDiagnosticsExport";

test("creates deterministic two-space JSON with one trailing newline", () => {
  const report = createReport();
  const first = createGridLatticePeriodToleranceSensitivityDiagnosticsExport(
    report
  );
  const second = createGridLatticePeriodToleranceSensitivityDiagnosticsExport(
    report
  );

  expect(second).toEqual(first);
  expect(first).toEqual({
    fileName:
      "grid-lattice-period-tolerance-sensitivity-diagnostics-tt-dataset-v1.json",
    mimeType: "application/json",
    contents: `${JSON.stringify(report, null, 2)}\n`
  });
  expect(first.contents.endsWith("\n")).toBe(true);
  expect(first.contents.endsWith("\n\n")).toBe(false);
});

test("rejects anything except completed version 1 diagnostics", () => {
  expect(() => createGridLatticePeriodToleranceSensitivityDiagnosticsExport())
    .toThrow(
      "Completed version 1 grid lattice period tolerance sensitivity diagnostics are required"
    );
  expect(() => createGridLatticePeriodToleranceSensitivityDiagnosticsExport({
    ...createReport(),
    status: "partial"
  })).toThrow(
    "Completed version 1 grid lattice period tolerance sensitivity diagnostics are required"
  );
});

function createReport() {
  return {
    type: "grid-lattice-period-tolerance-sensitivity-diagnostics",
    version: 1,
    datasetId: "TT Dataset",
    status: "complete",
    items: []
  };
}
