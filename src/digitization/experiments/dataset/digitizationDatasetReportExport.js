export function createDigitizationDatasetReportExport(datasetRunResult) {
  validateCompletedDatasetRun(datasetRunResult);

  return {
    fileName: createFileName(datasetRunResult),
    mimeType: "application/json",
    contents: `${JSON.stringify(datasetRunResult, null, 2)}\n`
  };
}

export function createDigitizationDatasetReportDownloader({
  createExport = createDigitizationDatasetReportExport,
  readEnvironment = () => process.env.NODE_ENV,
  documentRef = typeof document === "undefined" ? null : document,
  urlApi = typeof URL === "undefined" ? null : URL,
  BlobCtor = typeof Blob === "undefined" ? null : Blob
} = {}) {
  return function downloadDigitizationDatasetReport(datasetRunResult) {
    const environment = readEnvironment();

    if (environment !== "development" && environment !== "test") {
      throw new Error(
        "Digitization dataset report downloads are available only in development"
      );
    }

    validateDownloadDependencies({
      createExport,
      documentRef,
      urlApi,
      BlobCtor
    });

    const artifact = createExport(datasetRunResult);
    const blob = new BlobCtor(
      [artifact.contents],
      { type: artifact.mimeType }
    );
    let objectUrl;

    try {
      objectUrl = urlApi.createObjectURL(blob);

      const anchor = documentRef.createElement("a");

      if (!anchor || typeof anchor.click !== "function") {
        throw new Error("Download anchor with click is required");
      }

      anchor.href = objectUrl;
      anchor.download = artifact.fileName;
      anchor.click();

      return artifact;
    } finally {
      if (objectUrl !== undefined) {
        urlApi.revokeObjectURL(objectUrl);
      }
    }
  };
}

export const downloadDigitizationDatasetReport =
  createDigitizationDatasetReportDownloader();

function validateCompletedDatasetRun(datasetRunResult) {
  if (
    !datasetRunResult
    || typeof datasetRunResult !== "object"
    || datasetRunResult.type !== "digitization-dataset-run"
    || datasetRunResult.status !== "completed"
  ) {
    throw new Error("Completed digitization dataset result is required");
  }
}

function createFileName(datasetRunResult) {
  const normalizedDatasetId = normalizeFileNamePart(datasetRunResult.datasetId);
  const version = datasetRunResult.version;
  const idSegment = normalizedDatasetId ? `-${normalizedDatasetId}` : "";

  return `digitization-dataset${idSegment}-v${version}.json`;
}

function normalizeFileNamePart(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "");
}

function validateDownloadDependencies({
  createExport,
  documentRef,
  urlApi,
  BlobCtor
}) {
  if (typeof createExport !== "function") {
    throw new Error("createExport must be a function");
  }

  if (!documentRef || typeof documentRef.createElement !== "function") {
    throw new Error("document.createElement is required");
  }

  if (
    !urlApi
    || typeof urlApi.createObjectURL !== "function"
    || typeof urlApi.revokeObjectURL !== "function"
  ) {
    throw new Error("URL object URL functions are required");
  }

  if (typeof BlobCtor !== "function") {
    throw new Error("Blob constructor is required");
  }
}
