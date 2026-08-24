import {
  createOuterLineCenterGeometryValidationReportExport
} from "./outerLineCenterGeometryValidationReportExport";

test("creates deterministic two-space JSON with one trailing newline", () => {
  const report = createReport();
  const first = createOuterLineCenterGeometryValidationReportExport(report);
  const second = createOuterLineCenterGeometryValidationReportExport(report);

  expect(first).toEqual(second);
  expect(first).toEqual({
    fileName: "outer-line-center-geometry-validation-tt-dataset-v1.json",
    mimeType: "application/json",
    contents: `${JSON.stringify(report, null, 2)}\n`
  });
  expect(first.contents.endsWith("\n")).toBe(true);
  expect(first.contents.endsWith("\n\n")).toBe(false);
});

test("requires a completed version 1 geometry validation report", () => {
  expect(() => createOuterLineCenterGeometryValidationReportExport()).toThrow(
    "Completed version 1 outer line center geometry validation report is required"
  );
  expect(() => createOuterLineCenterGeometryValidationReportExport({
    ...createReport(),
    status: "unavailable"
  })).toThrow(
    "Completed version 1 outer line center geometry validation report is required"
  );
});

test("normalizes only the filename and preserves report content exactly", () => {
  const report = { ...createReport(), datasetId: " TT Local / 001 " };
  const artifact = createOuterLineCenterGeometryValidationReportExport(report);

  expect(artifact.fileName)
    .toBe("outer-line-center-geometry-validation-tt-local-001-v1.json");
  expect(JSON.parse(artifact.contents)).toEqual(report);
});

function createReport() {
  return {
    type: "outer-line-center-geometry-ground-truth-validation-report",
    version: 1,
    datasetId: "tt-dataset",
    status: "complete",
    comparisonPolicy: { interpretation: "validation-observation-only" },
    inventory: {},
    items: [],
    unmatchedAnnotations: []
  };
}
