import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import DigitizationDatasetHarness from "./DigitizationDatasetHarness";
import {
  createGridGroundTruth,
  createGridGroundTruthExport,
  GRID_GROUND_TRUTH_COORDINATE_POLICY
} from "./gridGroundTruth";
import * as pdfjsLib from "pdfjs-dist";

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
  expect(screen.queryByRole("button", {
    name: "Download digitization dataset report JSON"
  })).not.toBeInTheDocument();
  const workflow = screen.getByRole("list", {
    name: "Phase 5A validation workflow"
  });
  expect(Array.from(workflow.querySelectorAll("strong"), element => (
    element.textContent
  ))).toEqual([
    "Run dataset",
    "Annotate ground truth",
    "Confirm ground truth",
    "Create shadow grid validation report",
    "Download validation report",
    "Create grid reconstruction validation report",
    "Download grid reconstruction validation report",
    "Create Grid Bounds Lattice Extension Validation Report",
    "Download Grid Bounds Lattice Extension Validation Report JSON",
    "Create Outer Line Center Validation Report",
    "Download Outer Line Center Validation Report JSON"
  ]);
  expect(screen.getByLabelText("Run dataset status")).toHaveTextContent("Not started");
  expect(screen.getByLabelText("Annotate ground truth status"))
    .toHaveTextContent("Waiting for a completed dataset report");
  expect(screen.getByLabelText("Confirm ground truth status"))
    .toHaveTextContent("No confirmed ground truth");
  expect(screen.getByLabelText("Create shadow grid validation report status"))
    .toHaveTextContent("Waiting for confirmed ground truth");
  expect(screen.getByLabelText("Download validation report status"))
    .toHaveTextContent("Waiting for a completed validation report");
  expect(screen.getByLabelText("Create grid reconstruction validation report status"))
    .toHaveTextContent("Waiting for confirmed ground truth");
  expect(screen.getByLabelText("Download grid reconstruction validation report status"))
    .toHaveTextContent("Waiting for a completed reconstruction validation report");
  expect(screen.getByLabelText(
    "Create Grid Bounds Lattice Extension Validation Report status"
  )).toHaveTextContent("Waiting for confirmed ground truth");
  expect(screen.getByLabelText(
    "Download Grid Bounds Lattice Extension Validation Report JSON status"
  )).toHaveTextContent(
    "Waiting for a completed grid bounds lattice extension validation report"
  );
  expect(screen.getByLabelText(
    "Create Outer Line Center Validation Report status"
  )).toHaveTextContent("Waiting for confirmed ground truth");
  expect(screen.getByLabelText(
    "Download Outer Line Center Validation Report JSON status"
  )).toHaveTextContent(
    "Waiting for a completed outer line center validation report"
  );
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
  expect(await screen.findByRole("status", { name: "Dataset status" }))
    .toHaveTextContent("Dataset completed");
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
    name: "Download digitization dataset report JSON"
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

  expect(await screen.findByRole("status", { name: "Dataset status" }))
    .toHaveTextContent("Dataset completed");
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Dataset analysis unavailable: synthetic analysis failure"
  );
  expect(screen.queryByRole("heading", { name: "Dataset overview" })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", {
    name: "Download digitization dataset report JSON"
  }));
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
  expect(await screen.findByRole("button", {
    name: "Download digitization dataset report JSON"
  })).toBeInTheDocument();

  selectFiles([createPdfFile("second.pdf")]);

  expect(screen.queryByRole("button", {
    name: "Download digitization dataset report JSON"
  })).not.toBeInTheDocument();
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
  expect(screen.queryByRole("button", {
    name: "Download digitization dataset report JSON"
  })).not.toBeInTheDocument();
  expect(createDatasetReport).not.toHaveBeenCalled();
});

