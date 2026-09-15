import React, { useState } from "react";
import {
  normalizeMusikkryssContent
} from "../musikkryss/MusikkryssFormat";

export default function MusikkryssEditorPanel({ value, onChange }) {
  const [selectedClueNumber, setSelectedClueNumber] = useState(1);
  const content = normalizeMusikkryssContent(value);
  const selectedClue = content.clues.find(
    clue => clue.number === selectedClueNumber
  );
  const selectedText = selectedClue.contentSequence[0].text;

  const updateIntroScript = (introScript) => {
    onChange({ ...content, introScript });
  };

  const updateSelectedClueText = (text) => {
    onChange({
      ...content,
      clues: content.clues.map(clue => (
        clue.number === selectedClueNumber
          ? {
            ...clue,
            contentSequence: [{ type: "text", text }]
          }
          : clue
      ))
    });
  };

  return (
    <section
      data-testid="musikkryss-editor-panel"
      style={{ display: "grid", gap: "10px" }}
    >
      <h5 style={{ margin: 0 }}>Musikkryss</h5>
      <label style={{ display: "grid", gap: "4px" }}>
        Intro
        <textarea
          aria-label="Intro"
          value={content.introScript}
          onChange={event => updateIntroScript(event.target.value)}
          rows={4}
        />
      </label>

      <div aria-label="Ledtrådslista" style={clueListStyle}>
        {content.clues.map(clue => (
          <button
            key={clue.number}
            type="button"
            aria-pressed={selectedClueNumber === clue.number}
            onClick={() => setSelectedClueNumber(clue.number)}
          >
            Ledtråd {clue.number}
          </button>
        ))}
      </div>

      <label style={{ display: "grid", gap: "4px" }}>
        Innehåll för ledtråd {selectedClueNumber}
        <textarea
          aria-label={`Innehåll för ledtråd ${selectedClueNumber}`}
          value={selectedText}
          onChange={event => updateSelectedClueText(event.target.value)}
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
