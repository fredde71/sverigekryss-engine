import React, { useEffect, useState } from "react";
import { moveGridArea } from "../engine/gridArea";

export default function EditorViewport({
  gridArea,
  setGridArea,
  onGridClick,
  children
}) {
  const [mode, setMode] = useState(null);

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
      onClick={onGridClick}
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
