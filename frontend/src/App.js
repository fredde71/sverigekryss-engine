import React, { useState } from "react";

function App() {
  
  const [imageCells, setImageCells] = useState({});

  const toggleImageCell = (i) => {
    setImageCells(prev => ({ ...prev, [i]: !prev[i] }));
  };
const rows = 25;
  const cols = 25;

  const [gridArea, setGridArea] = useState({
    top: 50,
    left: 20,
    width: 500,
    height: 500
  });

  const [mode, setMode] = useState(null); // "move" | "resize-br"

  const handleMouseMove = (e) => {
    if (mode === "move") {
      setGridArea(prev => ({
        ...prev,
        top: prev.top + e.movementY,
        left: prev.left + e.movementX
      }));
    }

    if (mode === "resize-br") {
      setGridArea(prev => ({
        ...prev,
        width: Math.max(100, prev.width + e.movementX),
        height: Math.max(100, prev.height + e.movementY)
      }));
    }
  };

  const stopDrag = () => setMode(null);

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseUp={stopDrag}
      style={{ display: "flex", justifyContent: "center", userSelect: "none" }}
    >
      <div style={{ position: "relative", width: "800px" }}>
        
        <img
          src="/grid.png"
          alt="grid"
          style={{ width: "100%", display: "block" }}
        />

        {/* GRID AREA */}
        <div
          style={{
            position: "absolute",
            top: gridArea.top,
            left: gridArea.left,
            width: gridArea.width,
            height: gridArea.height
          }}
        >

          {/* MOVE */}
          <div
            onMouseDown={() => setMode("move")}
            style={{
              position: "absolute",
              inset: 0,
              border: "2px dashed blue",
              cursor: "move"
            }}
          />

          {/* 🔥 RESIZE HANDLE (bottom-right) */}
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              setMode("resize-br");
            }}
            style={{
              position: "absolute",
              right: -6,
              bottom: -6,
              width: "12px",
              height: "12px",
              background: "blue",
              cursor: "nwse-resize"
            }}
          />

          {/* GRID */}
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gridTemplateRows: `repeat(${rows}, 1fr)`
            }}
          >
            {Array.from({ length: rows * cols }).map((_, i) => (
              <div key={i} onClick={() => toggleImageCell(i)} style={{ border: '1px solid rgba(255,0,0,0.3)', backgroundColor: imageCells[i] ? 'rgba(0,0,255,0.5)' : 'transparent', cursor: 'pointer' }}>
            ))}
          </div>

        </div>

      </div>
    </div>
  );
}

export default App;