test("does not render or invoke dataset behavior outside localhost development and test", () => {
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

  const remoteDevelopment = render(
    <DigitizationDatasetHarness
      runDataset={runDataset}
      downloadReport={downloadReport}
      createDatasetReport={createDatasetReport}
      readEnvironment={() => "development"}
      readHostname={() => "example.com"}
    />
  );

  expect(remoteDevelopment.container).toBeEmptyDOMElement();
  expect(runDataset).not.toHaveBeenCalled();
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

test("creates and downloads a separate validation report only after explicit action", async () => {
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

  await waitFor(() => expect(screen.getByLabelText("Confirm ground truth status"))
    .toHaveTextContent("Confirmed for all 1 item(s)"));
  expect(createValidationReport).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", {
    name: "Download shadow grid validation report JSON"
  })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", {
    name: "Create shadow grid validation report"
  }));

  expect(createValidationReport).toHaveBeenCalledTimes(1);
  const invocation = createValidationReport.mock.calls[0][0];

  expect(invocation.datasetReport).toBe(datasetReport);
  expect(invocation.groundTruth).toEqual(expect.objectContaining({
    type: "digitization-grid-ground-truth",
    datasetId: "localhost-pdf-dataset"
  }));
  expect(datasetReport).not.toHaveProperty("validation");
  expect(screen.getByLabelText("Create shadow grid validation report status"))
    .toHaveTextContent("Completed");

  fireEvent.click(screen.getByRole("button", {
    name: "Download shadow grid validation report JSON"
  }));
  expect(downloadValidationReport).toHaveBeenCalledTimes(1);
  expect(downloadValidationReport).toHaveBeenCalledWith(validationReport);
});

test("creates and downloads reconstruction validation only after explicit action", async () => {
  const runnerResult = createCompletedResult();
  const datasetReport = {
    type: "digitization-dataset-report",
    version: 1,
    datasetRun: { datasetId: "localhost-pdf-dataset" },
    items: []
  };
  const reconstructionValidationReport = {
    type: "grid-reconstruction-validation-report",
    version: 1,
    status: "complete",
    datasetId: "localhost-pdf-dataset"
  };
  const createReconstructionValidationReport = jest.fn(
    () => reconstructionValidationReport
  );
  const downloadReconstructionValidationReport = jest.fn();

  render(
    <DigitizationDatasetHarness
      runDataset={jest.fn(async () => runnerResult)}
      createDatasetReport={() => datasetReport}
      createFailureReport={() => createFailureReport()}
      createAnalysisSummary={() => createAnalysisSummary()}
      createReconstructionValidationReport={createReconstructionValidationReport}
      downloadReconstructionValidationReport={downloadReconstructionValidationReport}
    />
  );

  selectFiles([createPdfFile("one.pdf")]);
  fireEvent.click(screen.getByRole("button", { name: "Run dataset" }));
  await screen.findByLabelText("Load ground truth JSON");
  loadGroundTruth(createGroundTruthFixture());
  await waitFor(() => expect(screen.getByRole("button", {
    name: "Create grid reconstruction validation report"
  })).toBeEnabled());

  expect(createReconstructionValidationReport).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", {
    name: "Download grid reconstruction validation report JSON"
  })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", {
    name: "Create grid reconstruction validation report"
  }));

  expect(createReconstructionValidationReport).toHaveBeenCalledTimes(1);
  const invocation = createReconstructionValidationReport.mock.calls[0][0];
  expect(invocation.datasetReport).toBe(datasetReport);
  expect(invocation.groundTruth).toEqual(expect.objectContaining({
    type: "digitization-grid-ground-truth",
    datasetId: "localhost-pdf-dataset"
  }));
  expect(datasetReport).not.toHaveProperty("validation");
  expect(screen.getByLabelText(
    "Create grid reconstruction validation report status"
  )).toHaveTextContent("Completed");

  fireEvent.click(screen.getByRole("button", {
    name: "Download grid reconstruction validation report JSON"
  }));
  expect(downloadReconstructionValidationReport).toHaveBeenCalledTimes(1);
  expect(downloadReconstructionValidationReport)
    .toHaveBeenCalledWith(reconstructionValidationReport);
});

