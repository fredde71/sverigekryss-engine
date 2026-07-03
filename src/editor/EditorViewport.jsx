import React, { useEffect, useState } from "react";
import { moveGridArea } from "../engine/gridArea";

export default function EditorViewport({
  gridArea,
  setGridArea,
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
      if (mode === "move") {
        setGridArea(
          prev => moveGridArea(
            prev,
            e.movementX,
            e.movementY
          )
        );
      }

      if (mode === "resize") {
        setGridArea(prev => ({
          ...prev,
          width: Math.max(100, prev.width + e.movementX),
          height: Math.max(100, prev.height + e.movementY)
        }));
      }
    };

    const stopDrag = () => setMode(null);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopDrag);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopDrag);
    };
  }, [mode, setGridArea]);

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
      onClick={handleGridClick}
      style={{
        position: "absolute",
        top: gridArea.top,
        left: gridArea.left,
        width: gridArea.width,
        height: gridArea.height
      }}
    >
      {typeof children === "function" ? children({ setMode }) : children}
    </div>
  );
}
