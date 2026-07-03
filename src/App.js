import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import * as pdfjsLib from "pdfjs-dist";
import EditorLayer from "./editor/EditorLayer";
import EditorViewport from "./editor/EditorViewport";
import EditorGrid from "./editor/EditorGrid";
import GridCell from "./components/GridCell";
import EditCell from "./components/EditCell";
import RuntimeLayer from "./runtime/RuntimeLayer";
import { moveGridArea } from "./engine/gridArea";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

function App() {
  
  const { id } = useParams();
  const isSharedView = window.location.search.includes("data=");
  const isPublicRuntime = !!id;
  const [activeTool, setActiveTool] = useState("image");
  const [modeView, setModeView] = useState("edit"); // edit | play
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const data = params.get("data");

    if (!data) return;

    try {
      const parsed = JSON.parse(decodeURIComponent(data));

      setCellTypes(parsed.cellTypes || {});
      setImageSrc(parsed.imageSrc || "");

      setGridArea(parsed.gridArea);

      setModeView("play");

    } catch (err) {
      console.error("Fel vid parsing av URL-data", err);
    }
  }, []);

useEffect(() => {

  if (!id) return;

  fetch(`http://localhost:5050/api/crossword/${id}`)
    .then(res => res.json())
    .then(template => {

      setCellTypes(template.cellTypes || {});
      setImageSrc(template.imageSrc || "");
      setGridArea(template.gridArea);

      setRows(template.rows || 25);
      setCols(template.cols || 25);

      setModeView("play");

    });

}, [id]);

  const [rows, setRows] = useState(25);
  const [cols, setCols] = useState(25);

  const [cellTypes, setCellTypes] = useState(
  Array(rows * cols).fill("empty")
);

  const [pendingRows, setPendingRows] = useState(25);
  const [pendingCols, setPendingCols] = useState(25);

  const [crosswordId, setCrosswordId] = useState("");

  const [gridArea, setGridArea] = useState({
    top: 0,
    left: 0,
    width: 1200,
    height: 1200
  });

  const [mode, setMode] = useState(null);
  const [imageSrc, setImageSrc] = useState("/grid.png");

  const handleImageUpload = async (e) => {

  const file = e.target.files?.[0];

  if (!file) return;

  console.log(file);

  if (file.type === "application/pdf") {

  const arrayBuffer = await file.arrayBuffer();

  const pdf = await pdfjsLib.getDocument({
  data: arrayBuffer
}).promise;

const page = await pdf.getPage(1);

const viewport = page.getViewport({ scale: 2 });

const canvas = document.createElement("canvas");

const context = canvas.getContext("2d");

canvas.width = viewport.width;
canvas.height = viewport.height;

await page.render({
  canvasContext: context,
  viewport
}).promise;

const image = canvas.toDataURL("image/png");

setImageSrc(image);

e.target.value = "";

return;
}

  const reader = new FileReader();

  reader.onload = () => {
    setImageSrc(reader.result);
  };

  reader.readAsDataURL(file);

};
const handleTemplateImport = async (e) => {

  const file = e.target.files?.[0];

  if (!file) return;

  const text = await file.text();

  const data = JSON.parse(text);

  if (data.gridArea) {
    setGridArea(data.gridArea);
  }

  if (data.cellTypes) {
    setCellTypes(data.cellTypes);
  }

  if (data.imageSrc) {
  setImageSrc(data.imageSrc);
}

};
  const exportTemplate = () => {
    const data = {
      gridArea,
      cellTypes,
      imageSrc,
      crosswordId
    };

    const json = JSON.stringify(data, null, 2);

const blob = new Blob(
  [json],
  { type: "application/json" }
);

const url = URL.createObjectURL(blob);

const a = document.createElement("a");

a.href = url;
a.download = "sverigekryss-template.json";

a.click();

URL.revokeObjectURL(url);
  };

  // ✅ NY FUNKTION (tillagd)
  const generateLink = () => {

  // ✅ SKAPA FULLT GRID
  const fullCellTypes = {};

  for (let i = 0; i < rows * cols; i++) {
    fullCellTypes[i] = cellTypes[i] || "empty";
  }

  const data = {
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
if (modeView === "play") {
  return; // viktigt: stoppa edit-logik
}

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
  const createGrid = () => {

  setRows(pendingRows);
  setCols(pendingCols);

  setCellTypes({});

};
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
        <div style={{ marginBottom: "10px" }}>

  <div>Crossword ID</div>

  <input
    type="text"
    value={crosswordId}
    onChange={(e) => setCrosswordId(e.target.value)}
    placeholder="TT-2026-0001"
    style={{ width: "140px" }}
  />

</div>
        <div style={{ marginBottom: "10px" }}>

  <div>Rows</div>

  <input
    type="number"
    value={pendingRows}
    onChange={(e) => setPendingRows(Number(e.target.value))}
    style={{ width: "80px" }}
  />

  <div style={{ marginTop: "10px" }}>Cols</div>

  <input
    type="number"
    value={pendingCols}
    onChange={(e) => setPendingCols(Number(e.target.value))}
    style={{ width: "80px" }}
  />

  <br /><br />

<button onClick={createGrid}>
  Create Grid
</button>

</div>
        <button onClick={() => setActiveTool("image")}>Image</button><br /><br />
        <button onClick={() => setActiveTool("blocked")}>Blocked</button><br /><br />
        <button onClick={() => setActiveTool("double")}>Double clue</button><br /><br />
        <button onClick={() => setActiveTool("write")}>Write</button><br /><br />
        <button onClick={() => setActiveTool("empty")}>Empty</button><br /><br />

        <hr />

        <button onClick={() => setModeView(modeView === "edit" ? "play" : "edit")}>
          {modeView === "edit" ? "PLAY MODE" : "EDIT MODE"}
        </button>

        <br /><br />

<div>Upload Image</div>

<input
  type="file"
  accept="image/*,.pdf"
  onChange={handleImageUpload}
/>
<br /><br />

<div>Import Template</div>

<input
  key={imageSrc}
  type="file"
  accept=".json"
  onChange={handleTemplateImport}
/>

<br /><br />
        <button onClick={exportTemplate}>
          Export Template
        </button>

        <button
  onClick={async () => {

    const template = {
      crosswordId,
      gridArea,
      cellTypes,
      imageSrc,
      rows,
      cols
    };

    const response = await fetch("http://localhost:5050/api/publish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(template)
    });

    const data = await response.json();

    console.log(data);

  }}
>
  Publish
</button>

        {/* ✅ NY KNAPP (tillagd) */}
        <button onClick={generateLink}>
          Generera länk
        </button>

        <hr />

</div>
      )} 

      {/* CANVAS */}
      <div
  style={{
    position: "relative",
    width: "1200px",
    height: "1200px",
    margin: "0 auto"
  }}
>
        
        <img
  src={imageSrc}
  alt="grid"
  style={{
    width: "1200px",
    display: "block"
  }}
/>

 {modeView === "edit" && (
 <EditorViewport
  gridArea={{
  ...gridArea,
  onGridClick: handleGridClick
}}
>
    <>
      <EditorGrid
        rows={rows}
        cols={cols}
        cellTypes={cellTypes}
      />

      <EditorLayer
        rows={rows}
        cols={cols}
        cellTypes={cellTypes}
        setMode={setMode}
        isPublicRuntime={isPublicRuntime}
        gridArea={gridArea}
      />
    </>
</EditorViewport>
  )}

{modeView === "play" && (
<RuntimeLayer
  data={{
    cellTypes,
    rows,
    cols,
    gridArea,
    imageSrc
  }}
/>
                    )}

      </div>

    </div>
  );
}

export default App;