test("replacing ground truth invalidates reconstruction validation", async () => {
  const reconstructionValidationReport = {
    type: "grid-reconstruction-validation-report",
    version: 1,
    status: "complete",
    datasetId: "localhost-pdf-dataset"
  };
  const createReconstructionValidationReport = jest.fn(
    () => reconstructionValidationReport
  );

  render(
    <DigitizationDatasetHarness
      runDataset={jest.fn(async () => createCompletedResult())}
      createReconstructionValidationReport={createReconstructionValidationReport}
    />
  );

  selectFiles([createPdfFile("one.pdf")]);
  fireEvent.click(screen.getByRole("button", { name: "Run dataset" }));
  await screen.findByLabelText("Load ground truth JSON");
  loadGroundTruth(createGroundTruthFixture());
  await waitFor(() => expect(screen.getByRole("button", {
    name: "Create grid reconstruction validation report"
  })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", {
    name: "Create grid reconstruction validation report"
  }));
  expect(screen.getByRole("button", {
    name: "Download grid reconstruction validation report JSON"
  })).toBeInTheDocument();

  loadGroundTruth(createGroundTruthFixture());

  await waitFor(() => expect(screen.queryByRole("button", {
    name: "Download grid reconstruction validation report JSON"
  })).not.toBeInTheDocument());
  expect(createReconstructionValidationReport).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText(
    "Create grid reconstruction validation report status"
  )).toHaveTextContent("Ready to create");
});

test("replacing ground truth invalidates an existing validation report", async () => {
  const validationReport = {
    type: "shadow-grid-validation-report",
    version: 1,
    status: "complete",
    datasetId: "localhost-pdf-dataset"
  };
  const createValidationReport = jest.fn(() => validationReport);

  render(
    <DigitizationDatasetHarness
      runDataset={jest.fn(async () => createCompletedResult())}
      createValidationReport={createValidationReport}
    />
  );

  selectFiles([createPdfFile("one.pdf")]);
  fireEvent.click(screen.getByRole("button", { name: "Run dataset" }));
  await screen.findByLabelText("Load ground truth JSON");

  loadGroundTruth(createGroundTruthFixture());
  await waitFor(() => expect(screen.getByRole("button", {
    name: "Create shadow grid validation report"
  })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", {
    name: "Create shadow grid validation report"
  }));
  expect(screen.getByRole("button", {
    name: "Download shadow grid validation report JSON"
  })).toBeInTheDocument();

  loadGroundTruth(createGroundTruthFixture());

  await waitFor(() => expect(screen.queryByRole("button", {
    name: "Download shadow grid validation report JSON"
  })).not.toBeInTheDocument());
  expect(createValidationReport).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("Create shadow grid validation report status"))
    .toHaveTextContent("Ready to create");
});

test("creates and downloads bounds lattice extension validation only after explicit action", async () => {
  const runnerResult = createCompletedResult();
  const datasetReport = {
    type: "digitization-dataset-report",
    version: 1,
    datasetRun: { datasetId: "localhost-pdf-dataset" },
    items: []
  };
  const boundsValidationReport = {
    type: "grid-bounds-lattice-extension-validation-report",
    version: 1,
    status: "complete",
    datasetId: "localhost-pdf-dataset"
  };
  const runDataset = jest.fn(async () => runnerResult);
  const createBoundsValidation = jest.fn(() => boundsValidationReport);
  const downloadBoundsValidation = jest.fn();

  render(
    <DigitizationDatasetHarness
      runDataset={runDataset}
      createDatasetReport={() => datasetReport}
      createFailureReport={() => createFailureReport()}
      createAnalysisSummary={() => createAnalysisSummary()}
      createBoundsLatticeExtensionValidationReport={createBoundsValidation}
      downloadBoundsLatticeExtensionValidationReport={downloadBoundsValidation}
    />
  );

  selectFiles([createPdfFile("one.pdf")]);
  fireEvent.click(screen.getByRole("button", { name: "Run dataset" }));
  await screen.findByLabelText("Load ground truth JSON");

  const createButton = screen.getByRole("button", {
    name: "Create Grid Bounds Lattice Extension Validation Report"
  });
  expect(createButton).toBeDisabled();
  expect(screen.queryByRole("button", {
    name: "Download Grid Bounds Lattice Extension Validation Report JSON"
  })).not.toBeInTheDocument();

  loadGroundTruth(createGroundTruthFixture());
  await waitFor(() => expect(createButton).toBeEnabled());
  expect(createBoundsValidation).not.toHaveBeenCalled();

  fireEvent.click(createButton);

  expect(createBoundsValidation).toHaveBeenCalledTimes(1);
  expect(createBoundsValidation).toHaveBeenCalledWith({
    datasetReport,
    groundTruth: expect.objectContaining({
      type: "digitization-grid-ground-truth",
      datasetId: "localhost-pdf-dataset"
    })
  });
  expect(runDataset).toHaveBeenCalledTimes(1);
  expect(datasetReport).not.toHaveProperty("validation");
  expect(screen.getByLabelText(
    "Create Grid Bounds Lattice Extension Validation Report status"
  )).toHaveTextContent("Completed");

  fireEvent.click(screen.getByRole("button", {
    name: "Download Grid Bounds Lattice Extension Validation Report JSON"
  }));
  expect(downloadBoundsValidation).toHaveBeenCalledTimes(1);
  expect(downloadBoundsValidation).toHaveBeenCalledWith(boundsValidationReport);
});

