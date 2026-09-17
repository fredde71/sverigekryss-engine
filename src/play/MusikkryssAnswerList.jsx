import React from "react";
import { directionLabel } from "./musikkryssRuntimeAdapter";

export default function MusikkryssAnswerList({
  answers,
  selectedAnswerId,
  onSelectAnswer
}) {
  return (
    <section
      aria-label="Musikkryss-svar"
      style={{
        flex: "0 0 220px",
        width: "min(100%, 220px)",
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: "8px",
        padding: "10px",
        border: "1px solid #dbe3ee",
        borderRadius: "8px",
        background: "#fff",
        boxSizing: "border-box"
      }}
    >
      {answers.map(answer => {
        const id = `${answer.number}:${answer.direction}`;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={selectedAnswerId === id}
            onClick={() => onSelectAnswer(id)}
            style={{
              minHeight: "38px",
              padding: "7px 8px",
              border: selectedAnswerId === id
                ? "2px solid #2563eb"
                : "1px solid #cbd5e1",
              borderRadius: "6px",
              background: selectedAnswerId === id ? "#dbeafe" : "#f8fafc",
              color: "#0f172a",
              fontWeight: selectedAnswerId === id ? 700 : 600,
              cursor: "pointer"
            }}
          >
            {answer.number} {directionLabel(answer.direction)}
          </button>
        );
      })}
    </section>
  );
}
