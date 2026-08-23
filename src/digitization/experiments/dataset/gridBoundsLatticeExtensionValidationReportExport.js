export function createGridBoundsLatticeExtensionValidationReportExport(report) {
  validateReport(report);

  return {
    fileName: `grid-bounds-lattice-extension-validation-${normalizeFileNamePart(
      report.datasetId
    )}-v${report.version}.json`,
    mimeType: "application/json",
    contents: `${JSON.stringify(report, null, 2)}\n`
  };
}

function validateReport(report) {
  if (
    !report
    || report.type
      !== "grid-bounds-lattice-extension-validation-report"
    || report.version !== 1
    || report.status !== "complete"
  ) {
    throw new Error(
      "Completed version 1 grid bounds lattice extension validation report is required"
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
