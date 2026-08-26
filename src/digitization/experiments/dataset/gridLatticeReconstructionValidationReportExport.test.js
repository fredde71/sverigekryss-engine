import {
  createGridLatticeReconstructionValidationReportExport
} from "./gridLatticeReconstructionValidationReportExport";

test("creates deterministic two-space JSON with one trailing newline", () => {
  const report = {
    type: "grid-lattice-reconstruction-validation-report",
    version: 1,
    datasetId: "TT Dataset",
    status: "complete",
    items: []
  };

  const first = createGridLatticeReconstructionValidationReportExport(report);
  const second = createGridLatticeReconstructionValidationReportExport(report);

  expect(first).toEqual(second);
  expect(first.fileName).toBe(
    "grid-lattice-reconstruction-validation-report-tt-dataset-v1.json"
  );
  expect(first.mimeType).toBe("application/json");
  expect(first.contents).toBe(`${JSON.stringify(report, null, 2)}\n`);
  expect(first.contents.endsWith("\n")).toBe(true);
  expect(first.contents.endsWith("\n\n")).toBe(false);
});

test("rejects non-report input", () => {
  expect(() => createGridLatticeReconstructionValidationReportExport({
    type: "other",
    version: 1,
    datasetId: "dataset"
  })).toThrow("Grid Lattice Reconstruction Validation Report");
});