test("replacing ground truth invalidates bounds lattice extension validation", async () => {
  const createBoundsValidation = jest.fn(() => ({
    type: "grid-bounds-lattice-extension-validation-report",
    version: 1,
    status: "complete"
  }));

  render(
    <DigitizationDatasetHarness
      runDataset={jest.fn(async () => createCompletedResult())}
      createBoundsLatticeExtensionValidationReport={createBoundsValidation}
    />
  );

  selectFiles([createPdfFile("one.pdf")]);
  fireEvent.click(screen.getByRole("button", { name: "Run dataset" }));
  await screen.findByLabelText("Load ground truth JSON");
  loadGroundTruth(createGroundTruthFixture());
  await waitFor(() => expect(screen.getByRole("button", {
    name: "Create Grid Bounds Lattice Extension Validation Report"
  })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", {
    name: "Create Grid Bounds Lattice Extension Validation Report"
  }));
  expect(screen.getByRole("button", {
    name: "Download Grid Bounds Lattice Extension Validation Report JSON"
  })).toBeInTheDocument();

  loadGroundTruth(createGroundTruthFixture());

  await waitFor(() => expect(screen.queryByRole("button", {
    name: "Download Grid Bounds Lattice Extension Validation Report JSON"
  })).not.toBeInTheDocument());
  expect(createBoundsValidation).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText(
    "Create Grid Bounds Lattice Extension Validation Report status"
  )).toHaveTextContent("Ready to create");
});

test("new PDF selection and dataset rerun invalidate bounds lattice extension validation", async () => {
  const runDataset = jest.fn(async () => createCompletedResult());
  const createBoundsValidation = jest.fn(() => ({
    type: "grid-bounds-lattice-extension-validation-report",
    version: 1,
    status: "complete"
  }));

  render(
    <DigitizationDatasetHarness
      runDataset={runDataset}
      createBoundsLatticeExtensionValidationReport={createBoundsValidation}
    />
  );

  selectFiles([createPdfFile("one.pdf")]);
  fireEvent.click(screen.getByRole("button", { name: "Run dataset" }));
  await screen.findByLabelText("Load ground truth JSON");
  loadGroundTruth(createGroundTruthFixture());
  await waitFor(() => expect(screen.getByRole("button", {
    name: "Create Grid Bounds Lattice Extension Validation Report"
  })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", {
    name: "Create Grid Bounds Lattice Extension Validation Report"
  }));
  expect(screen.getByRole("button", {
    name: "Download Grid Bounds Lattice Extension Validation Report JSON"
  })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Run dataset" }));
  expect(screen.queryByRole("button", {
    name: "Download Grid Bounds Lattice Extension Validation Report JSON"
  })).not.toBeInTheDocument();
  await waitFor(() => expect(runDataset).toHaveBeenCalledTimes(2));

  selectFiles([createPdfFile("two.pdf")]);
  expect(screen.queryByRole("button", {
    name: "Download Grid Bounds Lattice Extension Validation Report JSON"
  })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", {
    name: "Create Grid Bounds Lattice Extension Validation Report"
  })).not.toBeInTheDocument();
});

