export function createShadowGridValidationReportExport(validationReport) {
  validateReport(validationReport);

  return {
    fileName: `shadow-grid-validation-${normalizeFileNamePart(
      validationReport.datasetId
    )}-v${validationReport.version}.json`,
    mimeType: "application/json",
    contents: `${JSON.stringify(validationReport, null, 2)}\n`
  };
}

export function createShadowGridValidationReportDownloader({
  createExport = createShadowGridValidationReportExport,
  readEnvironment = () => process.env.NODE_ENV,
  documentRef = typeof document === "undefined" ? null : document,
  urlApi = typeof URL === "undefined" ? null : URL,
  BlobCtor = typeof Blob === "undefined" ? null : Blob
} = {}) {
  return function downloadShadowGridValidationReport(validationReport) {
    const environment = readEnvironment();

    if (environment !== "development" && environment !== "test") {
      throw new Error("Shadow grid validation downloads are development-only");
    }

    if (
      !documentRef
      || typeof documentRef.createElement !== "function"
      || !urlApi
      || typeof urlApi.createObjectURL !== "function"
      || typeof urlApi.revokeObjectURL !== "function"
      || typeof BlobCtor !== "function"
    ) {
      throw new Error("Browser download dependencies are required");
    }

    const artifact = createExport(validationReport);
    const blob = new BlobCtor([artifact.contents], { type: artifact.mimeType });
    const objectUrl = urlApi.createObjectURL(blob);

    try {
      const anchor = documentRef.createElement("a");

      if (!anchor || typeof anchor.click !== "function") {
        throw new Error("Download anchor with click is required");
      }

      anchor.href = objectUrl;
      anchor.download = artifact.fileName;
      anchor.click();
      return artifact;
    } finally {
      urlApi.revokeObjectURL(objectUrl);
    }
  };
}

export const downloadShadowGridValidationReport =
  createShadowGridValidationReportDownloader();

function validateReport(report) {
  if (
    !report
    || report.type !== "shadow-grid-validation-report"
    || report.version !== 1
    || report.status !== "complete"
  ) {
    throw new Error("Completed version 1 shadow grid validation report is required");
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
