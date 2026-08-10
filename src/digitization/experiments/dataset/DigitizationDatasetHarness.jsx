import React, { useState } from "react";
import { runLocalPdfDigitizationDataset } from "./runLocalPdfDigitizationDataset";
import {
  createDigitizationDatasetReportProjection,
  downloadDigitizationDatasetReport
} from "./digitizationDatasetReportExport";
import { createGridDetectionFailureReport } from "./gridDetectionFailureReport";
import { createDatasetAnalysisSummary } from "./datasetAnalysisSummary";
import DevelopmentDatasetAnalysisView from "./DevelopmentDatasetAnalysisView";

const LOCAL_DATASET_ID = "localhost-pdf-dataset";

export default function DigitizationDatasetHarness({
  runDataset = runLocalPdfDigitizationDataset,
  downloadReport = downloadDigitizationDatasetReport,
  createDatasetReport = createDigitizationDatasetReportProjection,
  createFailureReport = createGridDetectionFailureReport,
  createAnalysisSummary = createDatasetAnalysisSummary,
  readEnvironment = () => process.env.NODE_ENV
}) {
  const environment = readEnvironment();
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [status, setStatus] = useState("idle");
  const [datasetResult, setDatasetResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [analysisReports, setAnalysisReports] = useState(null);
  const [analysisErrorMessage, setAnalysisErrorMessage] = useState("");

  if (environment !== "development" && environment !== "test") {
    return null;
  }

  const handleFileSelection = event => {
    setSelectedFiles(Array.from(event.target.files || []));
    setStatus("idle");
    setDatasetResult(null);
    setErrorMessage("");
    setAnalysisReports(null);
    setAnalysisErrorMessage("");
  };

  const handleRun = async () => {
    setStatus("running");
    setDatasetResult(null);
    setErrorMessage("");
    setAnalysisReports(null);
    setAnalysisErrorMessage("");

    try {
      const result = await runDataset({
        datasetId: LOCAL_DATASET_ID,
        items: createDatasetItems(selectedFiles)
      });

      setDatasetResult(result);
      setStatus("completed");

      try {
        const datasetReport = createDatasetReport(result);
        const failureReport = createFailureReport(datasetReport);
        const analysisSummary = createAnalysisSummary({
          datasetReport,
          failureReport
        });

        setAnalysisReports({
          analysisSummary,
          failureReport
        });
      } catch (analysisError) {
        setAnalysisErrorMessage(
          analysisError instanceof Error
            ? analysisError.message
            : String(analysisError)
        );
      }
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
      {analysisErrorMessage && (
        <span role="alert">
          Dataset analysis unavailable: {analysisErrorMessage}
        </span>
      )}
      {analysisReports && (
        <DevelopmentDatasetAnalysisView
          analysisSummary={analysisReports.analysisSummary}
          failureReport={analysisReports.failureReport}
          readEnvironment={readEnvironment}
        />
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
