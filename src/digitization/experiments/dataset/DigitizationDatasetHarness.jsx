import React, { useState } from "react";
import { runLocalPdfDigitizationDataset } from "./runLocalPdfDigitizationDataset";
import { downloadDigitizationDatasetReport } from "./digitizationDatasetReportExport";

const LOCAL_DATASET_ID = "localhost-pdf-dataset";

export default function DigitizationDatasetHarness({
  runDataset = runLocalPdfDigitizationDataset,
  downloadReport = downloadDigitizationDatasetReport,
  readEnvironment = () => process.env.NODE_ENV
}) {
  const environment = readEnvironment();
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [status, setStatus] = useState("idle");
  const [datasetResult, setDatasetResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  if (environment !== "development" && environment !== "test") {
    return null;
  }

  const handleFileSelection = event => {
    setSelectedFiles(Array.from(event.target.files || []));
    setStatus("idle");
    setDatasetResult(null);
    setErrorMessage("");
  };

  const handleRun = async () => {
    setStatus("running");
    setDatasetResult(null);
    setErrorMessage("");

    try {
      const result = await runDataset({
        datasetId: LOCAL_DATASET_ID,
        items: createDatasetItems(selectedFiles)
      });

      setDatasetResult(result);
      setStatus("completed");
    } catch (error) {
      setStatus("failed");
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const handleDownload = () => {
    downloadReport(datasetResult);
  };

  return (
    <section
      aria-label="Digitization Lab"
      style={{
        borderTop: "1px solid #d8dee9",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        marginTop: "12px",
        paddingTop: "12px"
      }}
    >
      <h6 style={{ fontSize: "13px", margin: 0 }}>Digitization Lab</h6>
      <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        Select local PDFs
        <input
          aria-label="Select local PDFs"
          type="file"
          accept="application/pdf,.pdf"
          multiple
          onChange={handleFileSelection}
        />
      </label>
      <span style={{ color: "#475569", fontSize: "12px" }}>
        {selectedFiles.length === 0
          ? "No PDF files selected"
          : `${selectedFiles.length} PDF file(s) selected`}
      </span>
      <button
        type="button"
        disabled={selectedFiles.length === 0 || status === "running"}
        onClick={handleRun}
      >
        {status === "running" ? "Running dataset…" : "Run dataset"}
      </button>
      {status === "completed" && datasetResult && (
        <button type="button" onClick={handleDownload}>
          Download JSON
        </button>
      )}
      {status === "completed" && (
        <span role="status">Dataset completed</span>
      )}
      {status === "failed" && (
        <span role="alert">Dataset failed: {errorMessage}</span>
      )}
    </section>
  );
}

function createDatasetItems(files) {
  return files.map((file, index) => ({
    id: `local-pdf-${String(index + 1).padStart(3, "0")}`,
    input: {
      kind: "pdf",
      file
    },
    metadata: {
      filename: file.name
    }
  }));
}
