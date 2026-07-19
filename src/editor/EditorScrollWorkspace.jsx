import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { normalizeDocumentSize } from "../template/documentGeometry";

const EditorWorkspaceScaleContext = createContext(1);
const ZOOM_STEP = 0.1;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;

export function useEditorWorkspaceScale() {
  return useContext(EditorWorkspaceScaleContext);
}

export function getEditorFitScale(documentSize, availableSize) {
  const safeDocumentSize = normalizeDocumentSize(documentSize);
  const availableWidth = availableSize?.width || safeDocumentSize.width;
  const availableHeight = availableSize?.height || safeDocumentSize.height;

  return Math.min(
    1,
    availableWidth / safeDocumentSize.width,
    availableHeight / safeDocumentSize.height
  );
}

function clampZoom(value) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}

export default function EditorScrollWorkspace({ children, documentSize }) {
  const workspaceRef = useRef(null);
  const safeDocumentSize = useMemo(() => (
    normalizeDocumentSize(documentSize)
  ), [documentSize]);
  const documentWidth = safeDocumentSize.width;
  const documentHeight = safeDocumentSize.height;
  const [fitScale, setFitScale] = useState(1);
  const [scale, setScale] = useState(1);
  const [zoomMode, setZoomMode] = useState("fit");

  useEffect(() => {
    if (!workspaceRef.current || typeof ResizeObserver === "undefined") {
      setFitScale(1);
      setScale(1);
      return;
    }

    const updateScale = (entry) => {
      const nextFitScale = getEditorFitScale(safeDocumentSize, {
        width: entry?.contentRect?.width || workspaceRef.current?.clientWidth,
        height: entry?.contentRect?.height || workspaceRef.current?.clientHeight
      });

      setFitScale(nextFitScale);

      if (zoomMode === "fit") {
        setScale(nextFitScale);
      }
    };
    const observer = new ResizeObserver(entries => {
      updateScale(entries[0]);
    });

    observer.observe(workspaceRef.current);

    return () => {
      observer.disconnect();
    };
  }, [documentWidth, documentHeight, safeDocumentSize, zoomMode]);

  const zoomOut = () => {
    setZoomMode("manual");
    setScale(currentScale => clampZoom(currentScale - ZOOM_STEP));
  };

  const zoomIn = () => {
    setZoomMode("manual");
    setScale(currentScale => clampZoom(currentScale + ZOOM_STEP));
  };

  const fitToWorkspace = () => {
    setZoomMode("fit");
    setScale(fitScale);
  };

  const zoomControlStyle = {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginBottom: "8px",
    padding: "6px 8px",
    border: "1px solid #e2e8f0",
    borderRadius: "6px",
    background: "#f8fafc",
    color: "#334155",
    fontSize: "13px",
    lineHeight: 1
  };

  const zoomLabelStyle = {
    marginRight: "4px",
    fontSize: "12px",
    fontWeight: 700,
    color: "#64748b"
  };

  const zoomButtonStyle = {
    width: "30px",
    height: "28px",
    padding: 0,
    border: "1px solid #cbd5e1",
    borderRadius: "4px",
    background: "#fff",
    color: "#1f2937",
    cursor: "pointer",
    fontSize: "15px",
    fontWeight: 700
  };

  const fitButtonStyle = {
    ...zoomButtonStyle,
    width: "auto",
    marginLeft: "6px",
    padding: "0 10px",
    color: "#475569",
    fontSize: "12px",
    fontWeight: 600
  };

  const zoomValueStyle = {
    width: "58px",
    fontSize: "13px",
    color: "#475569",
    textAlign: "center",
    fontVariantNumeric: "tabular-nums"
  };

  return (
    <div
      data-testid="editor-workspace-shell"
      style={{
        display: "flex",
        flexDirection: "column"
      }}
    >
      <div
        data-testid="editor-zoom-controls"
        style={zoomControlStyle}
      >
        <span style={zoomLabelStyle}>Zoom</span>
        <button type="button" onClick={zoomOut} style={zoomButtonStyle}>
          -
        </button>
        <span data-testid="editor-zoom-value" style={zoomValueStyle}>
          {Math.round(scale * 100)} %
        </span>
        <button type="button" onClick={zoomIn} style={zoomButtonStyle}>
          +
        </button>
        <button type="button" onClick={fitToWorkspace} style={fitButtonStyle}>
          Anpassa
        </button>
      </div>

      <div
        ref={workspaceRef}
        data-testid="editor-scroll-workspace"
        style={{
          maxWidth: "calc(100vw - 220px)",
          maxHeight: "calc(100vh - 78px)",
          overflow: "auto",
          position: "relative",
          border: "1px solid #ddd"
        }}
      >
        <div
          data-testid="editor-scroll-fit-frame"
          style={{
            position: "relative",
            width: `${documentWidth * scale}px`,
            height: `${documentHeight * scale}px`
          }}
        >
          <div
            data-testid="editor-scroll-source-frame"
            style={{
              position: "relative",
              width: `${documentWidth}px`,
              height: `${documentHeight}px`,
              transform: `scale(${scale})`,
              transformOrigin: "top left"
            }}
          >
            <EditorWorkspaceScaleContext.Provider value={scale}>
              {children}
            </EditorWorkspaceScaleContext.Provider>
          </div>
        </div>
      </div>
    </div>
  );
}
