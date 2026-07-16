import React from "react";
import EditorGrid from "./EditorGrid";

export default function EditorLayer({
  rows,
  cols,
  cellTypes,
  setMode,
  isPublicRuntime,
  gridArea,
  cropArea
}) {
  if (isPublicRuntime) {
    return null;
  }

  const safeCropArea = cropArea || {
    top: 0,
    left: 0,
    width: 1200,
    height: 1200
  };

  return (
    <div
      data-testid="editor-layer"
  style={{
  width: "100%",
  height: "100%",
  pointerEvents: "none"
}}
>
      <div
        data-testid="editor-crop-overlay"
        style={{
          position: "absolute",
          top: safeCropArea.top - gridArea.top,
          left: safeCropArea.left - gridArea.left,
          width: safeCropArea.width,
          height: safeCropArea.height,
          zIndex: 10,
          pointerEvents: "none",
          border: "2px dashed rgba(255, 140, 0, 0.95)",
          background: "rgba(255, 180, 0, 0.08)",
          boxSizing: "border-box"
        }}
      >
        <div
          data-testid="editor-crop-move-affordance"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "24px",
            background: "rgba(255, 140, 0, 0.22)",
            cursor: "move"
          }}
        />

        <div
          data-testid="editor-crop-resize-handle"
          style={{
            position: "absolute",
            right: -6,
            bottom: -6,
            width: "12px",
            height: "12px",
            background: "rgb(255, 140, 0)",
            cursor: "nwse-resize"
          }}
        />
      </div>

      <div
  data-testid="editor-grid-move-affordance"
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
        data-testid="editor-grid-resize-handle"
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
