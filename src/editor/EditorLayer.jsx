import React from "react";
import EditorGrid from "./EditorGrid";
import { normalizeDocumentSize } from "../template/documentGeometry";

export default function EditorLayer({
  rows,
  cols,
  cellTypes,
  startGridMove,
  startGridResize,
  handleGridClick,
  isPublicRuntime,
  documentSize,
  gridArea,
  cropArea,
  setCropMode
}) {
  if (isPublicRuntime) {
    return null;
  }

  const safeDocumentSize = normalizeDocumentSize(documentSize);
  const safeCropArea = cropArea || {
    top: 0,
    left: 0,
    width: safeDocumentSize.width,
    height: safeDocumentSize.height
  };

  return (
    <div
      data-testid="editor-layer"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: `${safeDocumentSize.width}px`,
        height: `${safeDocumentSize.height}px`,
        pointerEvents: "none"
      }}
    >
      <div
        data-testid="editor-crop-overlay"
        style={{
          position: "absolute",
          top: safeCropArea.top,
          left: safeCropArea.left,
          width: safeCropArea.width,
          height: safeCropArea.height,
          zIndex: 30,
          pointerEvents: "none",
          border: "2px dashed rgba(255, 140, 0, 0.95)",
          background: "rgba(255, 180, 0, 0.08)",
          boxSizing: "border-box"
        }}
      >
        <div
          data-testid="editor-crop-move-affordance"
          onMouseDown={(e) => {
            e.stopPropagation();
            setCropMode("move");
          }}
          style={{
            pointerEvents: "auto",
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
          onMouseDown={(e) => {
            e.stopPropagation();
            setCropMode("resize");
          }}
          style={{
            pointerEvents: "auto",
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
        data-testid="editor-grid-frame"
        onClick={handleGridClick}
        style={{
          pointerEvents: "auto",
          position: "absolute",
          top: gridArea.top,
          left: gridArea.left,
          width: gridArea.width,
          height: gridArea.height,
          zIndex: 20
        }}
      >
        <div
          data-testid="editor-grid-move-affordance"
          onMouseDown={startGridMove}
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
          onMouseDown={startGridResize}
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
    </div>
  );
}
