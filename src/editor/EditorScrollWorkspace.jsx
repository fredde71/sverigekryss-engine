import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { normalizeDocumentSize } from "../template/documentGeometry";

const EditorWorkspaceScaleContext = createContext(1);

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

export default function EditorScrollWorkspace({ children, documentSize }) {
  const workspaceRef = useRef(null);
  const safeDocumentSize = useMemo(() => (
    normalizeDocumentSize(documentSize)
  ), [documentSize]);
  const documentWidth = safeDocumentSize.width;
  const documentHeight = safeDocumentSize.height;
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!workspaceRef.current || typeof ResizeObserver === "undefined") {
      setScale(1);
      return;
    }

    const updateScale = (entry) => {
      setScale(getEditorFitScale(safeDocumentSize, {
        width: entry?.contentRect?.width || workspaceRef.current?.clientWidth,
        height: entry?.contentRect?.height || workspaceRef.current?.clientHeight
      }));
    };
    const observer = new ResizeObserver(entries => {
      updateScale(entries[0]);
    });

    observer.observe(workspaceRef.current);

    return () => {
      observer.disconnect();
    };
  }, [documentWidth, documentHeight, safeDocumentSize]);

  return (
    <div
      ref={workspaceRef}
      data-testid="editor-scroll-workspace"
      style={{
        maxWidth: "calc(100vw - 220px)",
        maxHeight: "calc(100vh - 40px)",
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
  );
}