test("loads an actually exported Ground Truth file into the bounds validation workflow", async () => {
  const datasetReport = {
    type: "digitization-dataset-report",
    version: 1,
    datasetRun: { datasetId: "localhost-pdf-dataset" },
    items: []
  };
  const boundsValidationReport = {
    type: "grid-bounds-lattice-extension-validation-report",
    version: 1,
    status: "complete",
    datasetId: "localhost-pdf-dataset"
  };
  const createBoundsValidation = jest.fn(() => boundsValidationReport);
  const downloadBoundsValidation = jest.fn();
  const groundTruth = createGridGroundTruth(createGroundTruthFixture());
  const exported = createGridGroundTruthExport(groundTruth);
  const exportedFile = new File(
    [exported.contents],
    exported.fileName,
    { type: exported.mimeType }
  );

  render(
    <DigitizationDatasetHarness
      runDataset={jest.fn(async () => createCompletedResult())}
      createDatasetReport={() => datasetReport}
      createFailureReport={() => createFailureReport()}
      createAnalysisSummary={() => createAnalysisSummary()}
      createBoundsLatticeExtensionValidationReport={createBoundsValidation}
      downloadBoundsLatticeExtensionValidationReport={downloadBoundsValidation}
    />
  );

  selectFiles([createPdfFile("one.pdf")]);
  fireEvent.click(screen.getByRole("button", { name: "Run dataset" }));
  await screen.findByLabelText("Load ground truth JSON");
  fireEvent.change(screen.getByLabelText("Load ground truth JSON"), {
    target: { files: [exportedFile] }
  });

  await waitFor(() => expect(screen.getByLabelText("Confirm ground truth status"))
    .toHaveTextContent("Confirmed for all 1 item(s)"));
  const createButton = screen.getByRole("button", {
    name: "Create Grid Bounds Lattice Extension Validation Report"
  });
  expect(createButton).toBeEnabled();

  fireEvent.click(createButton);

  expect(createBoundsValidation).toHaveBeenCalledWith({
    datasetReport,
    groundTruth
  });
  const downloadButton = screen.getByRole("button", {
    name: "Download Grid Bounds Lattice Extension Validation Report JSON"
  });
  expect(downloadButton).toBeInTheDocument();

  fireEvent.click(downloadButton);
  expect(downloadBoundsValidation).toHaveBeenCalledWith(boundsValidationReport);
});

test("runs dataset, loads exported Ground Truth, creates and downloads outer line center validation", async () => {
  const datasetReport = {
    type: "digitization-dataset-report",
    version: 1,
    datasetRun: { datasetId: "localhost-pdf-dataset" },
    items: []
  };
  const outerLineCenterReport = {
    type: "outer-line-center-ground-truth-validation-report",
    version: 1,
    status: "complete",
    datasetId: "localhost-pdf-dataset"
  };
  const groundTruth = createGridGroundTruth(createGroundTruthFixture());
  const exported = createGridGroundTruthExport(groundTruth);
  const exportedFile = new File(
    [exported.contents],
    exported.fileName,
    { type: exported.mimeType }
  );
  const runDataset = jest.fn(async () => createCompletedResult());
  const createOuterLineCenterValidationReport = jest.fn(
    () => outerLineCenterReport
  );
  const downloadOuterLineCenterValidationReport = jest.fn();

  render(
    <DigitizationDatasetHarness
      runDataset={runDataset}
      createDatasetReport={() => datasetReport}
      createFailureReport={() => createFailureReport()}
      createAnalysisSummary={() => createAnalysisSummary()}
      createOuterLineCenterValidationReport={
        createOuterLineCenterValidationReport
      }
      downloadOuterLineCenterValidationReport={
        downloadOuterLineCenterValidationReport
      }
    />
  );

  selectFiles([createPdfFile("one.pdf")]);
  fireEvent.click(screen.getByRole("button", { name: "Run dataset" }));
  await screen.findByLabelText("Load ground truth JSON");
  const createButton = screen.getByRole("button", {
    name: "Create Outer Line Center Validation Report"
  });

  expect(createButton).toBeDisabled();
  expect(screen.queryByRole("button", {
    name: "Download Outer Line Center Validation Report JSON"
  })).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Load ground truth JSON"), {
    target: { files: [exportedFile] }
  });

  await waitFor(() => expect(screen.getByLabelText("Confirm ground truth status"))
    .toHaveTextContent("Confirmed for all 1 item(s)"));
  expect(createButton).toBeEnabled();
  expect(createOuterLineCenterValidationReport).not.toHaveBeenCalled();

  fireEvent.click(createButton);

  expect(createOuterLineCenterValidationReport).toHaveBeenCalledTimes(1);
  expect(createOuterLineCenterValidationReport).toHaveBeenCalledWith({
    datasetReport,
    groundTruth
  });
  expect(runDataset).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText(
    "Create Outer Line Center Validation Report status"
  )).toHaveTextContent("Completed");

  const downloadButton = screen.getByRole("button", {
    name: "Download Outer Line Center Validation Report JSON"
  });
  fireEvent.click(downloadButton);

  expect(downloadOuterLineCenterValidationReport).toHaveBeenCalledTimes(1);
  expect(downloadOuterLineCenterValidationReport)
    .toHaveBeenCalledWith(outerLineCenterReport);
});

