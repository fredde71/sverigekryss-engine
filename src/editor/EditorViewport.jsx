import React, { useEffect, useRef, useState } from "react";
import { normalizeDocumentSize } from "../template/documentGeometry";

export default function EditorViewport({
  gridArea,
  documentSize,
  setGridArea,
  setCropArea,
  cropMode,
  setCropMode,
  rows,
  cols,
  activeTool,
  setCellTypes,
  children
}) {
  const [gridDrag, setGridDrag] = useState(null);
  const gridDragMovedRef = useRef(false);
  const safeDocumentSize = normalizeDocumentSize(documentSize);
  const documentWidth = safeDocumentSize.width;
  const documentHeight = safeDocumentSize.height;

  const startGridResize = (e, edge = "corner") => {
    e.stopPropagation();
    gridDragMovedRef.current = false;

    setGridDrag({
      mode: "resize",
      edge,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startGridArea: gridArea
    });
  };

  const handleGridClick = (e) => {
    if (gridDragMovedRef.current) {
      gridDragMovedRef.current = false;
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const col = Math.floor((x / rect.width) * cols);
    const row = Math.floor((y / rect.height) * rows);

    const safeCol = Math.max(0, Math.min(cols - 1, col));
    const safeRow = Math.max(0, Math.min(rows - 1, row));

    const index = safeRow * cols + safeCol;

    setCellTypes(prev => {
      const next = [...prev];

      if (activeTool === "empty") {
        next[index] = "empty";
        return next;
      }

      if (prev[index] === activeTool) {
        next[index] = "empty";
        return next;
      }

      next[index] = activeTool;

      return next;
    });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      const movementX = Number.isFinite(e.movementX) ? e.movementX : 0;
      const movementY = Number.isFinite(e.movementY) ? e.movementY : 0;

      if (gridDrag?.mode === "resize") {
        const dx = e.clientX - gridDrag.startClientX;
        const dy = e.clientY - gridDrag.startClientY;

        if (dx !== 0 || dy !== 0) {
          gridDragMovedRef.current = true;
        }

        setGridArea(resizeGridArea(
          gridDrag.startGridArea,
          gridDrag.edge,
          dx,
          dy
        ));
      }

      if (cropMode === "move") {
        setCropArea(prev => moveCropArea(
          prev,
          movementX,
          movementY,
          {
            width: documentWidth,
            height: documentHeight
          }
        ));
      }

      if (cropMode === "resize") {
        setCropArea(prev => resizeCropArea(
          prev,
          movementX,
          movementY,
          {
            width: documentWidth,
            height: documentHeight
          }
        ));
      }
    };

    const stopDrag = () => {
      setGridDrag(null);
      setCropMode(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopDrag);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopDrag);
    };
  }, [
    gridDrag,
    cropMode,
    setGridArea,
    setCropArea,
    setCropMode,
    documentWidth,
    documentHeight
  ]);

  useEffect(() => {
    const handleKey = (e) => {
      if (!e.shiftKey) {
        if (e.key === "ArrowUp") {
          setGridArea(prev => ({ ...prev, top: prev.top - 1 }));
        }
        if (e.key === "ArrowDown") {
          setGridArea(prev => ({ ...prev, top: prev.top + 1 }));
        }
        if (e.key === "ArrowLeft") {
          setGridArea(prev => ({ ...prev, left: prev.left - 1 }));
        }
        if (e.key === "ArrowRight") {
          setGridArea(prev => ({ ...prev, left: prev.left + 1 }));
        }
      }

      if (e.shiftKey) {
        if (e.key === "ArrowRight") {
          setGridArea(prev => ({ ...prev, width: prev.width + 1 }));
        }
        if (e.key === "ArrowLeft") {
          setGridArea(prev => ({ ...prev, width: prev.width - 1 }));
        }
        if (e.key === "ArrowDown") {
          setGridArea(prev => ({ ...prev, height: prev.height + 1 }));
        }
        if (e.key === "ArrowUp") {
          setGridArea(prev => ({ ...prev, height: prev.height - 1 }));
        }
      }
    };

    window.addEventListener("keydown", handleKey);

    return () => window.removeEventListener("keydown", handleKey);
  }, [setGridArea]);

  return (
    <div
      data-testid="editor-viewport"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: `${documentWidth}px`,
        height: `${documentHeight}px`,
        pointerEvents: "none"
      }}
    >
      {typeof children === "function" ? children({
        startGridResize,
        setCropMode,
        handleGridClick
      }) : children}
    </div>
  );
}

function moveCropArea(cropArea, movementX, movementY, documentSize) {
  return {
    ...cropArea,
    top: clamp(cropArea.top + movementY, 0, documentSize.height - cropArea.height),
    left: clamp(cropArea.left + movementX, 0, documentSize.width - cropArea.width)
  };
}

function resizeCropArea(cropArea, movementX, movementY, documentSize) {
  return {
    ...cropArea,
    width: clamp(cropArea.width + movementX, 100, documentSize.width - cropArea.left),
    height: clamp(cropArea.height + movementY, 100, documentSize.height - cropArea.top)
  };
}

function resizeGridArea(gridArea, edge, dx, dy) {
  const minSize = 100;

  if (edge === "top") {
    const bottom = gridArea.top + gridArea.height;
    const top = Math.min(gridArea.top + dy, bottom - minSize);

    return {
      ...gridArea,
      top,
      height: bottom - top
    };
  }

  return {
    ...gridArea,
    width: Math.max(minSize, gridArea.width + dx),
    height: Math.max(minSize, gridArea.height + dy)
  };
}

function clamp(value, min, max) {
  return Math.min(
    Math.max(value, min),
    Math.max(min, max)
  );
}
