import React, { useEffect, useState } from "react";
import { moveGridArea } from "../engine/gridArea";

export default function EditorViewport({
  gridArea,
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
  const [mode, setMode] = useState(null);

  const handleGridClick = (e) => {
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

      if (mode === "move") {
        setGridArea(
          prev => moveGridArea(
            prev,
            movementX,
            movementY
          )
        );
      }

      if (mode === "resize") {
        setGridArea(prev => ({
          ...prev,
          width: Math.max(100, prev.width + movementX),
          height: Math.max(100, prev.height + movementY)
        }));
      }

      if (cropMode === "move") {
        setCropArea(prev => moveCropArea(
          prev,
          movementX,
          movementY
        ));
      }

      if (cropMode === "resize") {
        setCropArea(prev => resizeCropArea(
          prev,
          movementX,
          movementY
        ));
      }
    };

    const stopDrag = () => {
      setMode(null);
      setCropMode(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopDrag);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopDrag);
    };
  }, [mode, cropMode, setGridArea, setCropArea, setCropMode]);

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
        width: "1200px",
        height: "1200px",
        pointerEvents: "none"
      }}
    >
      {typeof children === "function" ? children({
        setMode,
        setCropMode,
        handleGridClick
      }) : children}
    </div>
  );
}

function moveCropArea(cropArea, movementX, movementY) {
  return {
    ...cropArea,
    top: clamp(cropArea.top + movementY, 0, 1200 - cropArea.height),
    left: clamp(cropArea.left + movementX, 0, 1200 - cropArea.width)
  };
}

function resizeCropArea(cropArea, movementX, movementY) {
  return {
    ...cropArea,
    width: clamp(cropArea.width + movementX, 100, 1200 - cropArea.left),
    height: clamp(cropArea.height + movementY, 100, 1200 - cropArea.top)
  };
}

function clamp(value, min, max) {
  return Math.min(
    Math.max(value, min),
    Math.max(min, max)
  );
}
