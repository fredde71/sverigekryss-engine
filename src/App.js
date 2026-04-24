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
    top: 0,
    left: 0,
    width: 1200,
    height: 1200
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

  // ✅ NY FUNKTION (tillagd)
  const generateLink = () => {
    const data = {
      answers: answers,
      cellTypes: cellTypes,
      gridArea: gridArea,
      rows: rows,
      cols: cols,
      image: window.location.origin + "/grid.png"
    };

    const encoded = encodeURIComponent(JSON.stringify(data));
    const url = `${window.location.origin}/play?data=${encoded}`;

    console.log(url);
    alert("Länk skapad! Se console.");
  };

const handleGridClick = (e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const col = Math.floor((x / gridArea.width) * cols);
const row = Math.floor((y / gridArea.height) * rows);

// ✅ lägg till dessa två rader
const safeCol = Math.max(0, Math.min(cols - 1, col));
const safeRow = Math.max(0, Math.min(rows - 1, row));

// ✅ använd dessa istället
const index = safeRow * cols + safeCol;
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

    if (activeTool === "empty") {
      delete next[index];
      return next;
    }

    if (prev[index] === activeTool) {
      delete next[index];
      return next;
    }

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
  React.useEffect(() => {
  const handleKey = (e) => {
    if (modeView !== "edit") return;

    // Flytta grid (1px precision)
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

    // Resize grid (SHIFT + pilar)
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
}, [modeView]);

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

        {/* ✅ NY KNAPP (tillagd) */}
        <button onClick={generateLink}>
          Generera länk
        </button>

        <hr />

</div>
      

      {/* CANVAS */}
      <div style={{ position: "relative", width: "1200px", margin: "0 auto" }}>
        
        <img
  src="/grid.png"
  alt="grid"
  style={{
    width: "1200px",
    display: "block"
  }}
/>

        <div
          style={{
            position: "absolute",
            top: gridArea.top,
            left: gridArea.left,
            width: gridArea.width,
            height: gridArea.height,
            pointerEvents: modeView === "play" ? "none" : "auto"
          }}
          onClick={handleGridClick}
        >

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

let isActiveLine = false;

if (activeCell !== null) {

  let cellsInWord = [];

  if (direction === "across") {

    let start = activeCell;
    while (
      start % cols !== 0 &&
      cellTypes[start - 1] !== "image" &&
      cellTypes[start - 1] !== "blocked"
    ) {
      start--;
    }

    let current = start;
    while (
      current % cols !== cols &&
      cellTypes[current] !== "image" &&
      cellTypes[current] !== "blocked"
    ) {
      cellsInWord.push(current);

      if (current % cols === cols - 1) break;
      current++;
    }

  } else {

    let start = activeCell;
    while (
      start - cols >= 0 &&
      cellTypes[start - cols] !== "image" &&
      cellTypes[start - cols] !== "blocked"
    ) {
      start -= cols;
    }

    let current = start;
    while (
      current < rows * cols &&
      cellTypes[current] !== "image" &&
      cellTypes[current] !== "blocked"
    ) {
      cellsInWord.push(current);
      current += cols;
    }
  }

  isActiveLine = cellsInWord.includes(i);
}

  if (modeView === "play") {

    if (type === "image" || type === "blocked") {
      return null;
    }

    return (
      <input
  key={i}
  data-index={i}
  onFocus={(e) => {
  e.target.select();
  setActiveCell(i);
}}
onClick={(e) => {
  setActiveCell(i);

  const right = i + 1;
  const left = i - 1;
  const down = i + cols;
  const up = i - cols;

  const isRightWritable =
    right % cols !== 0 &&
    cellTypes[right] !== "image" &&
    cellTypes[right] !== "blocked";

  const isLeftWritable =
    i % cols !== 0 &&
    cellTypes[left] !== "image" &&
    cellTypes[left] !== "blocked";

  const isDownWritable =
    down < rows * cols &&
    cellTypes[down] !== "image" &&
    cellTypes[down] !== "blocked";

  const isUpWritable =
    up >= 0 &&
    cellTypes[up] !== "image" &&
    cellTypes[up] !== "blocked";

  // 🔥 prioritet: om horisontellt ord finns → across
  if (isLeftWritable || isRightWritable) {
    setDirection("across");
  } else if (isUpWritable || isDownWritable) {
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
backgroundColor: "transparent",
pointerEvents: "auto",
    background: isActiveLine
  ? "rgba(0,150,255,0.15)"
  : "transparent"
  }}
/>
    );
  }

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