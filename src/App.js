import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import * as pdfjsLib from "pdfjs-dist";
import EditorWorkspace from "./editor/EditorWorkspace";
import GridCell from "./components/GridCell";
import EditCell from "./components/EditCell";
import RuntimeLayer from "./runtime/RuntimeLayer";
import TemplateCanvas from "./template/TemplateCanvas";
import { exportTemplateFile } from "./template/templateExport";
import { importTemplateFile } from "./template/templateImport";
import {
  loadBackendTemplate,
  publishBackendTemplate
} from "./template/templateApi";
import {
  getPublishFailureMessage,
  getPublishSuccessMessage
} from "./template/publishMessages";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

function App() {
  
  const { id } = useParams();
  const isSharedView = window.location.search.includes("data=");
  const isPublicRuntime = !!id;
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

  loadBackendTemplate(id)
    .then(data => {

      setCrosswordId(data.crosswordId);
      setCellTypes(data.cellTypes);
      setImageSrc(data.imageSrc);
      setGridArea(data.gridArea);

      setRows(data.rows);
      setCols(data.cols);

      setModeView("play");

    });

}, [id]);

  const [rows, setRows] = useState(25);
  const [cols, setCols] = useState(25);

  const [cellTypes, setCellTypes] = useState(
  Array(rows * cols).fill("empty")
);

  const [crosswordId, setCrosswordId] = useState("");

  const [gridArea, setGridArea] = useState({
    top: 0,
    left: 0,
    width: 1200,
    height: 1200
  });

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

  const data = await importTemplateFile(file, {
    crosswordId,
    rows,
    cols,
    gridArea,
    imageSrc
  });

  if (data.crosswordId) {
    setCrosswordId(data.crosswordId);
  }

  setRows(data.rows);
  setCols(data.cols);

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
    exportTemplateFile({
      crosswordId,
      rows,
      cols,
      gridArea,
      cellTypes,
      imageSrc
    });
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

  return (
    <EditorWorkspace
      rows={rows}
      cols={cols}
      cellTypes={cellTypes}
      gridArea={gridArea}
      setRows={setRows}
      setCols={setCols}
      setGridArea={setGridArea}
      setCellTypes={setCellTypes}
      isPublicRuntime={isPublicRuntime}
    >
      {({ toolbar, editor }) => (
    <div
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
        {toolbar}

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

    if (!crosswordId.trim()) {
      alert("Ange Crossword ID innan publicering.");
      return;
    }

    const template = {
      crosswordId,
      gridArea,
      cellTypes,
      imageSrc,
      rows,
      cols
    };

    try {
      const data = await publishBackendTemplate(template);

      console.log(data);

      if (data.success) {
        const publicUrl = `${window.location.origin}/play/${crosswordId}`;
        alert(getPublishSuccessMessage(publicUrl));
        return;
      }

      alert(data.error || "Publicering misslyckades.");
    } catch (err) {
      alert(getPublishFailureMessage(err));
    }

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
      <TemplateCanvas
        template={{
          crosswordId,
          rows,
          cols,
          cellTypes,
          imageSrc,
          gridArea
        }}
      >

 {modeView === "edit" && (
   editor
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

      </TemplateCanvas>

    </div>
      )}
    </EditorWorkspace>
  );
}

export default App;
