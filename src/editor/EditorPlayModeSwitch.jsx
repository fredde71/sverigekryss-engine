import React from "react";

const MODES = Object.freeze([
  { value: "edit", label: "Redigera" },
  { value: "play", label: "Spela" }
]);

export default function EditorPlayModeSwitch({ value, onChange }) {
  return (
    <div
      aria-label="Editorläge"
      role="group"
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}
    >
      {MODES.map(mode => (
        <button
          key={mode.value}
          type="button"
          aria-pressed={value === mode.value}
          onClick={() => onChange(mode.value)}
          style={{
            minHeight: "36px",
            border: value === mode.value
              ? "2px solid #1d4ed8"
              : "1px solid #cbd5e1",
            borderRadius: "4px",
            background: value === mode.value ? "#eff6ff" : "#fff",
            fontWeight: value === mode.value ? 700 : 400,
            cursor: "pointer"
          }}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
