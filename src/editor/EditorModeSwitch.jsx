import React from "react";

const TYPES = Object.freeze([
  { value: "sverigekryss", label: "Sverigekryss" },
  { value: "musikkryss", label: "Musikkryss" }
]);

export default function EditorModeSwitch({ value, onChange }) {
  return (
    <section
      aria-label="Korsordstyp"
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}
    >
      {TYPES.map(type => (
        <button
          key={type.value}
          type="button"
          aria-pressed={value === type.value}
          onClick={() => onChange(type.value)}
          style={{
            minHeight: "36px",
            border: value === type.value
              ? "2px solid #1d4ed8"
              : "1px solid #cbd5e1",
            borderRadius: "4px",
            background: value === type.value ? "#eff6ff" : "#fff",
            fontWeight: value === type.value ? 700 : 400,
            cursor: "pointer"
          }}
        >
          {type.label}
        </button>
      ))}
    </section>
  );
}
