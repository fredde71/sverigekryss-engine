import React from "react";

const groupStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  padding: "12px",
  border: "1px solid #e1e4ea",
  background: "#fff",
  borderRadius: "6px"
};

const groupTitleStyle = {
  margin: 0,
  paddingBottom: "7px",
  borderBottom: "1px solid #e2e8f0",
  fontSize: "11px",
  fontWeight: 700,
  fontVariantCaps: "all-small-caps",
  color: "#64748b"
};

const inputStyle = {
  width: "100%",
  height: "34px",
  boxSizing: "border-box",
  padding: "6px 8px",
  border: "1px solid #cbd5e1",
  borderRadius: "4px"
};

const buttonStyle = {
  width: "100%",
  minHeight: "36px",
  padding: "8px 10px",
  border: "1px solid #cbd5e1",
  borderRadius: "4px",
  background: "#f8fafc",
  color: "#1f2937",
  cursor: "pointer",
  textAlign: "left",
  boxSizing: "border-box"
};

const activeButtonStyle = {
  ...buttonStyle,
  borderColor: "#1d4ed8",
  borderLeft: "5px solid #1d4ed8",
  background: "#eff6ff",
  color: "#172554",
  fontWeight: 800,
  boxShadow: "0 0 0 2px rgba(37, 99, 235, 0.18)"
};

function getToolButtonStyle(isActive) {
  return isActive ? activeButtonStyle : buttonStyle;
}

export default function EditorToolbar({
  pendingRows,
  setPendingRows,
  pendingCols,
  setPendingCols,
  activeTool,
  setActiveTool,
  createGrid
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <section style={groupStyle}>
        <h5 style={groupTitleStyle}>Grid</h5>
        <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          Rows
          <input
            type="number"
            value={pendingRows}
            onChange={(e) => setPendingRows(Number(e.target.value))}
            style={inputStyle}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          Cols
          <input
            type="number"
            value={pendingCols}
            onChange={(e) => setPendingCols(Number(e.target.value))}
            style={inputStyle}
          />
        </label>

        <button onClick={createGrid} style={buttonStyle}>
          Create Grid
        </button>
      </section>

      <section style={groupStyle}>
        <h5 style={groupTitleStyle}>Cellverktyg</h5>
        <button aria-pressed={activeTool === "image"} onClick={() => setActiveTool("image")} style={getToolButtonStyle(activeTool === "image")}>Image</button>
        <button aria-pressed={activeTool === "blocked"} onClick={() => setActiveTool("blocked")} style={getToolButtonStyle(activeTool === "blocked")}>Blocked</button>
        <button aria-pressed={activeTool === "double"} onClick={() => setActiveTool("double")} style={getToolButtonStyle(activeTool === "double")}>Double clue</button>
        <button aria-pressed={activeTool === "write"} onClick={() => setActiveTool("write")} style={getToolButtonStyle(activeTool === "write")}>Write</button>
        <button aria-pressed={activeTool === "competition"} onClick={() => setActiveTool("competition")} style={getToolButtonStyle(activeTool === "competition")}>🏆 Tävlingsruta</button>
        <button aria-pressed={activeTool === "empty"} onClick={() => setActiveTool("empty")} style={getToolButtonStyle(activeTool === "empty")}>Empty</button>
      </section>
    </div>
  );
}
