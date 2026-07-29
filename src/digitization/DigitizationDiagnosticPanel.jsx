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
    reasons: diagnostics.length > 0 ? diagnostics.join(", ") : "Inga",
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
  return Number.isFinite(value) ? value : "saknas";
}
