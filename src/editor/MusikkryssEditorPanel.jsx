import React, { useState } from "react";
import {
  normalizeCatalogMusikkryssContent
} from "../musikkryss/MusikkryssFormatCatalog";
import {
  createTemplateSolutionIndex,
  validateAnswerPathSolution
} from "../template/templateSolutions";

export default function MusikkryssEditorPanel({
  value,
  onChange,
  onLoadReference,
  formatCatalog,
  selectedAnswerId: controlledSelectedAnswerId,
  onSelectedAnswerIdChange,
  onCrosswordIdChange
}) {
  const content = normalizeCatalogMusikkryssContent(value, formatCatalog);
  const defaultAnswerId = answerId(content.answers[0]);
  const [localSelectedAnswerId, setLocalSelectedAnswerId] = useState(
    defaultAnswerId
  );
  const selectedAnswerId = controlledSelectedAnswerId
    ?? localSelectedAnswerId;
  const selectedAnswer = content.answers.find(
    answer => answerId(answer) === selectedAnswerId
  ) || content.answers[0];
  const selectedText = getTextContent(selectedAnswer.contentSequence);
  const selectedSolution = selectedAnswer.solution ?? "";
  const selectedSolutionValidation = validateAnswerPathSolution(
    selectedSolution,
    selectedAnswer.answerPath
  );
  const solutionIndex = createTemplateSolutionIndex({
    crosswordType: "musikkryss",
    musikkryss: content
  });
  const issue = content.issue || createEmptyIssue();

  const selectAnswer = (id) => {
    setLocalSelectedAnswerId(id);
    onSelectedAnswerIdChange?.(id);
  };

  const updateIntroScript = (introScript) => {
    onChange({ ...content, introScript });
  };

  const updateIssueField = (field, nextValue) => {
    onChange({
      ...content,
      issue: { ...issue, [field]: nextValue }
    });
    if (field === "crosswordId") onCrosswordIdChange?.(nextValue);
  };

  const updateSelectedAnswerText = (text) => {
    onChange({
      ...content,
      answers: content.answers.map(answer => (
        answerId(answer) === answerId(selectedAnswer)
          ? {
            ...answer,
            contentSequence: updateTextContent(answer.contentSequence, text)
          }
          : answer
      ))
    });
  };

  const updateSelectedAnswerSolution = (solution) => {
    onChange({
      ...content,
      answers: content.answers.map(answer => (
        answerId(answer) === answerId(selectedAnswer)
          ? { ...answer, solution }
          : answer
      ))
    });
  };

  return (
    <section
      data-testid="musikkryss-editor-panel"
      style={{ display: "grid", gap: "10px" }}
    >
      <h5 style={{ margin: 0 }}>Musikkryss</h5>
      <button
        type="button"
        onClick={onLoadReference}
      >
        Ladda referenskryss
      </button>

      <fieldset style={fieldsetStyle}>
        <legend>Utgåva</legend>
        {ISSUE_FIELDS.map(({ field, label, type }) => (
          <label key={field} style={{ display: "grid", gap: "4px" }}>
            {label}
            <input
              aria-label={label}
              type={type || "text"}
              value={issue[field]}
              onChange={event => updateIssueField(field, event.target.value)}
            />
          </label>
        ))}
      </fieldset>

      <label style={{ display: "grid", gap: "4px" }}>
        Intro
        <textarea
          aria-label="Intro"
          value={content.introScript}
          onChange={event => updateIntroScript(event.target.value)}
          rows={4}
        />
      </label>

      <div aria-label="Svarslista" style={clueListStyle}>
        {content.answers.map(answer => {
          const id = answerId(answer);
          return (
            <button
              key={id}
              type="button"
              aria-pressed={selectedAnswerId === id}
              onClick={() => selectAnswer(id)}
            >
              {answer.number} {directionLabel(answer.direction)}
            </button>
          );
        })}
      </div>

      <label style={{ display: "grid", gap: "4px" }}>
        Innehåll för {selectedAnswer.number}{" "}
        {directionLabel(selectedAnswer.direction)}
        <textarea
          aria-label={
            `Innehåll för ${selectedAnswer.number} ${directionLabel(selectedAnswer.direction)}`
          }
          value={selectedText}
          onChange={event => updateSelectedAnswerText(event.target.value)}
          rows={5}
        />
      </label>

      <label style={{ display: "grid", gap: "4px" }}>
        Facit för {selectedAnswer.number}{" "}
        {directionLabel(selectedAnswer.direction)}
        <input
          aria-label={
            `Facit för ${selectedAnswer.number} ${directionLabel(selectedAnswer.direction)}`
          }
          value={selectedSolution}
          onChange={event => updateSelectedAnswerSolution(event.target.value)}
        />
      </label>

      <SolutionValidation
        selectedValidation={selectedSolutionValidation}
        solutionIndex={solutionIndex}
      />
    </section>
  );
}

const clueListStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "4px"
};

const fieldsetStyle = {
  display: "grid",
  gap: "8px",
  margin: 0,
  padding: "8px",
  border: "1px solid #d8dde6"
};

const ISSUE_FIELDS = Object.freeze([
  { field: "crosswordId", label: "Korsords-ID" },
  { field: "title", label: "Titel" },
  { field: "issueNumber", label: "Utgåva" },
  { field: "publishWeek", label: "Publiceringsvecka" },
  { field: "publishDate", label: "Publiceringsdatum", type: "date" },
  { field: "producerReference", label: "Producentreferens" }
]);

function SolutionValidation({ selectedValidation, solutionIndex }) {
  const selectedDiagnostics = selectedValidation.diagnostics;

  return (
    <div aria-label="Facitvalidering" role="status">
      <strong>{solutionStatusLabel(solutionIndex.completenessStatus)}</strong>
      {selectedDiagnostics.length > 0 ? (
        <ul>
          {selectedDiagnostics.map(entry => (
            <li key={entry.code}>{solutionDiagnosticLabel(entry)}</li>
          ))}
        </ul>
      ) : null}
      {solutionIndex.conflicts.length > 0 ? (
        <ul>
          {solutionIndex.conflicts.map(conflict => (
            <li key={`${conflict.answerId}:${conflict.cellIndex}`}>
              Korsningskonflikt i cell {conflict.cellIndex + 1}:{" "}
              {conflict.existingLetter}/{conflict.conflictingLetter}.
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function solutionStatusLabel(status) {
  if (status === "complete") return "Facit är komplett och giltigt.";
  if (status === "inconsistent") return "Facit har korsningskonflikter.";
  if (status === "partial") return "Facit är ofullständigt eller innehåller ogiltiga svar.";
  return "Facit saknas.";
}

function solutionDiagnosticLabel(diagnostic) {
  if (diagnostic.code === "solution-length-mismatch") {
    return `Lösningen har ${diagnostic.actualLength} tecken; svarsvägen kräver ${diagnostic.expectedLength}.`;
  }
  if (diagnostic.code === "solution-contains-whitespace") {
    return "Lösningen får inte innehålla blanksteg.";
  }
  return diagnostic.code;
}

function createEmptyIssue() {
  return Object.fromEntries(ISSUE_FIELDS.map(({ field }) => [field, ""]));
}

function getTextContent(contentSequence) {
  if (!Array.isArray(contentSequence)) return "";
  const entry = contentSequence.find(candidate => candidate?.type === "text");
  return typeof entry?.text === "string" ? entry.text : "";
}

function updateTextContent(contentSequence, text) {
  const entries = Array.isArray(contentSequence)
    ? contentSequence.map(entry => ({ ...entry }))
    : [];
  const textIndex = entries.findIndex(entry => entry?.type === "text");
  if (textIndex < 0) return [{ type: "text", text }, ...entries];

  entries[textIndex] = { ...entries[textIndex], text };
  return entries;
}

function answerId(answer) {
  return `${answer.number}:${answer.direction}`;
}

function directionLabel(direction) {
  return direction === "down" ? "lodrätt" : "vågrätt";
}
