import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import DigitizationDatasetHarness from "./DigitizationDatasetHarness";
import { GRID_GROUND_TRUTH_COORDINATE_POLICY } from "./gridGroundTruth";

jest.mock("pdfjs-dist", () => ({
  getDocument: jest.fn()
}));

test("renders a minimal multiple-PDF Digitization Lab in test mode", () => {
  render(<DigitizationDatasetHarness />);

  expect(screen.getByRole("region", { name: "Digitization Lab" })).toBeInTheDocument();
  const input = screen.getByLabelText("Select local PDFs");

  expect(input).toHaveAttribute("type", "file");
  expect(input).toHaveAttribute("accept", "application/pdf,.pdf");
  expect(input).toHaveAttribute("multiple");
  expect(screen.getByRole("button", { name: "Run dataset" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Download JSON" })).not.toBeInTheDocument();
});

test("preserves selected file order with stable IDs and filename metadata", async () => {
  const firstSelected = createPdfFile("z-last.pdf");
  const secondSelected = createPdfFile("a-first.pdf");
  const runnerResult = createCompletedResult();
  const runDataset = jest.fn(async () => runnerResult);

  render(<DigitizationDatasetHarness runDataset={runDataset} />);

  fireEvent.change(screen.getByLabelText("Select local PDFs"), {
    target: {
      files: [firstSelected, secondSelected]
    }
  });
  fireEvent.click(screen.getByRole("button", { name: "Run dataset" }));

  await waitFor(() => expect(runDataset).toHaveBeenCalledTimes(1));
  const invocation = runDataset.mock.calls[0][0];

  expect(invocation.datasetId).toBe("localhost-pdf-dataset");
  expect(invocation.items.map(item => item.id)).toEqual([
    "local-pdf-001",
    "local-pdf-002"
  ]);
  expect(invocation.items.map(item => item.input.file)).toEqual([
    firstSelected,
    secondSelected
  ]);
  expect(invocation.items.map(item => item.metadata)).toEqual([
    { filename: "z-last.pdf" },
    { filename: "a-first.pdf" }
  ]);
  expect(Object.keys(invocation)).toEqual(["datasetId", "items"]);
  expect(await screen.findByRole("status")).toHaveTextContent("Dataset completed");
});

test("downloads the exact completed dataset result", async () => {
  const runnerResult = createCompletedResult();
  const runDataset = jest.fn(async () => runnerResult);
  const downloadReport = jest.fn();

  render(
    <DigitizationDatasetHarness
      runDataset={runDataset}
      downloadReport={downloadReport}
    />
  );

  selectFiles([createPdfFile("one.pdf")]);
  fireEvent.click(screen.getByRole("button", { name: "Run dataset" }));

  const downloadButton = await screen.findByRole("button", {
    name: "Download JSON"
  });
  expect(downloadReport).not.toHaveBeenCalled();

  fireEvent.click(downloadButton);

  expect(downloadReport).toHaveBeenCalledTimes(1);
  expect(downloadReport).toHaveBeenCalledWith(runnerResult);
});

test("creates the existing reports in order and renders the analysis view", async () => {
  const runnerResult = createCompletedResult();
  const datasetReport = { type: "digitization-dataset-report", marker: "dataset" };
  const failureReport = createFailureReport();
  const analysisSummary = createAnalysisSummary();
  const createDatasetReportMock = jest.fn(() => datasetReport);
  const createFailureReportMock = jest.fn(() => failureReport);
  const createAnalysisSummaryMock = jest.fn(() => analysisSummary);

  render(
    <DigitizationDatasetHarness
      runDataset={jest.fn(async () => runnerResult)}
      createDatasetReport={createDatasetReportMock}
      createFailureReport={createFailureReportMock}
      createAnalysisSummary={createAnalysisSummaryMock}
    />
  );

  selectFiles([createPdfFile("analysis.pdf")]);
  fireEvent.click(screen.getByRole("button", { name: "Run dataset" }));

  expect(await screen.findByRole("heading", { name: "Dataset overview" })).toBeInTheDocument();
  expect(createDatasetReportMock).toHaveBeenCalledTimes(1);
  expect(createDatasetReportMock).toHaveBeenCalledWith(runnerResult);
  expect(createFailureReportMock).toHaveBeenCalledTimes(1);
  expect(createFailureReportMock).toHaveBeenCalledWith(datasetReport);
  expect(createAnalysisSummaryMock).toHaveBeenCalledTimes(1);
  expect(createAnalysisSummaryMock).toHaveBeenCalledWith({
    datasetReport,
    failureReport
  });
  expect(screen.getByText("Supplied integration completion.")).toBeInTheDocument();
});

test("renders analysis from the real existing report creators after completion", async () => {
  render(
    <DigitizationDatasetHarness
      runDataset={jest.fn(async () => createCompletedResult())}
    />
  );

  selectFiles([createPdfFile("real-chain.pdf")]);
  fireEvent.click(screen.getByRole("button", { name: "Run dataset" }));

  expect(await screen.findByRole("heading", { name: "Dataset overview" })).toBeInTheDocument();
  expect(screen.getByText("0 of 0 puzzles completed.")).toBeInTheDocument();
  expect(screen.getByText("No production failure reasons were recorded.")).toBeInTheDocument();
});

test("isolates analysis creation failure from completion and download", async () => {
  const runnerResult = createCompletedResult();
  const downloadReport = jest.fn();
  const createDatasetReport = jest.fn(() => {
    throw new Error("synthetic analysis failure");
  });

  render(
    <DigitizationDatasetHarness
      runDataset={jest.fn(async () => runnerResult)}
      downloadReport={downloadReport}
      createDatasetReport={createDatasetReport}
    />
  );

  selectFiles([createPdfFile("analysis-fails.pdf")]);
  fireEvent.click(screen.getByRole("button", { name: "Run dataset" }));

  expect(await screen.findByRole("status")).toHaveTextContent("Dataset completed");
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Dataset analysis unavailable: synthetic analysis failure"
  );
  expect(screen.queryByRole("heading", { name: "Dataset overview" })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Download JSON" }));
  expect(downloadReport).toHaveBeenCalledWith(runnerResult);
});

test("clears stale analysis when a new file selection is made", async () => {
  render(
    <DigitizationDatasetHarness
      runDataset={jest.fn(async () => createCompletedResult())}
    />
  );

  selectFiles([createPdfFile("first.pdf")]);
  fireEvent.click(screen.getByRole("button", { name: "Run dataset" }));
  expect(await screen.findByRole("heading", { name: "Dataset overview" })).toBeInTheDocument();

  selectFiles([createPdfFile("second.pdf")]);

  expect(screen.queryByRole("heading", { name: "Dataset overview" })).not.toBeInTheDocument();
});

test("clears a stale completed result when a new file selection is made", async () => {
  const runDataset = jest.fn(async () => createCompletedResult());

  render(<DigitizationDatasetHarness runDataset={runDataset} />);

  selectFiles([createPdfFile("first.pdf")]);
  fireEvent.click(screen.getByRole("button", { name: "Run dataset" }));
  expect(await screen.findByRole("button", { name: "Download JSON" })).toBeInTheDocument();

  selectFiles([createPdfFile("second.pdf")]);

  expect(screen.queryByRole("button", { name: "Download JSON" })).not.toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

test("keeps downloads unavailable when dataset execution fails", async () => {
  const createDatasetReport = jest.fn();
  const runDataset = jest.fn(async () => {
    throw new Error("synthetic dataset failure");
  });

  render(
    <DigitizationDatasetHarness
      runDataset={runDataset}
      createDatasetReport={createDatasetReport}
    />
  );

  selectFiles([createPdfFile("failed.pdf")]);
  fireEvent.click(screen.getByRole("button", { name: "Run dataset" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Dataset failed: synthetic dataset failure"
  );
  expect(screen.queryByRole("button", { name: "Download JSON" })).not.toBeInTheDocument();
  expect(createDatasetReport).not.toHaveBeenCalled();
});

test("does not render or invoke dataset behavior outside development and test", () => {
  const runDataset = jest.fn();
  const downloadReport = jest.fn();
  const createDatasetReport = jest.fn();

  const { container } = render(
    <DigitizationDatasetHarness
      runDataset={runDataset}
      downloadReport={downloadReport}
      createDatasetReport={createDatasetReport}
      readEnvironment={() => "production"}
    />
  );

  expect(container).toBeEmptyDOMElement();
  expect(runDataset).not.toHaveBeenCalled();
  expect(downloadReport).not.toHaveBeenCalled();
  expect(createDatasetReport).not.toHaveBeenCalled();
});

test("does not use browser persistence or add evaluation output", async () => {
  const storageSpy = jest.spyOn(Storage.prototype, "setItem");
  const runDataset = jest.fn(async () => createCompletedResult());

  try {
    render(<DigitizationDatasetHarness runDataset={runDataset} />);
    selectFiles([createPdfFile("plain.pdf")]);
    fireEvent.click(screen.getByRole("button", { name: "Run dataset" }));

    await screen.findByRole("status");
    expect(storageSpy).not.toHaveBeenCalled();
    expect(screen.queryByText(/rank|score|winner|recommendation/i)).not.toBeInTheDocument();
  } finally {
    storageSpy.mockRestore();
  }
});

test("creates and downloads a separate validation report after ground truth is loaded", async () => {
  const runnerResult = createCompletedResult();
  const datasetReport = {
    type: "digitization-dataset-report",
    version: 1,
    datasetRun: { datasetId: "localhost-pdf-dataset" },
    items: []
  };
  const validationReport = {
    type: "shadow-grid-validation-report",
    version: 1,
    status: "complete",
    datasetId: "localhost-pdf-dataset"
  };
  const createValidationReport = jest.fn(() => validationReport);
  const downloadValidationReport = jest.fn();
  const groundTruthFile = {
    name: "ground-truth.json",
    text: jest.fn(async () => JSON.stringify(createGroundTruthFixture()))
  };

  render(
    <DigitizationDatasetHarness
      runDataset={jest.fn(async () => runnerResult)}
      createDatasetReport={() => datasetReport}
      createFailureReport={() => createFailureReport()}
      createAnalysisSummary={() => createAnalysisSummary()}
      createValidationReport={createValidationReport}
      downloadValidationReport={downloadValidationReport}
    />
  );

  selectFiles([createPdfFile("one.pdf")]);
  fireEvent.click(screen.getByRole("button", { name: "Run dataset" }));
  await screen.findByRole("heading", { name: "Dataset overview" });
  fireEvent.change(screen.getByLabelText("Load ground truth JSON"), {
    target: { files: [groundTruthFile] }
  });

  await waitFor(() => expect(createValidationReport).toHaveBeenCalledTimes(1));
  const invocation = createValidationReport.mock.calls[0][0];

  expect(invocation.datasetReport).toBe(datasetReport);
  expect(invocation.groundTruth).toEqual(expect.objectContaining({
    type: "digitization-grid-ground-truth",
    datasetId: "localhost-pdf-dataset"
  }));
  expect(datasetReport).not.toHaveProperty("validation");

  fireEvent.click(screen.getByRole("button", {
    name: "Download validation JSON"
  }));
  expect(downloadValidationReport).toHaveBeenCalledTimes(1);
  expect(downloadValidationReport).toHaveBeenCalledWith(validationReport);
});

function selectFiles(files) {
  fireEvent.change(screen.getByLabelText("Select local PDFs"), {
    target: { files }
  });
}

function createPdfFile(name) {
  return new File(["pdf"], name, {
    type: "application/pdf"
  });
}

function createCompletedResult() {
  return {
    type: "digitization-dataset-run",
    version: 1,
    datasetId: "localhost-pdf-dataset",
    status: "completed",
    inventory: {
      totalItemCount: 1,
      completedItemCount: 1,
      failedItemCount: 0
    },
    items: []
  };
}

function createGroundTruthFixture() {
  return {
    type: "digitization-grid-ground-truth",
    version: 1,
    datasetId: "localhost-pdf-dataset",
    coordinatePolicy: GRID_GROUND_TRUTH_COORDINATE_POLICY,
    annotations: [
      {
        itemId: "local-pdf-001",
        filename: "one.pdf",
        document: { width: 100, height: 120 },
        gridBounds: { top: 10, left: 5, width: 20, height: 20 },
        horizontalLinePositions: [10, 20, 30],
        verticalLinePositions: [5, 15, 25],
        rows: 2,
        cols: 2,
        annotation: { status: "human-confirmed" }
      }
    ]
  };
}

function createAnalysisSummary() {
  return {
    type: "digitization-dataset-analysis-summary",
    version: 1,
    dataset: {
      datasetId: "localhost-pdf-dataset",
      itemCount: 0
    },
    sections: {
      completion: {
        summary: "Supplied integration completion.",
        totalCount: 0,
        completedCount: 0,
        incompleteCount: 0
      },
      gridDetection: {
        summary: "Supplied grid detection.",
        detectedCount: 0,
        notDetectedCount: 0,
        productionFailedCount: 0,
        productionNotRunCount: 0,
        unavailableCount: 0
      },
      productionFailureReasons: {
        summary: "No production failure reasons were recorded.",
        affectedItemCount: 0,
        reasons: []
      },
      productionConfidence: {
        summary: "No production confidence values were recorded.",
        availableItemCount: 0,
        unavailableItemCount: 0,
        values: [],
        unavailableItemIds: []
      },
      frequentExperimentObservations: {
        summary: "No available experiment observations were recorded.",
        maximumItemCount: null,
        observations: []
      },
      recurringDiagnosticPatterns: {
        summary: "No recurring production diagnostic patterns were recorded.",
        patterns: []
      }
    }
  };
}

function createFailureReport() {
  return {
    type: "grid-detection-failure-report",
    version: 1,
    dataset: {
      datasetId: "localhost-pdf-dataset",
      itemCount: 0
    },
    production: {
      outcomes: {
        detectedCount: 0,
        notDetectedCount: 0,
        productionFailedCount: 0,
        productionNotRunCount: 0,
        unavailableCount: 0,
        items: []
      },
      failureReasons: {
        affectedItemCount: 0,
        groups: []
      },
      confidence: {
        availableItemCount: 0,
        unavailableItemCount: 0,
        values: [],
        unavailableItemIds: []
      }
    },
    experiments: {
      itemCountWithBenchmark: 0,
      itemCountWithoutBenchmark: 0,
      experiments: []
    },
    recurringDiagnosticPatterns: {
      patterns: []
    }
  };
}
