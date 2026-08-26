const TYPE = "grid-lattice-reconstruction-validation-report";

export function createGridLatticeReconstructionValidationReportExport(report) {
  if (
    report?.type !== TYPE
    || report?.version !== 1
    || typeof report?.datasetId !== "string"
    || report.datasetId.trim() === ""
  ) {
    throw new Error(
      "report must be a version 1 Grid Lattice Reconstruction Validation Report"
    );
  }

  return {
    fileName: `${TYPE}-${normalizeFileNamePart(report.datasetId)}-v1.json`,
    mimeType: "application/json",
    contents: `${JSON.stringify(report, null, 2)}\n`
  };
}

function normalizeFileNamePart(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
}