test("manual Ground Truth confirmation enables outer line center validation", async () => {
  const datasetReport = {
    type: "digitization-dataset-report",
    version: 1,
    datasetRun: { datasetId: "localhost-pdf-dataset" },
    items: []
  };
  const createOuterLineCenterValidationReport = jest.fn(() => ({
    type: "outer-line-center-ground-truth-validation-report",
    version: 1,
    status: "complete",
    datasetId: "localhost-pdf-dataset"
  }));
  const canvasContext = {
    getImageData: jest.fn()
  };
  const contextSpy = jest.spyOn(
    HTMLCanvasElement.prototype,
    "getContext"
  ).mockReturnValue(canvasContext);
  const pdfFile = createRenderablePdfFile("one.pdf");

  pdfjsLib.getDocument.mockReturnValue({
    promise: Promise.resolve({
      getPage: jest.fn(async () => ({
        getViewport: jest.fn(() => ({ width: 100, height: 120 })),
        render: jest.fn(() => ({ promise: Promise.resolve() }))
      }))
    })
  });

  try {
    render(
      <DigitizationDatasetHarness
        runDataset={jest.fn(async () => createCompletedResult())}
        createDatasetReport={() => datasetReport}
        createFailureReport={() => createFailureReport()}
        createAnalysisSummary={() => createAnalysisSummary()}
        createOuterLineCenterValidationReport={
          createOuterLineCenterValidationReport
        }
      />
    );

    selectFiles([pdfFile]);
    fireEvent.click(screen.getByRole("button", { name: "Run dataset" }));
    await screen.findByRole("button", { name: "Render selected PDF" });
    fireEvent.click(screen.getByRole("button", { name: "Render selected PDF" }));
    await screen.findByLabelText("Rendered PDF page 1 at scale 2");
    placeManualBoundaries({ top: 10, bottom: 30, left: 5, right: 25 });
    fireEvent.change(screen.getByLabelText("Rows"), {
      target: { value: "2" }
    });
    fireEvent.change(screen.getByLabelText("Columns"), {
      target: { value: "2" }
    });
    fireEvent.click(screen.getByRole("button", {
      name: "Generate draft line handles"
    }));

    const createButton = screen.getByRole("button", {
      name: "Create Outer Line Center Validation Report"
    });
    expect(createButton).toBeDisabled();

    fireEvent.click(screen.getByRole("button", {
      name: "Confirm ground truth for selected item"
    }));

    await waitFor(() => expect(createButton).toBeEnabled());
    fireEvent.click(createButton);

    expect(createOuterLineCenterValidationReport).toHaveBeenCalledTimes(1);
    expect(createOuterLineCenterValidationReport.mock.calls[0][0]).toEqual({
      datasetReport,
      groundTruth: expect.objectContaining({
        type: "digitization-grid-ground-truth",
        datasetId: "localhost-pdf-dataset",
        annotations: [expect.objectContaining({
          itemId: "local-pdf-001",
          filename: "one.pdf",
          annotation: expect.objectContaining({ status: "human-confirmed" })
        })]
      })
    });
  } finally {
    contextSpy.mockRestore();
    pdfjsLib.getDocument.mockReset();
  }
});

