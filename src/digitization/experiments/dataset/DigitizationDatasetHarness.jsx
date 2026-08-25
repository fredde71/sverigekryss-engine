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
import {
  createGridReconstructionValidationReport
} from "./gridReconstructionValidationReport";
import {
  downloadGridReconstructionValidationReport
} from "./gridReconstructionValidationReportExport";
import {
  createGridBoundsLatticeExtensionValidationReport
} from "./gridBoundsLatticeExtensionValidationReport";
import {
  createGridBoundsLatticeExtensionValidationReportExport
} from "./gridBoundsLatticeExtensionValidationReportExport";
import {
  createOuterLineCenterValidationReport
} from "./outerLineCenterValidationReport";
import {
  createOuterLineCenterValidationReportExport
} from "./outerLineCenterValidationReportExport";
import {
  createOuterLineCenterGeometryValidationReport
} from "./outerLineCenterGeometryValidationReport";
import {
  createOuterLineCenterGeometryValidationReportExport
} from "./outerLineCenterGeometryValidationReportExport";
import {
  createHumanAnnotationBiasDiagnostics
} from "./humanAnnotationBiasDiagnostics";
import {
  createHumanAnnotationBiasDiagnosticsExport
} from "./humanAnnotationBiasDiagnosticsExport";
import {
  createGridLatticeGeometryDiagnostics
} from "./gridLatticeGeometryDiagnostics";
import {
  createGridLatticeGeometryDiagnosticsExport
} from "./gridLatticeGeometryDiagnosticsExport";
import {
  createGridLatticePeriodicityDiagnostics
} from "./gridLatticePeriodicityDiagnostics";
import {
  createGridLatticePeriodicityDiagnosticsExport
} from "./gridLatticePeriodicityDiagnosticsExport";
import {
  createGridLatticePeriodIdentifiabilityDiagnostics
} from "./gridLatticePeriodIdentifiabilityDiagnostics";
import {
  createGridLatticePeriodIdentifiabilityDiagnosticsExport
} from "./gridLatticePeriodIdentifiabilityDiagnosticsExport";
import {
  createGridLatticePeriodRobustnessDiagnostics
} from "./gridLatticePeriodRobustnessDiagnostics";
import {
  createGridLatticePeriodRobustnessDiagnosticsExport
} from "./gridLatticePeriodRobustnessDiagnosticsExport";
import {
  createGridLatticePeriodToleranceSensitivityDiagnostics
} from "./gridLatticePeriodToleranceSensitivityDiagnostics";
import {
  createGridLatticePeriodToleranceSensitivityDiagnosticsExport
} from "./gridLatticePeriodToleranceSensitivityDiagnosticsExport";

const LOCAL_DATASET_ID = "localhost-pdf-dataset";

