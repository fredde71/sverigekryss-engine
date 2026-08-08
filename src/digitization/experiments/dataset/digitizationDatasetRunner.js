import { detectGridFromImageSource } from "../../detection/imageGridDetectionEngine";
import { runDigitizationExperimentComparison } from "../digitizationExperimentComparison";
import { createExperimentObservationReport } from "../experimentObservationReport";

const DATASET_RUN_VERSION = 1;

export function createDigitizationDatasetRunner({
  runProduction = detectGridFromImageSource,
  runComparison = runDigitizationExperimentComparison,
  createObservationReport = createExperimentObservationReport
} = {}) {
  validateDependency(runProduction, "runProduction");
  validateDependency(runComparison, "runComparison");
  validateDependency(createObservationReport, "createObservationReport");

  return async function runDigitizationDataset({
    datasetId,
    items = [],
    prepareInput,
    readImageData,
    productionOptions = {}
  } = {}) {
    validateItems(items);
    validateDependency(prepareInput, "prepareInput");

    const itemResults = [];

    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const itemResult = createItemResult(item, index);
      let prepared;

      try {
        prepared = await prepareInput(item);
        validatePreparedInput(prepared, readImageData);
        itemResult.preparation = {
          status: "completed"
        };
      } catch (error) {
        itemResult.status = "failed";
        itemResult.preparation = createFailedStage(error);
        itemResult.production = createNotRunStage("preparation-failed");
        itemResult.comparison = createNotRunStage("preparation-failed");
        itemResult.observationReport = createNotRunStage("preparation-failed");
        itemResults.push(itemResult);
        continue;
      }

      let productionResult;

      try {
        productionResult = await runProduction({
          source: prepared.source,
          options: {
            ...productionOptions,
            ...(item.productionOptions || {}),
            ...(prepared.productionOptions || {})
          },
          readImageData: prepared.readImageData ?? readImageData
        });
        itemResult.production = {
          status: "completed",
          result: productionResult
        };
      } catch (error) {
        itemResult.status = "failed";
        itemResult.production = createFailedStage(error);
        itemResult.comparison = createNotRunStage("production-failed");
        itemResult.observationReport = createNotRunStage("production-failed");
        itemResults.push(itemResult);
        continue;
      }

      let comparisonResult;

      try {
        comparisonResult = await runComparison({
          productionResult,
          binaryImage: productionResult.context.binaryImage,
          analysisContext: productionResult.context
        });
        itemResult.comparison = {
          status: "completed",
          result: comparisonResult
        };
      } catch (error) {
        itemResult.status = "failed";
        itemResult.comparison = createFailedStage(error);
        itemResult.observationReport = createNotRunStage("comparison-failed");
        itemResults.push(itemResult);
        continue;
      }

      try {
        const report = await createObservationReport(comparisonResult);
        itemResult.observationReport = {
          status: "completed",
          result: report
        };
      } catch (error) {
        itemResult.status = "failed";
        itemResult.observationReport = createFailedStage(error);
        itemResults.push(itemResult);
        continue;
      }

      itemResult.status = "completed";
      itemResults.push(itemResult);
    }

    const completedItemCount = itemResults.filter(item => (
      item.status === "completed"
    )).length;

    return {
      type: "digitization-dataset-run",
      version: DATASET_RUN_VERSION,
      datasetId,
      status: "completed",
      inventory: {
        totalItemCount: itemResults.length,
        completedItemCount,
        failedItemCount: itemResults.length - completedItemCount
      },
      items: itemResults
    };
  };
}

export const runDigitizationDataset = createDigitizationDatasetRunner();

function validateDependency(dependency, name) {
  if (typeof dependency !== "function") {
    throw new Error(`${name} must be a function`);
  }
}

function validateItems(items) {
  if (!Array.isArray(items)) {
    throw new Error("items must be an array");
  }

  const ids = new Set();

  for (const item of items) {
    if (typeof item?.id !== "string" || item.id.length === 0) {
      throw new Error("Dataset item id must be a non-empty string");
    }

    if (ids.has(item.id)) {
      throw new Error(`Duplicate dataset item id: ${item.id}`);
    }

    ids.add(item.id);
  }
}

function validatePreparedInput(prepared, fallbackReadImageData) {
  if (!prepared || typeof prepared !== "object") {
    throw new Error("prepareInput must return an object");
  }

  if (!hasOwn(prepared, "source") || prepared.source === null || prepared.source === undefined) {
    throw new Error("Prepared input source is required");
  }

  if (typeof (prepared.readImageData ?? fallbackReadImageData) !== "function") {
    throw new Error("readImageData is required");
  }
}

function createItemResult(item, index) {
  return {
    id: item.id,
    index,
    metadata: cloneValue(item.metadata ?? {}),
    status: "pending",
    preparation: {
      status: "pending"
    },
    production: {
      status: "pending"
    },
    comparison: {
      status: "pending"
    },
    observationReport: {
      status: "pending"
    }
  };
}

function createFailedStage(error) {
  return {
    status: "failed",
    error: {
      name: error instanceof Error ? error.name : "Error",
      message: error instanceof Error ? error.message : String(error)
    }
  };
}

function createNotRunStage(reason) {
  return {
    status: "not-run",
    reason
  };
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, cloneValue(nestedValue)])
    );
  }

  return value;
}
