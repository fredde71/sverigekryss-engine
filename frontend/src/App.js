import React, { useState } from "react";

function App() {

  const [activeTool, setActiveTool] = useState("image");
  const [modeView, setModeView] = useState("edit"); // edit | play
  const [cellTypes, setCellTypes] = useState({});
  const [activeCell, setActiveCell] = useState(null);
  const [answers, setAnswers] = useState({});
  const [direction, setDirection] = useState("across"); // across | down
  const inputRefs = React.useRef([]);
  const rows = 25;
  const cols = 25;

  const [gridArea, setGridArea] = useState({
    top: 120,
    left: 20,
    width: 500,
    height: 500
  });

  const [mode, setMode] = useState(null);

  const exportTemplate = () => {
    const data = {
      gridArea,
      cellTypes
    };

    console.log("TEMPLATE:", JSON.stringify(data, null, 2));
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    alert("Template kopierad!");
  };

const handleGridClick = (e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const col = Math.floor((x / rect.width) * cols);
  const row = Math.floor((y / rect.height) * rows);

  const index = row * cols + col;
  // PLAY MODE → sätt riktning
if (modeView === "play") {

  const right = index + 1;
  const down = index + cols;

  const isRightWritable =
    cellTypes[right] !== "image" &&
    cellTypes[right] !== "blocked";

  const isDownWritable =
    cellTypes[down] !== "image" &&
    cellTypes[down] !== "blocked";

  if (isRightWritable) {
    setDirection("across");
  } else if (isDownWritable) {
    setDirection("down");
  }

  return; // viktigt: stoppa edit-logik
}

  setCellTypes(prev => {
    const next = { ...prev };

    // empty tool = alltid ta bort
    if (activeTool === "empty") {
      delete next[index];
      return next;
    }

    // samma tool = toggle bort
    if (prev[index] === activeTool) {
      delete next[index];
      return next;
    }

    // annars sätt ny
    next[index] = activeTool;
    return next;
  });
};

  const handleMouseMove = (e) => {
    if (mode === "move") {
      setGridArea(prev => ({
        ...prev,
        top: prev.top + e.movementY,
        left: prev.left + e.movementX
      }));
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

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseUp={stopDrag}
      style={{
        display: "flex",
        flexDirection: "row",
        gap: "20px",
        padding: "20px",
        userSelect: "none"
      }}
    >

      {/* TOOLBAR */}
      <div style={{
        width: "160px",
        background: "#f5f5f5",
        padding: "10px",
        border: "1px solid #ddd"
      }}>
        <h4>Tools</h4>
        {modeView === "edit" && (
        <div style={{ marginBottom: "10px" }}>
  <button onClick={() => setDirection("across")}>→</button>
  <button onClick={() => setDirection("down")}>↓</button>
</div>
)}

        <button onClick={() => setActiveTool("image")}>Image</button><br /><br />
        <button onClick={() => setActiveTool("blocked")}>Blocked</button><br /><br />
        <button onClick={() => setActiveTool("empty")}>Empty</button><br /><br />

        <hr />

        <button onClick={() => setModeView(modeView === "edit" ? "play" : "edit")}>
          {modeView === "edit" ? "PLAY MODE" : "EDIT MODE"}
        </button>

        <br /><br />

        <button onClick={exportTemplate}>
          Export Template
        </button>
        <hr />

</div>
      

      {/* CANVAS */}
      <div style={{ position: "relative", width: "1000px", marginTop: "-90px" }}>
        
        <img
          src="/grid.png"
          alt="grid"
          style={{ width: "100%", display: "block" }}
        />

        <div
          style={{
            position: "absolute",
            top: gridArea.top,
            left: gridArea.left,
            width: gridArea.width,
            height: gridArea.height
          }}
          onClick={handleGridClick}
        >

          {/* MOVE */}
          {modeView === "edit" && (
            <div
              onMouseDown={() => setMode("move")}
              style={{
                position: "absolute",
                inset: 0,
                border: "2px dashed blue",
                cursor: "move"
              }}
            />
          )}

          {/* RESIZE */}
          {modeView === "edit" && (
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                setMode("resize");
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
          )}

          {/* OVERLAY (endast i edit) */}
          {modeView === "edit" && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                display: "grid",
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gridTemplateRows: `repeat(${rows}, 1fr)`
              }}
            >
              {Array.from({ length: rows * cols }).map((_, i) => (
    <div
                  key={i}
                  style={{
                    backgroundColor:
                      cellTypes[i] === "image"
                        ? "rgba(0,120,255,0.3)"
                        : cellTypes[i] === "blocked"
                        ? "rgba(0,0,0,0.4)"
                        : "transparent"
                  }}
                />
              ))}
            </div>
          )}

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
           {Array.from({ length: rows * cols }).map((_, i) => {
  const type = cellTypes[i];
  const row = Math.floor(i / cols);
const col = i % cols;

const activeRow = activeCell !== null ? Math.floor(activeCell / cols) : null;
const activeCol = activeCell !== null ? activeCell % cols : null;

let isActiveLine = false;

if (activeCell !== null) {
  if (direction === "across") {
    if (row === activeRow) {

      let start = activeCell;
      while (
        start % cols !== 0 &&
        cellTypes[start - 1] !== "image" &&
        cellTypes[start - 1] !== "blocked"
      ) {
        start--;
      }

      let end = activeCell;
      while (
        end % cols !== cols - 1 &&
        cellTypes[end + 1] !== "image" &&
        cellTypes[end + 1] !== "blocked"
      ) {
        end++;
      }

      isActiveLine = i >= start && i <= end;
    }
  } else {
    if (col === activeCol) {

      let start = activeCell;
      while (
        start - cols >= 0 &&
        cellTypes[start - cols] !== "image" &&
        cellTypes[start - cols] !== "blocked"
      ) {
        start -= cols;
      }

      let end = activeCell;
      while (
        end + cols < rows * cols &&
        cellTypes[end + cols] !== "image" &&
        cellTypes[end + cols] !== "blocked"
      ) {
        end += cols;
      }

      isActiveLine = i >= start && i <= end;
    }
  }
}

  // PLAY MODE
  if (modeView === "play") {

    // låsta rutor
    if (type === "image" || type === "blocked") {
      return <div key={i} />;
    }

    // skrivbara rutor
    return (
      <input
  key={i}
  data-index={i}
  onFocus={(e) => {
  e.target.select();
  setActiveCell(i);
}}
onClick={(e) => {

  const right = i + 1;
  const down = i + cols;

  const isRightWritable =
    cellTypes[right] !== "image" &&
    cellTypes[right] !== "blocked";

  const isDownWritable =
    cellTypes[down] !== "image" &&
    cellTypes[down] !== "blocked";

  if (isRightWritable) {
    setDirection("across");
  } else if (isDownWritable) {
    setDirection("down");
  }
}}
  maxLength={1}
  value={answers[i] || ""}
   onChange={(e) => {
  const val = e.target.value.toUpperCase().slice(0, 1);

  setAnswers(prev => ({
    ...prev,
    [i]: val
  }));

  console.log("NEXT REF:", inputRefs.current[i + 1]);

  if (val) {
    setTimeout(() => {
  let nextIndex;

if (direction === "across") {
  nextIndex = i + 1;
} else {
  nextIndex = i + cols;
}
  const next = document.querySelector(`[data-index="${nextIndex}"]`);

  if (next) {
    next.focus();
  }
}, 0);
  }
}}
onKeyDown={(e) => {

  // ignorera allt utom piltangenter
  if (!["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(e.key)) {
    return;
  }

  e.preventDefault();

  let nextIndex = null;

  if (e.key === "ArrowRight") nextIndex = i + 1;
  if (e.key === "ArrowLeft") nextIndex = i - 1;
  if (e.key === "ArrowDown") nextIndex = i + cols;
  if (e.key === "ArrowUp") nextIndex = i - cols;

  const next = document.querySelector(`[data-index="${nextIndex}"]`);
  if (next) next.focus();
}}
  style={{
    width: "100%",
    height: "100%",
    textAlign: "center",
    fontSize: "18px",
    fontWeight: "bold",
    border: "none",
    outline: "none",
    boxSizing: "border-box",
padding: 0,
margin: 0,
    background: isActiveLine
  ? "rgba(0,150,255,0.15)"
  : "transparent"
  }}
/>
    );
  }

  // EDIT MODE (orörd)
  return (
    <div
      key={i}
      ref={(el) => (inputRefs.current[i] = el)}
      style={{
        border: "1px solid rgba(0,0,0,0.15)"
      }}
    />
  );
})}
          </div>

        </div>
      </div>

    </div>
  );
}

export default App;