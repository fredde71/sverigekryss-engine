import {
  createHumanAnnotationBiasDiagnosticsExport
} from "./humanAnnotationBiasDiagnosticsExport";

test("creates deterministic two-space JSON with one trailing newline", () => {
  const report = createReport();
  const first = createHumanAnnotationBiasDiagnosticsExport(report);
  const second = createHumanAnnotationBiasDiagnosticsExport(report);

  expect(second).toEqual(first);
  expect(first).toEqual({
    fileName: "human-annotation-bias-diagnostics-tt-dataset-v1.json",
    mimeType: "application/json",
    contents: `${JSON.stringify(report, null, 2)}\n`
  });
  expect(first.contents.endsWith("\n")).toBe(true);
  expect(first.contents.endsWith("\n\n")).toBe(false);
});

test("rejects anything except a completed version 1 diagnostics report", () => {
  expect(() => createHumanAnnotationBiasDiagnosticsExport()).toThrow(
    "Completed version 1 human annotation bias diagnostics are required"
  );
  expect(() => createHumanAnnotationBiasDiagnosticsExport({
    ...createReport(),
    status: "partial"
  })).toThrow(
    "Completed version 1 human annotation bias diagnostics are required"
  );
});

function createReport() {
  return {
    type: "outer-line-center-human-annotation-bias-diagnostics",
    version: 1,
    datasetId: "TT Dataset",
    status: "complete",
    items: []
  };
}
