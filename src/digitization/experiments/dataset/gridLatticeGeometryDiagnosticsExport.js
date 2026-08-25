export function createGridLatticeGeometryDiagnosticsExport(report) {
  validateReport(report);

  return {
    fileName: `grid-lattice-geometry-diagnostics-${normalizeFileNamePart(
      report.datasetId
    )}-v${report.version}.json`,
    mimeType: "application/json",
    contents: `${JSON.stringify(report, null, 2)}\n`
  };
}

function validateReport(report) {
  if (
    !report
    || report.type !== "grid-lattice-geometry-diagnostics"
    || report.version !== 1
    || report.status !== "complete"
  ) {
    throw new Error(
      "Completed version 1 grid lattice geometry diagnostics are required"
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
