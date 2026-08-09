export function createDigitizationDatasetReportExport(datasetRunResult) {
  const report = createDigitizationDatasetReportProjection(datasetRunResult);

  return {
    fileName: createFileName(datasetRunResult),
    mimeType: "application/json",
    contents: `${JSON.stringify(report, null, 2)}\n`
  };
}

export function createDigitizationDatasetReportProjection(datasetRunResult) {
  validateCompletedDatasetRun(datasetRunResult);

  return {
    type: "digitization-dataset-report",
    version: 1,
    datasetRun: {
      type: datasetRunResult.type,
      version: datasetRunResult.version,
      datasetId: datasetRunResult.datasetId,
      status: datasetRunResult.status,
      inventory: cloneValue(datasetRunResult.inventory)
    },
    items: Array.isArray(datasetRunResult.items)
      ? datasetRunResult.items.map(projectItem)
      : []
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

function projectItem(item) {
  return {
    id: item?.id,
    index: item?.index,
    metadata: cloneValue(item?.metadata ?? {}),
    status: item?.status,
    preparation: projectStage(item?.preparation),
    production: projectProductionStage(item?.production),
    comparison: projectComparisonStage(item?.comparison),
    observationReport: projectObservationReportStage(item?.observationReport)
  };
}

function projectStage(stage) {
  const result = {
    status: stage?.status
  };

  copyStageFailureFields(result, stage);
  return result;
}

function projectProductionStage(stage) {
  const result = projectStage(stage);

  if (stage?.status === "completed" && hasOwn(stage, "result")) {
    result.result = {
      gridDetection: projectGridDetection(stage.result?.gridDetection)
    };
  }

  return result;
}

function projectGridDetection(gridDetection) {
  if (!gridDetection || typeof gridDetection !== "object") {
    return gridDetection ?? null;
  }

  return {
    geometry: cloneValue(gridDetection.geometry ?? null),
    confidence: cloneValue(gridDetection.confidence),
    diagnostics: Array.isArray(gridDetection.diagnostics)
      ? gridDetection.diagnostics.map(projectCompactDiagnostic)
      : []
  };
}

function projectComparisonStage(stage) {
  const result = projectStage(stage);

  if (stage?.status === "completed" && hasOwn(stage, "result")) {
    const experiments = stage.result?.benchmark?.experiments;

    result.result = {
      benchmark: {
        experiments: Array.isArray(experiments)
          ? experiments.map(projectExperiment)
          : []
      }
    };
  }

  return result;
}

function projectExperiment(experiment) {
  return {
    id: experiment?.id,
    description: experiment?.description,
    durationMs: experiment?.durationMs,
    success: experiment?.success,
    diagnostics: projectCompactDiagnostic(experiment?.diagnostics)
  };
}

function projectObservationReportStage(stage) {
  const result = projectStage(stage);

  if (stage?.status === "completed" && hasOwn(stage, "result")) {
    result.result = cloneValue(stage.result);
  }

  return result;
}

function projectCompactDiagnostic(value) {
  if (Array.isArray(value)) {
    return value.map(projectCompactDiagnostic);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  if (isTypedArray(value)) {
    return undefined;
  }

  const result = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    if (key === "visualizations") {
      result.visualizations = Array.isArray(nestedValue)
        ? nestedValue.map(projectVisualization)
        : [];
      continue;
    }

    if (RUNTIME_ONLY_DIAGNOSTIC_FIELDS.has(key)) {
      continue;
    }

    const projectedValue = projectCompactDiagnostic(nestedValue);

    if (projectedValue !== undefined) {
      result[key] = projectedValue;
    }
  }

  return result;
}

function projectVisualization(visualization) {
  const result = {
    id: visualization?.id,
    title: visualization?.title,
    type: visualization?.type
  };
  const data = visualization?.data;

  if (data && typeof data === "object") {
    result.data = {};

    for (const key of ["axis", "axisLength", "length"]) {
      if (hasOwn(data, key)) {
        result.data[key] = cloneValue(data[key]);
      }
    }

    if (Array.isArray(data.series)) {
      result.data.series = data.series.map(series => ({
        id: series?.id,
        title: series?.title
      }));
    }
  }

  return result;
}

function copyStageFailureFields(target, stage) {
  if (hasOwn(stage, "error")) {
    target.error = cloneValue(stage.error);
  }

  if (hasOwn(stage, "reason")) {
    target.reason = cloneValue(stage.reason);
  }
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }

  if (isTypedArray(value)) {
    return Array.from(value);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, cloneValue(nestedValue)])
    );
  }

  return value;
}

function isTypedArray(value) {
  return ArrayBuffer.isView(value) && !(value instanceof DataView);
}

function hasOwn(value, key) {
  return value !== null
    && value !== undefined
    && Object.prototype.hasOwnProperty.call(value, key);
}

const RUNTIME_ONLY_DIAGNOSTIC_FIELDS = new Set([
  "context",
  "imageData",
  "binaryImage",
  "projections",
  "projection",
  "rawProjection",
  "rawHorizontalProjection",
  "rawVerticalProjection",
  "suggestions",
  "source",
  "canvas"
]);

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
