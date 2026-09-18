import React, { useState } from "react";
import {
  normalizeCatalogMusikkryssContent
} from "../musikkryss/MusikkryssFormatCatalog";

export default function MusikkryssEditorPanel({
  value,
  onChange,
  onLoadReference,
  formatCatalog,
  selectedAnswerId: controlledSelectedAnswerId,
  onSelectedAnswerIdChange
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
  const selectedText = selectedAnswer.contentSequence[0].text;

  const selectAnswer = (id) => {
    setLocalSelectedAnswerId(id);
    onSelectedAnswerIdChange?.(id);
  };

  const updateIntroScript = (introScript) => {
    onChange({ ...content, introScript });
  };

  const updateSelectedAnswerText = (text) => {
    onChange({
      ...content,
      answers: content.answers.map(answer => (
        answerId(answer) === answerId(selectedAnswer)
          ? {
            ...answer,
            contentSequence: [{ type: "text", text }]
          }
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
    </section>
  );
}

const clueListStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "4px"
};

function answerId(answer) {
  return `${answer.number}:${answer.direction}`;
}

function directionLabel(direction) {
  return direction === "down" ? "lodrätt" : "vågrätt";
}
