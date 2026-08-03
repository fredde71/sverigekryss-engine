import React from "react";

const DIAGNOSTIC_PREVIEW_LIMIT = 5;

export default function DigitizationDiagnosticPanel({
  digitizationResult,
  experimentComparison = null
}) {
  const summary = getDigitizationSummary(digitizationResult);

  return (
    <section aria-label="Digitiseringsdiagnostik">
      <div>Status: {summary.userStatus}</div>
      <div>Nästa steg: {summary.nextStep}</div>

      <details>
        <summary>Utvecklardetaljer</summary>
        <div>Status: {summary.status}</div>
        <div>Förslag: {summary.suggestionStatus}</div>
        <div>Konfidens: {summary.confidence}</div>
        <div>Orsaker: {summary.reasons}</div>
        <div>Mått: {summary.metrics}</div>
        <div>Rader/kolumner: {summary.rowsCols}</div>
        <div>Geometri: {summary.geometry}</div>
        {process.env.NODE_ENV !== "production" && (
          <ExperimentComparisonDetails comparisonState={experimentComparison} />
        )}
      </details>
    </section>
  );
}

function ExperimentComparisonDetails({ comparisonState }) {
  if (!comparisonState) {
    return null;
  }

  if (comparisonState.status === "failed") {
    return (
      <section aria-label="Experimentell digitiseringsjämförelse">
        <strong>Experimentella resultat – endast utvecklardiagnostik</strong>
        <div>Experimentell jämförelse misslyckades: {getErrorMessage(comparisonState.error)}</div>
      </section>
    );
  }

  const experiments = comparisonState.result?.benchmark?.experiments;

  if (!Array.isArray(experiments)) {
    return null;
  }

  return (
    <section aria-label="Experimentell digitiseringsjämförelse">
      <strong>Experimentella resultat – endast utvecklardiagnostik</strong>
      {experiments.length === 0 ? (
        <div>Inga experiment registrerade.</div>
      ) : (
        <ul>
          {experiments.map((experiment) => (
            <li key={experiment.id}>
              <div>Experimentellt resultat</div>
              <div>ID: {experiment.id}</div>
              <div>Beskrivning: {experiment.description}</div>
              <div>Status: {experiment.success ? "Lyckades" : "Misslyckades"}</div>
              <div>Tid: {formatNumber(experiment.durationMs)} ms</div>
              <div>Diagnostik: {formatExperimentDiagnosticSummary(experiment.diagnostics)}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function formatExperimentDiagnosticSummary(diagnostics) {
  if (Array.isArray(diagnostics)) {
    if (diagnostics.length === 0) {
      return "Inga";
    }

    return diagnostics
      .slice(0, DIAGNOSTIC_PREVIEW_LIMIT)
      .map(getDiagnosticType)
      .join(", ");
  }

  if (!diagnostics || typeof diagnostics !== "object") {
    return "Saknas";
  }

  if (diagnostics.type === "digitization-experiment-failure") {
    return `${diagnostics.type}: ${diagnostics.name || "Error"}: ${diagnostics.message || "Okänt fel"}`;
  }

  const parts = [getDiagnosticType(diagnostics)];

  if (Number.isFinite(diagnostics.raw?.maxStrength)) {
    parts.push(`rå max ${formatNumber(diagnostics.raw.maxStrength)}`);
  }

  if (Number.isFinite(diagnostics.scores?.maxStrength)) {
    parts.push(`poäng max ${formatNumber(diagnostics.scores.maxStrength)}`);
  }

  if (Number.isFinite(diagnostics.mask?.maxStrength)) {
    parts.push(`mask max ${formatNumber(diagnostics.mask.maxStrength)}`);
  }

  return parts.join(", ");
}

function getDiagnosticType(diagnostic) {
  return diagnostic && typeof diagnostic === "object" && diagnostic.type
    ? diagnostic.type
    : "Okänd diagnostik";
}

export function getDigitizationSummary(digitizationResult) {
  if (!digitizationResult) {
    return {
      userStatus: "Ingen bildanalys har körts.",
      nextStep: "Ladda upp en bild eller PDF för att se en rutnätsförhandsvisning.",
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
      userStatus: "Bildanalysen misslyckades.",
      nextStep: "Fortsätt redigera manuellt eller prova att ladda upp bilden igen.",
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
      userStatus: "Bildanalys pågår.",
      nextStep: "Vänta tills analysen är klar.",
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
  const hasSuggestion = !!suggestion;

  return {
    userStatus: hasSuggestion ? "Rutnät hittat." : "Inget rutnät hittades.",
    nextStep: hasSuggestion
      ? "Granska förhandsvisningen och justera manuellt vid behov."
      : "Kontrollera bildens kontrast och beskärning, eller placera rutnätet manuellt.",
    status: "Analys klar",
    suggestionStatus: hasSuggestion ? "Förslag finns" : "Inga förslag",
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

  if (diagnostic.type === "vertical-projection-profile") {
    return formatVerticalProjectionProfile(diagnostic);
  }

  if (diagnostic.type === "vertical-line-mask-projection-comparison") {
    return formatVerticalLineMaskProjectionComparison(diagnostic);
  }

  return "Okänd diagnostik";
}

function formatVerticalProjectionProfile(diagnostic) {
  return [
    `Vertikal projektion: längd ${formatNumber(diagnostic.length)}`,
    `max ${formatNumber(diagnostic.maxStrength)}`,
    `medel ${formatNumber(diagnostic.meanStrength)}`,
    `median ${formatNumber(diagnostic.medianStrength)}`,
    `runs ${formatNumber(diagnostic.runCount)}`,
    `toppar ${formatDiagnosticList(diagnostic.topPeaks, formatProjectionPeak)}`,
    `runs med täckning ${formatDiagnosticList(diagnostic.topRuns, formatProjectionRun)}`
  ].join(", ");
}

function formatVerticalLineMaskProjectionComparison(diagnostic) {
  return [
    "Vertikal linjemask jämfört med rå projektion:",
    `rå median ${formatNumber(diagnostic.raw?.medianStrength)}`,
    `mask median ${formatNumber(diagnostic.mask?.medianStrength)}`,
    `rå max ${formatNumber(diagnostic.raw?.maxStrength)}`,
    `mask max ${formatNumber(diagnostic.mask?.maxStrength)}`,
    `rå runs ${formatNumber(diagnostic.raw?.runCount)}`,
    `mask runs ${formatNumber(diagnostic.mask?.runCount)}`,
    `behållna pixlar ${formatPercent(diagnostic.preprocessing?.retainedPixelRatio)}`,
    `behållna komponenter ${formatNumber(diagnostic.preprocessing?.retainedComponentCount)}`,
    `rå toppar ${formatDiagnosticList(diagnostic.raw?.topPeaks, formatProjectionPeak)}`,
    `mask toppar ${formatDiagnosticList(diagnostic.mask?.topPeaks, formatProjectionPeak)}`,
    `rå runs ${formatDiagnosticList(diagnostic.raw?.topRuns, formatProjectionRun)}`,
    `mask runs ${formatDiagnosticList(diagnostic.mask?.topRuns, formatProjectionRun)}`
  ].join(", ");
}

function formatProjectionPeak(peak) {
  if (!peak || typeof peak !== "object") {
    return "okänd";
  }

  return `pos ${formatNumber(peak.position)} styrka ${formatNumber(peak.strength)}`;
}

function formatProjectionRun(run) {
  if (!run || typeof run !== "object") {
    return "okänd";
  }

  return `${formatNumber(run.start)}-${formatNumber(run.end)}: max ${formatNumber(run.maxStrength)}, medel ${formatNumber(run.meanStrength)}, täckning max ${formatPercent(run.maxCoverage)}, medel ${formatPercent(run.meanCoverage)}`;
}

function formatDiagnosticList(items, formatItem) {
  if (!Array.isArray(items) || items.length === 0) {
    return "saknas";
  }

  const visibleItems = items.slice(0, DIAGNOSTIC_PREVIEW_LIMIT);
  const suffix = items.length > DIAGNOSTIC_PREVIEW_LIMIT
    ? ` (visar ${DIAGNOSTIC_PREVIEW_LIMIT} av ${items.length})`
    : "";

  return `${visibleItems.map(formatItem).join("; ")}${suffix}`;
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

function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return "saknas";
  }

  return `${formatNumber(value * 100)}%`;
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
