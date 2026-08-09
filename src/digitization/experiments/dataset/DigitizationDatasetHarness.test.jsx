import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import DigitizationDatasetHarness from "./DigitizationDatasetHarness";

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
  const runDataset = jest.fn(async () => {
    throw new Error("synthetic dataset failure");
  });

  render(<DigitizationDatasetHarness runDataset={runDataset} />);

  selectFiles([createPdfFile("failed.pdf")]);
  fireEvent.click(screen.getByRole("button", { name: "Run dataset" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Dataset failed: synthetic dataset failure"
  );
  expect(screen.queryByRole("button", { name: "Download JSON" })).not.toBeInTheDocument();
});

test("does not render or invoke dataset behavior outside development and test", () => {
  const runDataset = jest.fn();
  const downloadReport = jest.fn();

  const { container } = render(
    <DigitizationDatasetHarness
      runDataset={runDataset}
      downloadReport={downloadReport}
      readEnvironment={() => "production"}
    />
  );

  expect(container).toBeEmptyDOMElement();
  expect(runDataset).not.toHaveBeenCalled();
  expect(downloadReport).not.toHaveBeenCalled();
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
