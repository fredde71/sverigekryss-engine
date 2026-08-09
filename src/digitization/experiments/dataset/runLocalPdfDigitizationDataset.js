import { runDigitizationDataset } from "./digitizationDatasetRunner";
import { preparePdfDatasetInput } from "./pdfDatasetAdapter";

export function createLocalPdfDigitizationDatasetEntryPoint({
  runDataset = runDigitizationDataset,
  prepareInput = preparePdfDatasetInput,
  readEnvironment = () => process.env.NODE_ENV
} = {}) {
  return async function runLocalPdfDataset({
    datasetId,
    items = [],
    productionOptions
  } = {}) {
    const environment = readEnvironment();

    if (environment !== "development" && environment !== "test") {
      throw new Error(
        "Local PDF digitization datasets are available only in development"
      );
    }

    return runDataset({
      datasetId,
      items,
      prepareInput,
      productionOptions
    });
  };
}

export const runLocalPdfDigitizationDataset =
  createLocalPdfDigitizationDatasetEntryPoint();
