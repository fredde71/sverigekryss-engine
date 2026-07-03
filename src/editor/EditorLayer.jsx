import React from "react";
import EditorGrid from "./EditorGrid";

export default function EditorLayer({
  rows,
  cols,
  cellTypes,
  setMode,
  isPublicRuntime,
  gridArea
}) {
  if (isPublicRuntime) {
    return null;
  }

  return (
    <div
  style={{
  width: "100%",
  height: "100%",
  pointerEvents: "none"
}}
>
      <div
  onMouseDown={() => setMode("move")}
  style={{
    pointerEvents: "auto",
    position: "absolute",
    top: -30,
    left: 0,
    right: 0,
    height: "30px",
    zIndex: 20,
    background: "rgba(0,0,255,0.15)",
    cursor: "move"
  }}
/>

      <div
        onMouseDown={(e) => {
          e.stopPropagation();
          setMode("resize");
        }}
        style={{
          pointerEvents: "auto",
          position: "absolute",
          right: -6,
          zIndex: 20,
          bottom: -6,
          width: "12px",
          height: "12px",
          background: "blue",
          cursor: "nwse-resize"
        }}
      />

      <EditorGrid
  rows={rows}
  cols={cols}
  cellTypes={cellTypes}
/>
    </div>
  );
}