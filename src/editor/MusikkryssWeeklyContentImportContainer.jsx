import React, { useMemo, useState } from "react";
import {
  importMusikkryssWeeklyContent
} from "../musikkryss/MusikkryssWeeklyContentImport";
import {
  parseMusikkryssWeeklyContentExcelFile
} from "../musikkryss/adapters/MusikkryssWeeklyContentExcelAdapter";

export default function MusikkryssWeeklyContentImportContainer({
  candidate,
  formatId,
  formatCatalog,
  onApprove
}) {
  const [excelResult, setExcelResult] = useState(null);
  const effectiveCandidate = candidate
    ?? (excelResult?.status === "parsed" ? excelResult.weeklyContent : null);
  const result = useMemo(() => (
    effectiveCandidate
      ? importMusikkryssWeeklyContent(effectiveCandidate, { formatCatalog })
      : null
  ), [effectiveCandidate, formatCatalog]);

  const handleExcelFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setExcelResult(await parseMusikkryssWeeklyContentExcelFile({
      file,
      formatId
    }));
    event.target.value = "";
  };

  if (!result) {
    return (
      <section
        data-testid="musikkryss-weekly-content-import"
        style={{ display: "grid", gap: "10px" }}
      >
        <h5>Veckoinnehåll</h5>
        <ExcelFileInput onChange={handleExcelFile} />
        {excelResult?.status === "invalid" ? (
          <AdapterDiagnostics entries={excelResult.diagnostics.entries} />
        ) : (
          <div>Inget veckoinnehåll har lästs in.</div>
        )}
      </section>
    );
  }

  const issue = effectiveCandidate?.issue || {};
  const answers = Array.isArray(effectiveCandidate?.answers)
    ? effectiveCandidate.answers
    : [];

  return (
    <section
      data-testid="musikkryss-weekly-content-import"
      style={{ display: "grid", gap: "10px" }}
    >
      <h5 style={{ margin: 0 }}>Importförhandsvisning</h5>
      <ExcelFileInput onChange={handleExcelFile} />
      <dl>
        {ISSUE_FIELDS.map(({ field, label }) => (
          <React.Fragment key={field}>
            <dt>{label}</dt>
            <dd data-testid={`weekly-issue-${field}`}>
              {typeof issue[field] === "string" ? issue[field] : ""}
            </dd>
          </React.Fragment>
        ))}
      </dl>

      <div>
        <strong>Intro</strong>
        <p>{typeof effectiveCandidate?.introScript === "string"
          ? effectiveCandidate.introScript
          : ""}</p>
      </div>

      <div data-testid="weekly-answer-counts">
        Förväntade svar: {result.diagnostics.expectedAnswerCount}. Importerade
        svar: {result.diagnostics.receivedAnswerCount}.
      </div>

      <ol aria-label="Importerade riktningssvar">
        {answers.map((answer, index) => (
          <li key={`${answer?.number}:${answer?.direction}:${index}`}>
            <strong>
              {answer?.number ?? "?"} {directionLabel(answer?.direction)}
            </strong>
            <div>{getScript(answer?.contentSequence)}</div>
            <div>Lösning: {typeof answer?.solution === "string"
              ? answer.solution
              : ""}</div>
          </li>
        ))}
      </ol>

      <div aria-label="Importdiagnostik">
        {result.diagnostics.entries.length === 0 ? (
          <div>Innehållet är giltigt.</div>
        ) : (
          <ul>
            {result.diagnostics.entries.map((entry, index) => (
              <li key={`${entry.code}:${entry.path}:${index}`}>
                {diagnosticLabel(entry)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        disabled={result.status !== "valid"}
        onClick={() => onApprove(result)}
      >
        Använd veckans innehåll
      </button>
    </section>
  );
}

function ExcelFileInput({ onChange }) {
  return (
    <label>
      Importera veckans innehåll
      <input
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={onChange}
      />
    </label>
  );
}

function AdapterDiagnostics({ entries }) {
  return (
    <div aria-label="Excel-importdiagnostik">
      <ul>
        {entries.map((entry, index) => (
          <li key={`${entry.code}:${entry.sheet}:${entry.row}:${index}`}>
            {entry.code}
            {entry.sheet ? ` · ${entry.sheet}` : ""}
            {entry.row ? ` · rad ${entry.row}` : ""}
            {entry.column ? ` · ${entry.column}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

const ISSUE_FIELDS = Object.freeze([
  { field: "crosswordId", label: "Korsords-ID" },
  { field: "title", label: "Titel" },
  { field: "issueNumber", label: "Utgåva" },
  { field: "publishWeek", label: "Publiceringsvecka" },
  { field: "publishDate", label: "Publiceringsdatum" },
  { field: "producerReference", label: "Producentreferens" }
]);

function directionLabel(direction) {
  if (direction === "across") return "vågrätt";
  if (direction === "down") return "lodrätt";
  return "okänd riktning";
}

function getScript(contentSequence) {
  if (!Array.isArray(contentSequence)) return "";
  const entry = contentSequence.find(candidate => candidate?.type === "text");
  return typeof entry?.text === "string" ? entry.text : "";
}

function diagnosticLabel(entry) {
  const answer = entry.answerRef?.number == null
    ? ""
    : ` (${entry.answerRef.number} ${directionLabel(entry.answerRef.direction)})`;
  return `${entry.code}${answer}: ${entry.path}`;
}
