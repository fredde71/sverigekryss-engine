import React from "react";

export default function DigitizationDiagnosticPanel({
  digitizationResult
}) {
  const summary = getDigitizationSummary(digitizationResult);

  return (
    <section aria-label="Digitiseringsdiagnostik">
      <div>Status: {summary.status}</div>
      <div>Förslag: {summary.suggestionStatus}</div>
      <div>Konfidens: {summary.confidence}</div>
      <div>Orsaker: {summary.reasons}</div>
      <div>Mått: {summary.metrics}</div>
      <div>Rader/kolumner: {summary.rowsCols}</div>
      <div>Geometri: {summary.geometry}</div>
    </section>
  );
}

export function getDigitizationSummary(digitizationResult) {
  if (!digitizationResult) {
    return {
      status: "Ingen analys körd",
      suggestionStatus: "Inga förslag",
      confidence: "Saknas",
      reasons: "Inga",
      metrics: "Saknas",
      rowsCols: "Saknas",
      geometry: "Saknas"
    };
  }

  if (digitizationResult.status === "failed") {
    return {
      status: "Analys misslyckades",
      suggestionStatus: "Inga förslag",
      confidence: "Saknas",
      reasons: getErrorMessage(digitizationResult.error),
      metrics: "Saknas",
      rowsCols: "Saknas",
      geometry: "Saknas"
    };
  }

  if (digitizationResult.status === "pending") {
    return {
      status: "Analys pågår",
      suggestionStatus: "Inga förslag ännu",
      confidence: "Saknas",
      reasons: "Inga",
      metrics: "Saknas",
      rowsCols: "Saknas",
      geometry: "Saknas"
    };
  }

  const result = digitizationResult.result || digitizationResult;
  const suggestion = Array.isArray(result?.suggestions)
    ? result.suggestions[0]
    : null;
  const detection = result?.gridDetection || {};
  const grid = suggestion?.grid || detection.geometry || null;
  const diagnostics = getDiagnostics({
    suggestion,
    detection,
    result
  });
  const confidence = suggestion?.confidence || detection.confidence || "Saknas";

  return {
    status: "Analys klar",
    suggestionStatus: suggestion ? "Förslag finns" : "Inga förslag",
    confidence,
    reasons: formatDiagnostics(diagnostics),
    metrics: getMetricsSummary(grid),
    rowsCols: getRowsColsSummary(grid),
    geometry: getGeometrySummary(grid)
  };
}

function getDiagnostics({
  suggestion,
  detection,
  result
}) {
  if (Array.isArray(suggestion?.diagnostics) && suggestion.diagnostics.length > 0) {
    return suggestion.diagnostics;
  }

  if (Array.isArray(detection?.diagnostics) && detection.diagnostics.length > 0) {
    return detection.diagnostics;
  }

  if (Array.isArray(result?.diagnostics) && result.diagnostics.length > 0) {
    return result.diagnostics;
  }

  return [];
}

function formatDiagnostics(diagnostics) {
  if (!Array.isArray(diagnostics) || diagnostics.length === 0) {
    return "Inga";
  }

  return diagnostics.map(formatDiagnostic).join(", ");
}

function formatDiagnostic(diagnostic) {
  if (typeof diagnostic === "string") {
    return diagnostic;
  }

  if (!diagnostic || typeof diagnostic !== "object") {
    return "Okänd diagnostik";
  }

  if (diagnostic.type === "candidate-counts") {
    return `${formatAxis(diagnostic.axis)} kandidater: accepterade ${formatNumber(diagnostic.acceptedCount)}, avvisade ${formatNumber(diagnostic.rejectedCount)}, totalt ${formatNumber(diagnostic.totalCount)}`;
  }

  if (diagnostic.type === "spacing-consistency") {
    if (diagnostic.status === "insufficient-candidates") {
      return `${formatAxisSingular(diagnostic.axis)} avståndsjämnhet: för få kandidater`;
    }

    return `${formatAxisSingular(diagnostic.axis)} avståndsjämnhet: ${formatNumber(diagnostic.consistency)} (min ${formatNumber(diagnostic.min)}, max ${formatNumber(diagnostic.max)}, medel ${formatNumber(diagnostic.average)})`;
  }

  if (diagnostic.type === "pre-rejection-bounds") {
    const bounds = diagnostic.bounds;

    if (!bounds) {
      return "Detekterade gränser före avvisning: saknas";
    }

    return `Detekterade gränser före avvisning: top ${formatNumber(bounds.top)}, left ${formatNumber(bounds.left)}, width ${formatNumber(bounds.width)}, height ${formatNumber(bounds.height)}`;
  }

  if (diagnostic.type === "rejection-reasons") {
    return Array.isArray(diagnostic.reasons) && diagnostic.reasons.length > 0
      ? `Avvisningsorsaker: ${diagnostic.reasons.map(formatRejectionReason).join("; ")}`
      : "Avvisningsorsaker: inga";
  }

  if (diagnostic.type === "rejection-reason") {
    return `Avvisningsorsak: ${formatRejectionReason(diagnostic)}`;
  }

  if (diagnostic.type === "acceptance-status") {
    return diagnostic.accepted ? "Grid accepterat" : "Grid avvisat";
  }

  return "Okänd diagnostik";
}

function formatRejectionReason(reason) {
  if (!reason || typeof reason !== "object") {
    return "okänd";
  }

  if (reason.code === "insufficient-candidates") {
    return `${formatAxis(reason.axis).toLowerCase()} kandidatantal ${formatNumber(reason.candidateCount)} är under minimum ${formatNumber(reason.minimumCount)}`;
  }

  if (reason.code === "geometry-build-failed") {
    return "gridgeometri kunde inte byggas från accepterade kandidater";
  }

  return reason.code || "okänd";
}

function getMetricsSummary(grid) {
  if (!grid) return "Saknas";

  const horizontalLines = Array.isArray(grid.horizontalLines)
    ? grid.horizontalLines.length
    : null;
  const verticalLines = Array.isArray(grid.verticalLines)
    ? grid.verticalLines.length
    : null;
  const parts = [];

  if (horizontalLines !== null) {
    parts.push(`horisontella linjer ${horizontalLines}`);
  }

  if (verticalLines !== null) {
    parts.push(`vertikala linjer ${verticalLines}`);
  }

  return parts.length > 0 ? parts.join(", ") : "Saknas";
}

function getRowsColsSummary(grid) {
  if (!grid || !Number.isFinite(grid.rows) || !Number.isFinite(grid.cols)) {
    return "Saknas";
  }

  return `${grid.rows} x ${grid.cols}`;
}

function getGeometrySummary(grid) {
  const bounds = grid?.bounds;

  if (!bounds) return "Saknas";

  return `top ${formatNumber(bounds.top)}, left ${formatNumber(bounds.left)}, width ${formatNumber(bounds.width)}, height ${formatNumber(bounds.height)}`;
}

function getErrorMessage(error) {
  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (typeof error?.message === "string" && error.message.trim()) {
    return error.message;
  }

  return "Okänt fel";
}

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return "saknas";
  }

  return Number.isInteger(value) ? `${value}` : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function formatAxis(axis) {
  if (axis === "horizontal") {
    return "Horisontella";
  }

  if (axis === "vertical") {
    return "Vertikala";
  }

  return "Okända";
}

function formatAxisSingular(axis) {
  if (axis === "horizontal") {
    return "Horisontell";
  }

  if (axis === "vertical") {
    return "Vertikal";
  }

  return "Okänd";
}
