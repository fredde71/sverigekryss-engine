import React from "react";

export default function SolutionHelpControls({
  answerSelected,
  onRevealLetter,
  onRevealAnswer,
  onRevealAll
}) {
  return (
    <section
      aria-label="Facit och hjälp"
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "8px"
      }}
    >
      <button
        type="button"
        disabled={!answerSelected}
        onClick={onRevealLetter}
      >
        Visa en bokstav
      </button>
      <button
        type="button"
        disabled={!answerSelected}
        onClick={onRevealAnswer}
      >
        Visa svaret
      </button>
      <button type="button" onClick={onRevealAll}>
        Visa hela facit
      </button>
    </section>
  );
}
