import React, { useState } from "react";
import { runLocalPdfDigitizationDataset } from "./runLocalPdfDigitizationDataset";
import {
  createDigitizationDatasetReportProjection,
  downloadDigitizationDatasetReport
} from "./digitizationDatasetReportExport";
import { createGridDetectionFailureReport } from "./gridDetectionFailureReport";
import { createDatasetAnalysisSummary } from "./datasetAnalysisSummary";
import DevelopmentDatasetAnalysisView from "./DevelopmentDatasetAnalysisView";
import GridGroundTruthAnnotationHarness from "./GridGroundTruthAnnotationHarness";
import { createShadowGridValidationReport } from "./shadowGridValidationReport";
import { downloadShadowGridValidationReport } from "./shadowGridValidationReportExport";

const LOCAL_DATASET_ID = "localhost-pdf-dataset";

export default function DigitizationDatasetHarness({
  runDataset = runLocalPdfDigitizationDataset,
  downloadReport = downloadDigitizationDatasetReport,
  createDatasetReport = createDigitizationDatasetReportProjection,
  createFailureReport = createGridDetectionFailureReport,
  createAnalysisSummary = createDatasetAnalysisSummary,
  createValidationReport = createShadowGridValidationReport,
  downloadValidationReport = downloadShadowGridValidationReport,
  readEnvironment = () => process.env.NODE_ENV,
  readHostname = () => (
    typeof window === "undefined" ? "" : window.location.hostname
  )
}) {
  const environment = readEnvironment();
  const hostname = readHostname();
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [status, setStatus] = useState("idle");
  const [datasetResult, setDatasetResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [analysisReports, setAnalysisReports] = useState(null);
  const [analysisErrorMessage, setAnalysisErrorMessage] = useState("");
  const [datasetReport, setDatasetReport] = useState(null);
  const [groundTruth, setGroundTruth] = useState(null);
  const [validationReport, setValidationReport] = useState(null);
  const [validationErrorMessage, setValidationErrorMessage] = useState("");
  const datasetItems = createDatasetItems(selectedFiles);

  if (
    environment !== "test"
    && (
      environment !== "development"
      || !isLocalHostname(hostname)
    )
  ) {
    return null;
  }

  const handleFileSelection = event => {
    setSelectedFiles(Array.from(event.target.files || []));
    setStatus("idle");
    setDatasetResult(null);
    setErrorMessage("");
    setAnalysisReports(null);
    setAnalysisErrorMessage("");
    setDatasetReport(null);
    setGroundTruth(null);
    setValidationReport(null);
    setValidationErrorMessage("");
  };

  const handleRun = async () => {
    setStatus("running");
    setDatasetResult(null);
    setErrorMessage("");
    setAnalysisReports(null);
    setAnalysisErrorMessage("");
    setDatasetReport(null);
    setGroundTruth(null);
    setValidationReport(null);
    setValidationErrorMessage("");

    try {
      const result = await runDataset({
        datasetId: LOCAL_DATASET_ID,
        items: datasetItems
      });

      setDatasetResult(result);
      setStatus("completed");

      try {
        const datasetReport = createDatasetReport(result);
        setDatasetReport(datasetReport);
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

  const handleDatasetReportDownload = () => {
    downloadReport(datasetResult);
  };

  const handleGroundTruthChange = groundTruth => {
    setGroundTruth(groundTruth);
    setValidationReport(null);
    setValidationErrorMessage("");
  };

  const handleCreateValidationReport = () => {
    if (!groundTruth || !datasetReport) {
      return;
    }

    try {
      setValidationReport(createValidationReport({
        datasetReport,
        groundTruth
      }));
    } catch (error) {
      setValidationErrorMessage(
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  const confirmedItemCount = groundTruth?.annotations?.length ?? 0;
  const datasetStatus = describeDatasetStatus(status, selectedFiles.length);
  const annotationStatus = datasetReport
    ? "Ready for annotation or ground-truth loading"
    : "Waiting for a completed dataset report";
  const groundTruthStatus = describeGroundTruthStatus(
    groundTruth,
    datasetItems.length
  );
  const validationStatus = validationReport
    ? "Completed"
    : validationErrorMessage
      ? "Failed"
      : groundTruth && datasetReport
        ? "Ready to create"
        : "Waiting for confirmed ground truth";
  const validationDownloadStatus = validationReport
    ? "Ready"
    : "Waiting for a completed validation report";

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
      <ol aria-label="Phase 5A validation workflow">
        <WorkflowStep title="Run dataset" status={datasetStatus} />
        <WorkflowStep title="Annotate ground truth" status={annotationStatus} />
        <WorkflowStep title="Confirm ground truth" status={groundTruthStatus} />
        <WorkflowStep
          title="Create shadow grid validation report"
          status={validationStatus}
        />
        <WorkflowStep
          title="Download validation report"
          status={validationDownloadStatus}
        />
      </ol>
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
        <button type="button" onClick={handleDatasetReportDownload}>
          Download digitization dataset report JSON
        </button>
      )}
      {status === "completed" && (
        <span role="status" aria-label="Dataset status">Dataset completed</span>
      )}
      {status === "failed" && (
        <span role="alert">Dataset failed: {errorMessage}</span>
      )}
      {analysisErrorMessage && (
        <span role="alert">
          Dataset analysis unavailable: {analysisErrorMessage}
        </span>
      )}
      {validationErrorMessage && (
        <span role="alert">
          Grid validation unavailable: {validationErrorMessage}
        </span>
      )}
      {analysisReports && (
        <DevelopmentDatasetAnalysisView
          analysisSummary={analysisReports.analysisSummary}
          failureReport={analysisReports.failureReport}
          readEnvironment={readEnvironment}
        />
      )}
      {status === "completed" && datasetReport && (
        <GridGroundTruthAnnotationHarness
          datasetId={LOCAL_DATASET_ID}
          items={datasetItems}
          validationReport={validationReport}
          onGroundTruthChange={handleGroundTruthChange}
          readEnvironment={readEnvironment}
          readHostname={readHostname}
        />
      )}
      {status === "completed" && datasetReport && (
        <button
          type="button"
          disabled={!groundTruth || confirmedItemCount === 0}
          onClick={handleCreateValidationReport}
        >
          Create shadow grid validation report
        </button>
      )}
      {validationReport && (
        <>
          <span role="status" aria-label="Validation status">
            Shadow grid validation report completed
          </span>
          <button
            type="button"
            onClick={() => downloadValidationReport(validationReport)}
          >
            Download shadow grid validation report JSON
          </button>
        </>
      )}
    </section>
  );
}

function WorkflowStep({ title, status }) {
  return (
    <li>
      <strong>{title}</strong>{" "}
      <span aria-label={`${title} status`}>{status}</span>
    </li>
  );
}

function describeDatasetStatus(status, selectedFileCount) {
  if (status === "running") {
    return "Running";
  }

  if (status === "completed") {
    return "Completed";
  }

  if (status === "failed") {
    return "Failed";
  }

  return selectedFileCount > 0 ? "Ready to run" : "Not started";
}

function describeGroundTruthStatus(groundTruth, itemCount) {
  const confirmedCount = groundTruth?.annotations?.length ?? 0;

  if (confirmedCount === 0) {
    return "No confirmed ground truth";
  }

  if (confirmedCount === itemCount) {
    return `Confirmed for all ${itemCount} item(s)`;
  }

  return `Confirmed for ${confirmedCount} of ${itemCount} item(s)`;
}

function isLocalHostname(hostname) {
  return hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "[::1]"
    || hostname === "::1";
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
