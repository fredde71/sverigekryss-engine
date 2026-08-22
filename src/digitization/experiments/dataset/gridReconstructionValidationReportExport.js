export function createGridReconstructionValidationReportExport(report) {
  validateReport(report);

  return {
    fileName: `grid-reconstruction-validation-${normalizeFileNamePart(
      report.datasetId
    )}-v${report.version}.json`,
    mimeType: "application/json",
    contents: `${JSON.stringify(report, null, 2)}\n`
  };
}

function validateReport(report) {
  if (
    !report
    || report.type !== "grid-reconstruction-validation-report"
    || report.version !== 1
    || report.status !== "complete"
  ) {
    throw new Error(
      "Completed version 1 grid reconstruction validation report is required"
    );
  }
}

function normalizeFileNamePart(value) {
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "dataset";
}
