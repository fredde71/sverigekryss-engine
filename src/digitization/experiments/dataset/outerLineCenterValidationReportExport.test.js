import {
  createOuterLineCenterValidationReportExport
} from "./outerLineCenterValidationReportExport";

test("creates deterministic two-space JSON with one trailing newline", () => {
  const report = createReport();
  const first = createOuterLineCenterValidationReportExport(report);
  const second = createOuterLineCenterValidationReportExport(report);

  expect(first).toEqual(second);
  expect(first).toEqual({
    fileName: "outer-line-center-validation-tt-dataset-v1.json",
    mimeType: "application/json",
    contents: `${JSON.stringify(report, null, 2)}\n`
  });
  expect(first.contents.endsWith("\n")).toBe(true);
  expect(first.contents.endsWith("\n\n")).toBe(false);
});

test("requires a completed version 1 validation report", () => {
  expect(() => createOuterLineCenterValidationReportExport()).toThrow(
    "Completed version 1 outer line center validation report is required"
  );
  expect(() => createOuterLineCenterValidationReportExport({
    ...createReport(),
    status: "unavailable"
  })).toThrow(
    "Completed version 1 outer line center validation report is required"
  );
});

test("normalizes the dataset ID without adding interpretation", () => {
  const artifact = createOuterLineCenterValidationReportExport({
    ...createReport(),
    datasetId: " TT Local / 001 "
  });

  expect(artifact.fileName)
    .toBe("outer-line-center-validation-tt-local-001-v1.json");
  expect(JSON.parse(artifact.contents)).toEqual({
    ...createReport(),
    datasetId: " TT Local / 001 "
  });
});

function createReport() {
  return {
    type: "outer-line-center-ground-truth-validation-report",
    version: 1,
    datasetId: "tt-dataset",
    status: "complete",
    comparisonPolicy: { interpretation: "none" },
    inventory: {},
    items: [],
    unmatchedAnnotations: []
  };
}