export default function DigitizationDatasetHarness({
  runDataset = runLocalPdfDigitizationDataset,
  downloadReport = downloadDigitizationDatasetReport,
  createDatasetReport = createDigitizationDatasetReportProjection,
  createFailureReport = createGridDetectionFailureReport,
  createAnalysisSummary = createDatasetAnalysisSummary,
  createValidationReport = createShadowGridValidationReport,
  downloadValidationReport = downloadShadowGridValidationReport,
  createReconstructionValidationReport = createGridReconstructionValidationReport,
  downloadReconstructionValidationReport = downloadGridReconstructionValidationReport,
  createBoundsLatticeExtensionValidationReport =
    createGridBoundsLatticeExtensionValidationReport,
  downloadBoundsLatticeExtensionValidationReport = report => {
    const artifact = createGridBoundsLatticeExtensionValidationReportExport(report);
    const blob = new Blob([artifact.contents], { type: artifact.mimeType });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    try {
      anchor.href = objectUrl;
      anchor.download = artifact.fileName;
      anchor.click();
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  },
  createOuterLineCenterValidationReport: createOuterLineCenterReport =
    createOuterLineCenterValidationReport,
  downloadOuterLineCenterValidationReport = report => {
    const artifact = createOuterLineCenterValidationReportExport(report);
    const blob = new Blob([artifact.contents], { type: artifact.mimeType });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    try {
      anchor.href = objectUrl;
      anchor.download = artifact.fileName;
      anchor.click();
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  },
  createOuterLineCenterGeometryValidationReport:
    createOuterLineCenterGeometryReport =
      createOuterLineCenterGeometryValidationReport,
  downloadOuterLineCenterGeometryValidationReport = report => {
    const artifact = createOuterLineCenterGeometryValidationReportExport(report);
    const blob = new Blob([artifact.contents], { type: artifact.mimeType });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    try {
      anchor.href = objectUrl;
      anchor.download = artifact.fileName;
      anchor.click();
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  },
  createHumanAnnotationBiasDiagnostics:
    createHumanAnnotationBiasReport = createHumanAnnotationBiasDiagnostics,
  downloadHumanAnnotationBiasDiagnostics = report => {
    const artifact = createHumanAnnotationBiasDiagnosticsExport(report);
    const blob = new Blob([artifact.contents], { type: artifact.mimeType });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    try {
      anchor.href = objectUrl;
      anchor.download = artifact.fileName;
      anchor.click();
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  },
  createGridLatticeGeometryDiagnostics:
    createGridLatticeGeometryReport = createGridLatticeGeometryDiagnostics,
  downloadGridLatticeGeometryDiagnostics = report => {
    const artifact = createGridLatticeGeometryDiagnosticsExport(report);
    const blob = new Blob([artifact.contents], { type: artifact.mimeType });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    try {
      anchor.href = objectUrl;
      anchor.download = artifact.fileName;
      anchor.click();
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  },
  createGridLatticePeriodicityDiagnostics:
    createGridLatticePeriodicityReport = createGridLatticePeriodicityDiagnostics,
  downloadGridLatticePeriodicityDiagnostics = report => {
    const artifact = createGridLatticePeriodicityDiagnosticsExport(report);
    const blob = new Blob([artifact.contents], { type: artifact.mimeType });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    try {
      anchor.href = objectUrl;
      anchor.download = artifact.fileName;
      anchor.click();
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  },
  createGridLatticePeriodIdentifiabilityDiagnostics:
    createGridLatticePeriodIdentifiabilityReport =
      createGridLatticePeriodIdentifiabilityDiagnostics,
  downloadGridLatticePeriodIdentifiabilityDiagnostics = report => {
    const artifact = createGridLatticePeriodIdentifiabilityDiagnosticsExport(
      report
    );
    const blob = new Blob([artifact.contents], { type: artifact.mimeType });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    try {
      anchor.href = objectUrl;
      anchor.download = artifact.fileName;
      anchor.click();
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  },
  createGridLatticePeriodRobustnessDiagnostics:
    createGridLatticePeriodRobustnessReport =
      createGridLatticePeriodRobustnessDiagnostics,
  downloadGridLatticePeriodRobustnessDiagnostics = report => {
    const artifact = createGridLatticePeriodRobustnessDiagnosticsExport(report);
    const blob = new Blob([artifact.contents], { type: artifact.mimeType });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    try {
      anchor.href = objectUrl;
      anchor.download = artifact.fileName;
      anchor.click();
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  },
  createGridLatticePeriodToleranceSensitivityDiagnostics:
    createGridLatticePeriodToleranceSensitivityReport =
      createGridLatticePeriodToleranceSensitivityDiagnostics,
  downloadGridLatticePeriodToleranceSensitivityDiagnostics = report => {
    const artifact =
      createGridLatticePeriodToleranceSensitivityDiagnosticsExport(report);
    const blob = new Blob([artifact.contents], { type: artifact.mimeType });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    try {
      anchor.href = objectUrl;
      anchor.download = artifact.fileName;
      anchor.click();
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  },
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
  const [reconstructionValidationReport, setReconstructionValidationReport] =
    useState(null);
  const [reconstructionValidationErrorMessage, setReconstructionValidationErrorMessage] =
    useState("");
  const [boundsLatticeExtensionValidationReport,
    setBoundsLatticeExtensionValidationReport] = useState(null);
  const [boundsLatticeExtensionValidationErrorMessage,
    setBoundsLatticeExtensionValidationErrorMessage] = useState("");
  const [outerLineCenterValidationReport,
    setOuterLineCenterValidationReport] = useState(null);
  const [outerLineCenterValidationErrorMessage,
    setOuterLineCenterValidationErrorMessage] = useState("");
  const [outerLineCenterGeometryValidationReport,
    setOuterLineCenterGeometryValidationReport] = useState(null);
  const [outerLineCenterGeometryValidationErrorMessage,
    setOuterLineCenterGeometryValidationErrorMessage] = useState("");
  const [humanAnnotationBiasDiagnostics,
    setHumanAnnotationBiasDiagnostics] = useState(null);
  const [humanAnnotationBiasDiagnosticsErrorMessage,
    setHumanAnnotationBiasDiagnosticsErrorMessage] = useState("");
  const [gridLatticeGeometryDiagnostics,
    setGridLatticeGeometryDiagnostics] = useState(null);
  const [gridLatticeGeometryDiagnosticsErrorMessage,
    setGridLatticeGeometryDiagnosticsErrorMessage] = useState("");
  const [gridLatticePeriodicityDiagnostics,
    setGridLatticePeriodicityDiagnostics] = useState(null);
  const [gridLatticePeriodicityDiagnosticsErrorMessage,
    setGridLatticePeriodicityDiagnosticsErrorMessage] = useState("");
  const [gridLatticePeriodIdentifiabilityDiagnostics,
    setGridLatticePeriodIdentifiabilityDiagnostics] = useState(null);
  const [gridLatticePeriodIdentifiabilityDiagnosticsErrorMessage,
    setGridLatticePeriodIdentifiabilityDiagnosticsErrorMessage] = useState("");
  const [gridLatticePeriodRobustnessDiagnostics,
    setGridLatticePeriodRobustnessDiagnostics] = useState(null);
  const [gridLatticePeriodRobustnessDiagnosticsErrorMessage,
    setGridLatticePeriodRobustnessDiagnosticsErrorMessage] = useState("");
  const [gridLatticePeriodToleranceSensitivityDiagnostics,
    setGridLatticePeriodToleranceSensitivityDiagnostics] = useState(null);
  const [gridLatticePeriodToleranceSensitivityDiagnosticsErrorMessage,
    setGridLatticePeriodToleranceSensitivityDiagnosticsErrorMessage] =
      useState("");
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
    setReconstructionValidationReport(null);
    setReconstructionValidationErrorMessage("");
    setBoundsLatticeExtensionValidationReport(null);
    setBoundsLatticeExtensionValidationErrorMessage("");
    setOuterLineCenterValidationReport(null);
    setOuterLineCenterValidationErrorMessage("");
    setOuterLineCenterGeometryValidationReport(null);
    setOuterLineCenterGeometryValidationErrorMessage("");
    setHumanAnnotationBiasDiagnostics(null);
    setHumanAnnotationBiasDiagnosticsErrorMessage("");
    setGridLatticeGeometryDiagnostics(null);
    setGridLatticeGeometryDiagnosticsErrorMessage("");
    setGridLatticePeriodicityDiagnostics(null);
    setGridLatticePeriodicityDiagnosticsErrorMessage("");
    setGridLatticePeriodIdentifiabilityDiagnostics(null);
    setGridLatticePeriodIdentifiabilityDiagnosticsErrorMessage("");
    setGridLatticePeriodRobustnessDiagnostics(null);
    setGridLatticePeriodRobustnessDiagnosticsErrorMessage("");
    setGridLatticePeriodToleranceSensitivityDiagnostics(null);
    setGridLatticePeriodToleranceSensitivityDiagnosticsErrorMessage("");
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
    setReconstructionValidationReport(null);
    setReconstructionValidationErrorMessage("");
    setBoundsLatticeExtensionValidationReport(null);
    setBoundsLatticeExtensionValidationErrorMessage("");
    setOuterLineCenterValidationReport(null);
    setOuterLineCenterValidationErrorMessage("");
    setOuterLineCenterGeometryValidationReport(null);
    setOuterLineCenterGeometryValidationErrorMessage("");
    setHumanAnnotationBiasDiagnostics(null);
    setHumanAnnotationBiasDiagnosticsErrorMessage("");
    setGridLatticeGeometryDiagnostics(null);
    setGridLatticeGeometryDiagnosticsErrorMessage("");
    setGridLatticePeriodicityDiagnostics(null);
    setGridLatticePeriodicityDiagnosticsErrorMessage("");
    setGridLatticePeriodIdentifiabilityDiagnostics(null);
    setGridLatticePeriodIdentifiabilityDiagnosticsErrorMessage("");
    setGridLatticePeriodRobustnessDiagnostics(null);
    setGridLatticePeriodRobustnessDiagnosticsErrorMessage("");
    setGridLatticePeriodToleranceSensitivityDiagnostics(null);
    setGridLatticePeriodToleranceSensitivityDiagnosticsErrorMessage("");

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
    setReconstructionValidationReport(null);
    setReconstructionValidationErrorMessage("");
    setBoundsLatticeExtensionValidationReport(null);
    setBoundsLatticeExtensionValidationErrorMessage("");
    setOuterLineCenterValidationReport(null);
    setOuterLineCenterValidationErrorMessage("");
    setOuterLineCenterGeometryValidationReport(null);
    setOuterLineCenterGeometryValidationErrorMessage("");
    setHumanAnnotationBiasDiagnostics(null);
    setHumanAnnotationBiasDiagnosticsErrorMessage("");
    setGridLatticeGeometryDiagnostics(null);
    setGridLatticeGeometryDiagnosticsErrorMessage("");
    setGridLatticePeriodicityDiagnostics(null);
    setGridLatticePeriodicityDiagnosticsErrorMessage("");
    setGridLatticePeriodIdentifiabilityDiagnostics(null);
    setGridLatticePeriodIdentifiabilityDiagnosticsErrorMessage("");
    setGridLatticePeriodRobustnessDiagnostics(null);
    setGridLatticePeriodRobustnessDiagnosticsErrorMessage("");
    setGridLatticePeriodToleranceSensitivityDiagnostics(null);
    setGridLatticePeriodToleranceSensitivityDiagnosticsErrorMessage("");
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

  const handleCreateReconstructionValidationReport = () => {
    if (!groundTruth || !datasetReport) {
      return;
    }

    try {
      setReconstructionValidationReport(createReconstructionValidationReport({
        datasetReport,
        groundTruth
      }));
      setReconstructionValidationErrorMessage("");
    } catch (error) {
      setReconstructionValidationErrorMessage(
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  const handleCreateBoundsLatticeExtensionValidationReport = () => {
    if (!groundTruth || !datasetReport) {
      return;
    }

    try {
      setBoundsLatticeExtensionValidationReport(
        createBoundsLatticeExtensionValidationReport({
          datasetReport,
          groundTruth
        })
      );
      setBoundsLatticeExtensionValidationErrorMessage("");
    } catch (error) {
      setBoundsLatticeExtensionValidationErrorMessage(
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  const handleCreateOuterLineCenterValidationReport = () => {
    if (!groundTruth || !datasetReport) {
      return;
    }

    try {
      setOuterLineCenterValidationReport(createOuterLineCenterReport({
        datasetReport,
        groundTruth
      }));
      setOuterLineCenterValidationErrorMessage("");
    } catch (error) {
      setOuterLineCenterValidationErrorMessage(
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  const handleCreateOuterLineCenterGeometryValidationReport = () => {
    if (!groundTruth || !datasetReport) {
      return;
    }

    try {
      setOuterLineCenterGeometryValidationReport(
        createOuterLineCenterGeometryReport({
          datasetReport,
          groundTruth
        })
      );
      setOuterLineCenterGeometryValidationErrorMessage("");
    } catch (error) {
      setOuterLineCenterGeometryValidationErrorMessage(
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  const handleCreateHumanAnnotationBiasDiagnostics = () => {
    if (!groundTruth || !datasetReport) {
      return;
    }

    try {
      setHumanAnnotationBiasDiagnostics(createHumanAnnotationBiasReport({
        datasetReport,
        groundTruth
      }));
      setHumanAnnotationBiasDiagnosticsErrorMessage("");
    } catch (error) {
      setHumanAnnotationBiasDiagnosticsErrorMessage(
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  const handleCreateGridLatticeGeometryDiagnostics = () => {
    if (!groundTruth || !datasetReport) {
      return;
    }

    try {
      setGridLatticeGeometryDiagnostics(createGridLatticeGeometryReport({
        datasetReport,
        groundTruth
      }));
      setGridLatticeGeometryDiagnosticsErrorMessage("");
    } catch (error) {
      setGridLatticeGeometryDiagnosticsErrorMessage(
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  const handleCreateGridLatticePeriodicityDiagnostics = () => {
    if (!groundTruth || !datasetReport) {
      return;
    }

    try {
      setGridLatticePeriodicityDiagnostics(
        createGridLatticePeriodicityReport({
          datasetReport,
          groundTruth
        })
      );
      setGridLatticePeriodicityDiagnosticsErrorMessage("");
    } catch (error) {
      setGridLatticePeriodicityDiagnosticsErrorMessage(
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  const handleCreateGridLatticePeriodIdentifiabilityDiagnostics = () => {
    if (!groundTruth || !datasetReport) {
      return;
    }

    try {
      setGridLatticePeriodIdentifiabilityDiagnostics(
        createGridLatticePeriodIdentifiabilityReport({
          datasetReport,
          groundTruth
        })
      );
      setGridLatticePeriodIdentifiabilityDiagnosticsErrorMessage("");
    } catch (error) {
      setGridLatticePeriodIdentifiabilityDiagnosticsErrorMessage(
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  const handleCreateGridLatticePeriodRobustnessDiagnostics = () => {
    if (!groundTruth || !datasetReport) {
      return;
    }

    try {
      setGridLatticePeriodRobustnessDiagnostics(
        createGridLatticePeriodRobustnessReport({
          datasetReport,
          groundTruth
        })
      );
      setGridLatticePeriodRobustnessDiagnosticsErrorMessage("");
    } catch (error) {
      setGridLatticePeriodRobustnessDiagnosticsErrorMessage(
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  const handleCreateGridLatticePeriodToleranceSensitivityDiagnostics = () => {
    if (!groundTruth || !datasetReport) {
      return;
    }

    try {
      setGridLatticePeriodToleranceSensitivityDiagnostics(
        createGridLatticePeriodToleranceSensitivityReport({
          datasetReport,
          groundTruth
        })
      );
      setGridLatticePeriodToleranceSensitivityDiagnosticsErrorMessage("");
    } catch (error) {
      setGridLatticePeriodToleranceSensitivityDiagnosticsErrorMessage(
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
  const reconstructionValidationStatus = reconstructionValidationReport
    ? "Completed"
    : reconstructionValidationErrorMessage
      ? "Failed"
      : groundTruth && datasetReport
        ? "Ready to create"
        : "Waiting for confirmed ground truth";
  const reconstructionValidationDownloadStatus = reconstructionValidationReport
    ? "Ready"
    : "Waiting for a completed reconstruction validation report";
  const boundsLatticeExtensionValidationStatus =
    boundsLatticeExtensionValidationReport
      ? "Completed"
      : boundsLatticeExtensionValidationErrorMessage
        ? "Failed"
        : groundTruth && datasetReport
          ? "Ready to create"
          : "Waiting for confirmed ground truth";
  const boundsLatticeExtensionValidationDownloadStatus =
    boundsLatticeExtensionValidationReport
      ? "Ready"
      : "Waiting for a completed grid bounds lattice extension validation report";
  const outerLineCenterValidationStatus = outerLineCenterValidationReport
    ? "Completed"
    : outerLineCenterValidationErrorMessage
      ? "Failed"
      : groundTruth && datasetReport
        ? "Ready to create"
        : "Waiting for confirmed ground truth";
  const outerLineCenterValidationDownloadStatus = outerLineCenterValidationReport
    ? "Ready"
    : "Waiting for a completed outer line center validation report";
  const outerLineCenterGeometryValidationStatus =
    outerLineCenterGeometryValidationReport
      ? "Completed"
      : outerLineCenterGeometryValidationErrorMessage
        ? "Failed"
        : groundTruth && datasetReport
          ? "Ready to create"
          : "Waiting for confirmed ground truth";
  const outerLineCenterGeometryValidationDownloadStatus =
    outerLineCenterGeometryValidationReport
      ? "Ready"
      : "Waiting for a completed outer line center geometry validation report";
  const humanAnnotationBiasDiagnosticsStatus = humanAnnotationBiasDiagnostics
    ? "Completed"
    : humanAnnotationBiasDiagnosticsErrorMessage
      ? "Failed"
      : groundTruth && datasetReport
        ? "Ready to create"
        : "Waiting for confirmed ground truth";
  const humanAnnotationBiasDiagnosticsDownloadStatus =
    humanAnnotationBiasDiagnostics
      ? "Ready"
      : "Waiting for completed human annotation bias diagnostics";
  const gridLatticeGeometryDiagnosticsStatus = gridLatticeGeometryDiagnostics
    ? "Completed"
    : gridLatticeGeometryDiagnosticsErrorMessage
      ? "Failed"
      : groundTruth && datasetReport
        ? "Ready to create"
        : "Waiting for confirmed ground truth";
  const gridLatticeGeometryDiagnosticsDownloadStatus =
    gridLatticeGeometryDiagnostics
      ? "Ready"
      : "Waiting for completed grid lattice geometry diagnostics";
  const gridLatticePeriodicityDiagnosticsStatus =
    gridLatticePeriodicityDiagnostics
      ? "Completed"
      : gridLatticePeriodicityDiagnosticsErrorMessage
        ? "Failed"
        : groundTruth && datasetReport
          ? "Ready to create"
          : "Waiting for confirmed ground truth";
  const gridLatticePeriodicityDiagnosticsDownloadStatus =
    gridLatticePeriodicityDiagnostics
      ? "Ready"
      : "Waiting for completed grid lattice periodicity diagnostics";
  const gridLatticePeriodIdentifiabilityDiagnosticsStatus =
    gridLatticePeriodIdentifiabilityDiagnostics
      ? "Completed"
      : gridLatticePeriodIdentifiabilityDiagnosticsErrorMessage
        ? "Failed"
        : groundTruth && datasetReport
          ? "Ready to create"
          : "Waiting for confirmed ground truth";
  const gridLatticePeriodIdentifiabilityDiagnosticsDownloadStatus =
    gridLatticePeriodIdentifiabilityDiagnostics
      ? "Ready"
      : "Waiting for completed grid lattice period identifiability diagnostics";
  const gridLatticePeriodRobustnessDiagnosticsStatus =
    gridLatticePeriodRobustnessDiagnostics
      ? "Completed"
      : gridLatticePeriodRobustnessDiagnosticsErrorMessage
        ? "Failed"
        : groundTruth && datasetReport
          ? "Ready to create"
          : "Waiting for confirmed ground truth";
  const gridLatticePeriodRobustnessDiagnosticsDownloadStatus =
    gridLatticePeriodRobustnessDiagnostics
      ? "Ready"
      : "Waiting for completed grid lattice period robustness diagnostics";
  const gridLatticePeriodToleranceSensitivityDiagnosticsStatus =
    gridLatticePeriodToleranceSensitivityDiagnostics
      ? "Completed"
      : gridLatticePeriodToleranceSensitivityDiagnosticsErrorMessage
        ? "Failed"
        : groundTruth && datasetReport
          ? "Ready to create"
          : "Waiting for confirmed ground truth";
  const gridLatticePeriodToleranceSensitivityDiagnosticsDownloadStatus =
    gridLatticePeriodToleranceSensitivityDiagnostics
      ? "Ready"
      : "Waiting for completed grid lattice period tolerance sensitivity diagnostics";

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
        <WorkflowStep
          title="Create grid reconstruction validation report"
          status={reconstructionValidationStatus}
        />
        <WorkflowStep
          title="Download grid reconstruction validation report"
          status={reconstructionValidationDownloadStatus}
        />
        <WorkflowStep
          title="Create Grid Bounds Lattice Extension Validation Report"
          status={boundsLatticeExtensionValidationStatus}
        />
        <WorkflowStep
          title="Download Grid Bounds Lattice Extension Validation Report JSON"
          status={boundsLatticeExtensionValidationDownloadStatus}
        />
        <WorkflowStep
          title="Create Outer Line Center Validation Report"
          status={outerLineCenterValidationStatus}
        />
        <WorkflowStep
          title="Download Outer Line Center Validation Report JSON"
          status={outerLineCenterValidationDownloadStatus}
        />
        <WorkflowStep
          title="Create Outer Line Center Geometry Validation Report"
          status={outerLineCenterGeometryValidationStatus}
        />
        <WorkflowStep
          title="Download Outer Line Center Geometry Validation Report JSON"
          status={outerLineCenterGeometryValidationDownloadStatus}
        />
        <WorkflowStep
          title="Create Human Annotation Bias Diagnostics"
          status={humanAnnotationBiasDiagnosticsStatus}
        />
        <WorkflowStep
          title="Download Human Annotation Bias Diagnostics JSON"
          status={humanAnnotationBiasDiagnosticsDownloadStatus}
        />
        <WorkflowStep
          title="Create Grid Lattice Geometry Diagnostics"
          status={gridLatticeGeometryDiagnosticsStatus}
        />
        <WorkflowStep
          title="Download Grid Lattice Geometry Diagnostics JSON"
          status={gridLatticeGeometryDiagnosticsDownloadStatus}
        />
        <WorkflowStep
          title="Create Grid Lattice Periodicity Diagnostics"
          status={gridLatticePeriodicityDiagnosticsStatus}
        />
        <WorkflowStep
          title="Download Grid Lattice Periodicity Diagnostics JSON"
          status={gridLatticePeriodicityDiagnosticsDownloadStatus}
        />
        <WorkflowStep
          title="Create Grid Lattice Period Identifiability Diagnostics"
          status={gridLatticePeriodIdentifiabilityDiagnosticsStatus}
        />
        <WorkflowStep
          title="Download Grid Lattice Period Identifiability Diagnostics JSON"
          status={gridLatticePeriodIdentifiabilityDiagnosticsDownloadStatus}
        />
        <WorkflowStep
          title="Create Grid Lattice Period Robustness Diagnostics"
          status={gridLatticePeriodRobustnessDiagnosticsStatus}
        />
        <WorkflowStep
          title="Download Grid Lattice Period Robustness Diagnostics JSON"
          status={gridLatticePeriodRobustnessDiagnosticsDownloadStatus}
        />
        <WorkflowStep
          title="Create Grid Lattice Period Tolerance Sensitivity Diagnostics"
          status={gridLatticePeriodToleranceSensitivityDiagnosticsStatus}
        />
        <WorkflowStep
          title="Download Grid Lattice Period Tolerance Sensitivity Diagnostics JSON"
          status={gridLatticePeriodToleranceSensitivityDiagnosticsDownloadStatus}
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
      {reconstructionValidationErrorMessage && (
        <span role="alert">
          Grid reconstruction validation unavailable:{" "}
          {reconstructionValidationErrorMessage}
        </span>
      )}
      {boundsLatticeExtensionValidationErrorMessage && (
        <span role="alert">
          Grid bounds lattice extension validation unavailable:{" "}
          {boundsLatticeExtensionValidationErrorMessage}
        </span>
      )}
      {outerLineCenterValidationErrorMessage && (
        <span role="alert">
          Outer line center validation unavailable:{" "}
          {outerLineCenterValidationErrorMessage}
        </span>
      )}
      {outerLineCenterGeometryValidationErrorMessage && (
        <span role="alert">
          Outer line center geometry validation unavailable:{" "}
          {outerLineCenterGeometryValidationErrorMessage}
        </span>
      )}
      {humanAnnotationBiasDiagnosticsErrorMessage && (
        <span role="alert">
          Human annotation bias diagnostics unavailable:{" "}
          {humanAnnotationBiasDiagnosticsErrorMessage}
        </span>
      )}
      {gridLatticeGeometryDiagnosticsErrorMessage && (
        <span role="alert">
          Grid lattice geometry diagnostics unavailable:{" "}
          {gridLatticeGeometryDiagnosticsErrorMessage}
        </span>
      )}
      {gridLatticePeriodicityDiagnosticsErrorMessage && (
        <span role="alert">
          Grid lattice periodicity diagnostics unavailable:{" "}
          {gridLatticePeriodicityDiagnosticsErrorMessage}
        </span>
      )}
      {gridLatticePeriodIdentifiabilityDiagnosticsErrorMessage && (
        <span role="alert">
          Grid lattice period identifiability diagnostics unavailable:{" "}
          {gridLatticePeriodIdentifiabilityDiagnosticsErrorMessage}
        </span>
      )}
      {gridLatticePeriodRobustnessDiagnosticsErrorMessage && (
        <span role="alert">
          Grid lattice period robustness diagnostics unavailable:{" "}
          {gridLatticePeriodRobustnessDiagnosticsErrorMessage}
        </span>
      )}
      {gridLatticePeriodToleranceSensitivityDiagnosticsErrorMessage && (
        <span role="alert">
          Grid lattice period tolerance sensitivity diagnostics unavailable:{" "}
          {gridLatticePeriodToleranceSensitivityDiagnosticsErrorMessage}
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
      {status === "completed" && datasetReport && (
        <button
          type="button"
          disabled={!groundTruth || confirmedItemCount === 0}
          onClick={handleCreateReconstructionValidationReport}
        >
          Create grid reconstruction validation report
        </button>
      )}
      {reconstructionValidationReport && (
        <>
          <span role="status" aria-label="Reconstruction validation status">
            Grid reconstruction validation report completed
          </span>
          <button
            type="button"
            onClick={() => downloadReconstructionValidationReport(
              reconstructionValidationReport
            )}
          >
            Download grid reconstruction validation report JSON
          </button>
        </>
      )}
      {status === "completed" && datasetReport && (
        <button
          type="button"
          disabled={!groundTruth || confirmedItemCount === 0}
          onClick={handleCreateBoundsLatticeExtensionValidationReport}
        >
          Create Grid Bounds Lattice Extension Validation Report
        </button>
      )}
      {boundsLatticeExtensionValidationReport && (
        <>
          <span
            role="status"
            aria-label="Grid bounds lattice extension validation status"
          >
            Grid Bounds Lattice Extension Validation Report completed
          </span>
          <button
            type="button"
            onClick={() => downloadBoundsLatticeExtensionValidationReport(
              boundsLatticeExtensionValidationReport
            )}
          >
            Download Grid Bounds Lattice Extension Validation Report JSON
          </button>
        </>
      )}
      {status === "completed" && datasetReport && (
        <button
          type="button"
          disabled={!groundTruth || confirmedItemCount === 0}
          onClick={handleCreateOuterLineCenterValidationReport}
        >
          Create Outer Line Center Validation Report
        </button>
      )}
      {outerLineCenterValidationReport && (
        <>
          <span
            role="status"
            aria-label="Outer line center validation status"
          >
            Outer Line Center Validation Report completed
          </span>
          <button
            type="button"
            onClick={() => downloadOuterLineCenterValidationReport(
              outerLineCenterValidationReport
            )}
          >
            Download Outer Line Center Validation Report JSON
          </button>
        </>
      )}
      {status === "completed" && datasetReport && (
        <button
          type="button"
          disabled={!groundTruth || confirmedItemCount === 0}
          onClick={handleCreateOuterLineCenterGeometryValidationReport}
        >
          Create Outer Line Center Geometry Validation Report
        </button>
      )}
      {outerLineCenterGeometryValidationReport && (
        <>
          <span
            role="status"
            aria-label="Outer line center geometry validation status"
          >
            Outer Line Center Geometry Validation Report completed
          </span>
          <button
            type="button"
            onClick={() => downloadOuterLineCenterGeometryValidationReport(
              outerLineCenterGeometryValidationReport
            )}
          >
            Download Outer Line Center Geometry Validation Report JSON
          </button>
        </>
      )}
      {status === "completed" && datasetReport && (
        <button
          type="button"
          disabled={!groundTruth || confirmedItemCount === 0}
          onClick={handleCreateHumanAnnotationBiasDiagnostics}
        >
          Create Human Annotation Bias Diagnostics
        </button>
      )}
      {humanAnnotationBiasDiagnostics && (
        <>
          <span
            role="status"
            aria-label="Human annotation bias diagnostics status"
          >
            Human Annotation Bias Diagnostics completed
          </span>
          <button
            type="button"
            onClick={() => downloadHumanAnnotationBiasDiagnostics(
              humanAnnotationBiasDiagnostics
            )}
          >
            Download Human Annotation Bias Diagnostics JSON
          </button>
        </>
      )}
      {status === "completed" && datasetReport && (
        <button
          type="button"
          disabled={!groundTruth || confirmedItemCount === 0}
          onClick={handleCreateGridLatticeGeometryDiagnostics}
        >
          Create Grid Lattice Geometry Diagnostics
        </button>
      )}
      {gridLatticeGeometryDiagnostics && (
        <>
          <span
            role="status"
            aria-label="Grid lattice geometry diagnostics status"
          >
            Grid Lattice Geometry Diagnostics completed
          </span>
          <button
            type="button"
            onClick={() => downloadGridLatticeGeometryDiagnostics(
              gridLatticeGeometryDiagnostics
            )}
          >
            Download Grid Lattice Geometry Diagnostics JSON
          </button>
        </>
      )}
      {status === "completed" && datasetReport && (
        <button
          type="button"
          disabled={!groundTruth || confirmedItemCount === 0}
          onClick={handleCreateGridLatticePeriodicityDiagnostics}
        >
          Create Grid Lattice Periodicity Diagnostics
        </button>
      )}
      {gridLatticePeriodicityDiagnostics && (
        <>
          <span
            role="status"
            aria-label="Grid lattice periodicity diagnostics status"
          >
            Grid Lattice Periodicity Diagnostics completed
          </span>
          <button
            type="button"
            onClick={() => downloadGridLatticePeriodicityDiagnostics(
              gridLatticePeriodicityDiagnostics
            )}
          >
            Download Grid Lattice Periodicity Diagnostics JSON
          </button>
        </>
      )}
      {status === "completed" && datasetReport && (
        <button
          type="button"
          disabled={!groundTruth || confirmedItemCount === 0}
          onClick={handleCreateGridLatticePeriodIdentifiabilityDiagnostics}
        >
          Create Grid Lattice Period Identifiability Diagnostics
        </button>
      )}
      {gridLatticePeriodIdentifiabilityDiagnostics && (
        <>
          <span
            role="status"
            aria-label="Grid lattice period identifiability diagnostics status"
          >
            Grid Lattice Period Identifiability Diagnostics completed
          </span>
          <button
            type="button"
            onClick={() => downloadGridLatticePeriodIdentifiabilityDiagnostics(
              gridLatticePeriodIdentifiabilityDiagnostics
            )}
          >
            Download Grid Lattice Period Identifiability Diagnostics JSON
          </button>
        </>
      )}
      {status === "completed" && datasetReport && (
        <button
          type="button"
          disabled={!groundTruth || confirmedItemCount === 0}
          onClick={handleCreateGridLatticePeriodRobustnessDiagnostics}
        >
          Create Grid Lattice Period Robustness Diagnostics
        </button>
      )}
      {gridLatticePeriodRobustnessDiagnostics && (
        <>
          <span
            role="status"
            aria-label="Grid lattice period robustness diagnostics status"
          >
            Grid Lattice Period Robustness Diagnostics completed
          </span>
          <button
            type="button"
            onClick={() => downloadGridLatticePeriodRobustnessDiagnostics(
              gridLatticePeriodRobustnessDiagnostics
            )}
          >
            Download Grid Lattice Period Robustness Diagnostics JSON
          </button>
        </>
      )}
      {status === "completed" && datasetReport && (
        <button
          type="button"
          disabled={!groundTruth || confirmedItemCount === 0}
          onClick={handleCreateGridLatticePeriodToleranceSensitivityDiagnostics}
        >
          Create Grid Lattice Period Tolerance Sensitivity Diagnostics
        </button>
      )}
      {gridLatticePeriodToleranceSensitivityDiagnostics && (
        <>
          <span
            role="status"
            aria-label="Grid lattice period tolerance sensitivity diagnostics status"
          >
            Grid Lattice Period Tolerance Sensitivity Diagnostics completed
          </span>
          <button
            type="button"
            onClick={() => (
              downloadGridLatticePeriodToleranceSensitivityDiagnostics(
                gridLatticePeriodToleranceSensitivityDiagnostics
              )
            )}
          >
            Download Grid Lattice Period Tolerance Sensitivity Diagnostics JSON
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