test("Ground Truth, dataset rerun and PDF changes invalidate outer line center validation", async () => {
  const runDataset = jest.fn(async () => createCompletedResult());
  const createOuterLineCenterValidationReport = jest.fn(() => ({
    type: "outer-line-center-ground-truth-validation-report",
    version: 1,
    status: "complete"
  }));

  render(
    <DigitizationDatasetHarness
      runDataset={runDataset}
      createOuterLineCenterValidationReport={
        createOuterLineCenterValidationReport
      }
    />
  );

  selectFiles([createPdfFile("one.pdf")]);
  fireEvent.click(screen.getByRole("button", { name: "Run dataset" }));
  await screen.findByLabelText("Load ground truth JSON");
  loadGroundTruth(createGroundTruthFixture());
  const createButton = screen.getByRole("button", {
    name: "Create Outer Line Center Validation Report"
  });
  await waitFor(() => expect(createButton).toBeEnabled());
  fireEvent.click(createButton);
  expect(screen.getByRole("button", {
    name: "Download Outer Line Center Validation Report JSON"
  })).toBeInTheDocument();

  loadGroundTruth(createGroundTruthFixture());
  await waitFor(() => expect(screen.queryByRole("button", {
    name: "Download Outer Line Center Validation Report JSON"
  })).not.toBeInTheDocument());
  expect(screen.getByLabelText(
    "Create Outer Line Center Validation Report status"
  )).toHaveTextContent("Ready to create");

  fireEvent.click(createButton);
  expect(screen.getByRole("button", {
    name: "Download Outer Line Center Validation Report JSON"
  })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Run dataset" }));
  expect(screen.queryByRole("button", {
    name: "Download Outer Line Center Validation Report JSON"
  })).not.toBeInTheDocument();
  await waitFor(() => expect(runDataset).toHaveBeenCalledTimes(2));

  loadGroundTruth(createGroundTruthFixture());
  await waitFor(() => expect(screen.getByRole("button", {
    name: "Create Outer Line Center Validation Report"
  })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", {
    name: "Create Outer Line Center Validation Report"
  }));
  expect(screen.getByRole("button", {
    name: "Download Outer Line Center Validation Report JSON"
  })).toBeInTheDocument();

  selectFiles([createPdfFile("two.pdf")]);
  expect(screen.queryByRole("button", {
    name: "Download Outer Line Center Validation Report JSON"
  })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", {
    name: "Create Outer Line Center Validation Report"
  })).not.toBeInTheDocument();
  expect(createOuterLineCenterValidationReport).toHaveBeenCalledTimes(3);
});

function selectFiles(files) {
  fireEvent.change(screen.getByLabelText("Select local PDFs"), {
    target: { files }
  });
}

function loadGroundTruth(groundTruth) {
  fireEvent.change(screen.getByLabelText("Load ground truth JSON"), {
    target: {
      files: [{
        name: "ground-truth.json",
        text: jest.fn(async () => JSON.stringify(groundTruth))
      }]
    }
  });
}

function createPdfFile(name) {
  return new File(["pdf"], name, {
    type: "application/pdf"
  });
}

function createRenderablePdfFile(name) {
  return {
    name,
    type: "application/pdf",
    arrayBuffer: jest.fn(async () => new Uint8Array([1]).buffer)
  };
}

function placeManualBoundaries({ top, bottom, left, right }) {
  const surface = screen.getByTestId("ground-truth-surface");

  for (const [name, x, y] of [
    ["top", 0, top],
    ["bottom", 0, bottom],
    ["left", left, 0],
    ["right", right, 0]
  ]) {
    fireEvent.click(screen.getByRole("button", {
      name: `Place ${name} boundary`
    }));
    fireEvent.click(surface, { clientX: x, clientY: y });
  }
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
