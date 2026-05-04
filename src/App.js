import React, { useState } from "react";

function App() {

  const isSharedView = window.location.search.includes("data=");
  const [activeTool, setActiveTool] = useState("image");
  const [modeView, setModeView] = useState("edit"); // edit | play
  const [cellTypes, setCellTypes] = useState({});
  const [activeCell, setActiveCell] = useState(null);
  const [answers, setAnswers] = useState({});
  const [direction, setDirection] = useState("across"); // across | down
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const data = params.get("data");

    if (!data) return;

    try {
      const parsed = JSON.parse(decodeURIComponent(data));

      setCellTypes(parsed.cellTypes || {});
      setAnswers(parsed.answers || {});

      // 🔥 viktigt: ignorera edit-position
      setGridArea({
        top: 0,
        left: 0,
        width: 1200,
        height: 1200
      });

      setModeView("play");

    } catch (err) {
      console.error("Fel vid parsing av URL-data", err);
    }
  }, []);
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

  // ✅ SKAPA FULLT GRID
  const fullCellTypes = {};

  for (let i = 0; i < rows * cols; i++) {
    fullCellTypes[i] = cellTypes[i] || "empty";
  }

  const data = {
    answers: answers,
    cellTypes: fullCellTypes, // 🔥 ändrad rad
    rows: rows,
    cols: cols,
    image: "/grid.png"
  };

  const encoded = encodeURIComponent(JSON.stringify(data));
  const url = `${window.location.origin}/?data=${encoded}`;

  console.log(url);
  alert("Länk skapad! Se console.");
};

const handleGridClick = (e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

const col = Math.floor((x / rect.width) * cols);
const row = Math.floor((y / rect.height) * rows);

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
    cellTypes[right] !== "blocked" &&
    cellTypes[right] !== "double";

  const isDownWritable =
    cellTypes[down] !== "image" &&
    cellTypes[down] !== "blocked" &&
    cellTypes[down] !== "double";

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
      {!window.location.search.includes("data=") && (
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
        <button onClick={() => setActiveTool("double")}>Double clue</button><br /><br />
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
      )} 

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
    pointerEvents: "auto"
  }}
  onClick={modeView === "edit" ? handleGridClick : undefined}
>

          {modeView === "edit" && !isSharedView && (
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

          {modeView === "edit" && !isSharedView && (
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

          {modeView === "edit" && !isSharedView && (
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
    : cellTypes[i] === "double"
    ? "rgba(255,0,0,0.3)"
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

  const isDouble = cellTypes[activeCell] === "double";

  if (isDouble) {

    // ACROSS
    let startA = activeCell;
    while (
      startA % cols !== 0 &&
      cellTypes[startA - 1] !== "image" &&
      cellTypes[startA - 1] !== "blocked" &&
      cellTypes[startA - 1] !== "double"
    ) startA--;

    let endA = activeCell;
    while (
      endA % cols !== cols - 1 &&
      cellTypes[endA + 1] !== "image" &&
      cellTypes[endA + 1] !== "blocked" &&
      cellTypes[endA + 1] !== "double"
    ) endA++;

    // DOWN
    let startD = activeCell;
    while (
      startD - cols >= 0 &&
      cellTypes[startD - cols] !== "image" &&
      cellTypes[startD - cols] !== "blocked" &&
      cellTypes[startD - cols] !== "double"
    ) startD -= cols;

    let endD = activeCell;
    while (
      endD + cols < rows * cols &&
      cellTypes[endD + cols] !== "image" &&
      cellTypes[endD + cols] !== "blocked" &&
      cellTypes[endD + cols] !== "double"
    ) endD += cols;

    const acrossActive = i >= startA && i <= endA;
    const downActive =
      (i - startD) % cols === 0 &&
      i >= startD &&
      i <= endD;

    isActiveLine = acrossActive || downActive;

  } else {

    if (direction === "across") {

      let start = activeCell;

      let end = activeCell;
      while (
        end % cols !== cols - 1 &&
        cellTypes[end + 1] !== "image" &&
        cellTypes[end + 1] !== "blocked" &&
        cellTypes[end + 1] !== "double"
      ) end++;

      isActiveLine = i >= start && i <= end;

    } else {

      let start = activeCell;

      let end = activeCell;
      while (
        end + cols < rows * cols &&
        cellTypes[end + cols] !== "image" &&
        cellTypes[end + cols] !== "blocked" &&
        cellTypes[end + cols] !== "double"
      ) end += cols;

      isActiveLine =
        (i - start) % cols === 0 &&
        i >= start &&
        i <= end;
    }

  }
}

  if (modeView === "play") {

    if (type === "blocked") {
  return (
    <div
      key={i}
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "transparent"
      }}
    />
  );
}

if (type === "image") {
  return (
    <div
      key={i}
      style={{
        width: "100%",
        height: "100%"
      }}
    />
  );
}
if (type === "double") {
  return (
    <div
      key={i}
      onClick={() => {
        setActiveCell(i);
     setDirection(prev => {
  if (prev === "across") {
    return "down";
  }
  return "across";
});
      }}
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "transparent",
        cursor: "pointer"
      }}
    />
  );
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
  const down = i + cols;
 
  const isRightWritable =
  right % cols !== 0 &&
  cellTypes[right] !== "image" &&
  cellTypes[right] !== "blocked" &&
  cellTypes[right] !== "double";

  const isDownWritable =
    down < rows * cols &&
    cellTypes[down] !== "image" &&
    cellTypes[down] !== "blocked" &&
    cellTypes[down] !== "double";

  // 🔥 prioritet: om horisontellt ord finns → across
  if (activeCell === null) {
  if (isRightWritable) {
    setDirection("across");
  } else if (isDownWritable) {
    setDirection("down");
    }
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
  const next = i + 1;

  if (
    next % cols !== 0 &&
    cellTypes[next] !== "image" &&
    cellTypes[next] !== "blocked" &&
    cellTypes[next] !== "double"
  ) {
    nextIndex = next;
  }

} else {

  const next = i + cols;

  if (
    next < rows * cols &&
    cellTypes[next] !== "image" &&
    cellTypes[next] !== "blocked" &&
    cellTypes[next] !== "double"
  ) {
    nextIndex = next;
  }
}
 const nextInput = document.querySelector(`[data-index="${nextIndex}"]`);

if (nextInput) {
  nextInput.focus();
}
}, 0);
  }
}}
onKeyDown={(e) => {
  if (!["ArrowRight", "ArrowDown"].includes(e.key)) return;

  e.preventDefault();

  let nextIndex = null;

  if (e.key === "ArrowRight") nextIndex = i + 1;
  if (e.key === "ArrowDown") nextIndex = i + cols;

  const nextInput = document.querySelector(`[data-index="${nextIndex}"]`);
  if (nextInput) nextInput.focus();
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

// EDIT MODE
if (modeView === "edit") {
  return (
    <div
      key={i}
      ref={(el) => (inputRefs.current[i] = el)}
      style={{
        border: "1px solid rgba(0,0,0,0.15)"
      }}
    />
  );
}

// PLAY MODE (transparent fallback)
return null;

})}
          </div>

        </div>
      </div>

    </div>
  );
}

export default App;