import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import * as pdfjsLib from "pdfjs-dist";
import EditorWorkspace from "./editor/EditorWorkspace";
import EditorScrollWorkspace from "./editor/EditorScrollWorkspace";
import GridCell from "./components/GridCell";
import EditCell from "./components/EditCell";
import PlaySurface from "./play/PlaySurface";
import TemplateCanvas from "./template/TemplateCanvas";
import { exportTemplateFile } from "./template/templateExport";
import { importTemplateFile } from "./template/templateImport";
import {
  DEFAULT_DOCUMENT_SIZE,
  getDocumentSizeForDimensions,
  getFullDocumentArea,
  loadImageDocumentSize
} from "./template/documentGeometry";
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
      setDocumentSize(parsed.documentSize || DEFAULT_DOCUMENT_SIZE);
      setCompetitionCells(parsed.competitionCells || []);

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
      setCropArea(data.cropArea);
      setDocumentSize(data.documentSize);
      setCompetitionCells(data.competitionCells || []);

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

  const [cropArea, setCropArea] = useState({
    top: 0,
    left: 0,
    width: 1200,
    height: 1200
  });

  const [competitionCells, setCompetitionCells] = useState([]);

  const [documentSize, setDocumentSize] = useState(DEFAULT_DOCUMENT_SIZE);

  const [imageSrc, setImageSrc] = useState("/grid.png");
  const [imageFileName, setImageFileName] = useState("");
  const [templateFileName, setTemplateFileName] = useState("");
  const [editorZoomState, setEditorZoomState] = useState({
    fitScale: 1,
    scale: 1,
    zoomMode: "fit"
  });

  const handleImageUpload = async (e) => {

  const file = e.target.files?.[0];

  if (!file) return;

  setImageFileName(file.name);

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
const documentSize = getDocumentSizeForDimensions({
  width: viewport.width,
  height: viewport.height
});

setImageSrc(image);
setDocumentSize(documentSize);
setCropArea(getFullDocumentArea(documentSize));
setCompetitionCells([]);

e.target.value = "";

return;
}

  const reader = new FileReader();

  reader.onload = async () => {
    const image = reader.result;
    const documentSize = await loadImageDocumentSize(image);

    setImageSrc(image);
    setDocumentSize(documentSize);
    setCropArea(getFullDocumentArea(documentSize));
    setCompetitionCells([]);
  };

  reader.readAsDataURL(file);

};
const handleTemplateImport = async (e) => {

  const file = e.target.files?.[0];

  if (!file) return;

  setTemplateFileName(file.name);

  const data = await importTemplateFile(file, {
    crosswordId,
    rows,
    cols,
    documentSize,
    gridArea,
    cropArea,
    competitionCells,
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

  if (data.documentSize) {
    setDocumentSize(data.documentSize);
  }

  if (data.cropArea) {
    setCropArea(data.cropArea);
  }

  setCompetitionCells(data.competitionCells || []);

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
      documentSize,
      gridArea,
      cropArea,
      competitionCells,
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
  alert("Länk skapad! Se konsolen.");
};

  const sidebarSectionStyle = {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "12px",
    border: "1px solid #e1e4ea",
    background: "#fff",
    borderRadius: "6px"
  };

  const sidebarTitleStyle = {
    margin: 0,
    paddingBottom: "7px",
    borderBottom: "1px solid #e2e8f0",
    fontSize: "11px",
    fontWeight: 700,
    fontVariantCaps: "all-small-caps",
    color: "#64748b"
  };

  const sidebarButtonStyle = {
    width: "100%",
    minHeight: "36px",
    padding: "8px 10px",
    border: "1px solid #cbd5e1",
    borderRadius: "4px",
    background: "#f8fafc",
    color: "#1f2937",
    cursor: "pointer",
    textAlign: "left",
    boxSizing: "border-box"
  };

  const sidebarInputStyle = {
    width: "100%",
    height: "34px",
    boxSizing: "border-box",
    padding: "6px 8px",
    border: "1px solid #cbd5e1",
    borderRadius: "4px"
  };

  const fileInputButtonStyle = {
    ...sidebarButtonStyle,
    display: "flex",
    alignItems: "center",
    fontFamily: "inherit",
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.35,
    color: sidebarButtonStyle.color
  };

  const fileControlStyle = {
    display: "flex",
    flexDirection: "column",
    gap: "4px"
  };

  const fileStatusStyle = {
    padding: "0 2px",
    fontSize: "12px",
    lineHeight: 1.35,
    color: "#64748b"
  };

  const hiddenFileInputStyle = {
    width: 1,
    height: 1,
    opacity: 0,
    overflow: "hidden",
    position: "absolute",
    pointerEvents: "none"
  };

  return (
    <EditorWorkspace
      rows={rows}
      cols={cols}
      cellTypes={cellTypes}
      competitionCells={competitionCells}
      gridArea={gridArea}
      setRows={setRows}
      setCols={setCols}
      setGridArea={setGridArea}
      documentSize={documentSize}
      cropArea={cropArea}
      setCropArea={setCropArea}
      setCompetitionCells={setCompetitionCells}
      setCellTypes={setCellTypes}
      isPublicRuntime={isPublicRuntime}
    >
      {({ toolbar, competitionMenu, editor }) => (
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
        width: "220px",
        background: "#f1f5f9",
        padding: "14px",
        border: "1px solid #d8dee9",
        borderRadius: "8px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        alignSelf: "flex-start"
      }}>
        <section style={sidebarSectionStyle}>
          <h4 style={{ margin: 0, fontSize: "16px" }}>Redigerare</h4>
          <div style={{ fontSize: "13px", color: "#475569" }}>
            <div>
              ID: <strong>{crosswordId || "Ej angivet"}</strong>
            </div>
            <div>
              Storlek: <strong>{rows} x {cols}</strong>
            </div>
          </div>
        </section>

        <section style={sidebarSectionStyle}>
          <h5 style={sidebarTitleStyle}>Korsord</h5>
          <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            Korsords-ID
            <input
              type="text"
              value={crosswordId}
              onChange={(e) => setCrosswordId(e.target.value)}
              placeholder="TT-2026-0001"
              style={sidebarInputStyle}
            />
          </label>
        </section>

        {toolbar}
        {competitionMenu}

        <section style={sidebarSectionStyle}>
          <h5 style={sidebarTitleStyle}>Läge</h5>
          <button
            onClick={() => setModeView(modeView === "edit" ? "play" : "edit")}
            style={sidebarButtonStyle}
          >
            {modeView === "edit" ? "SPELLÄGE" : "REDIGERINGSLÄGE"}
          </button>
        </section>

        <section style={sidebarSectionStyle}>
          <h5 style={sidebarTitleStyle}>Filer</h5>
          <div style={fileControlStyle}>
            <label style={fileInputButtonStyle}>
              Ladda upp bild
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleImageUpload}
                style={hiddenFileInputStyle}
              />
            </label>
            <span style={fileStatusStyle}>
              {imageFileName || "Ingen fil vald"}
            </span>
          </div>

          <div style={fileControlStyle}>
            <label style={fileInputButtonStyle}>
              Importera mall
              <input
                key={imageSrc}
                type="file"
                accept=".json"
                onChange={handleTemplateImport}
                style={hiddenFileInputStyle}
              />
            </label>
            <span style={fileStatusStyle}>
              {templateFileName || "Ingen fil vald"}
            </span>
          </div>

          <button onClick={exportTemplate} style={sidebarButtonStyle}>
            Exportera mall
          </button>
        </section>

        <section style={sidebarSectionStyle}>
          <h5 style={sidebarTitleStyle}>Publicering</h5>
          <button
            style={sidebarButtonStyle}
            onClick={async () => {

              if (!crosswordId.trim()) {
                alert("Ange korsords-ID innan publicering.");
                return;
              }

              const template = {
                crosswordId,
                gridArea,
                cropArea,
                documentSize,
                cellTypes,
                imageSrc,
                competitionCells,
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
            Publicera
          </button>

          {/* ✅ NY KNAPP (tillagd) */}
          <button onClick={generateLink} style={sidebarButtonStyle}>
            Generera länk
          </button>
        </section>

</div>
      )} 

      {/* CANVAS */}
      {modeView === "edit" ? (
        <EditorScrollWorkspace
          documentSize={documentSize}
          zoomState={editorZoomState}
          setZoomState={setEditorZoomState}
        >
          <TemplateCanvas
            template={{
              crosswordId,
              rows,
              cols,
              cellTypes,
              imageSrc,
              documentSize,
              gridArea,
              cropArea,
              competitionCells
            }}
          >
            {editor}
          </TemplateCanvas>
        </EditorScrollWorkspace>
      ) : (
        <PlaySurface
          template={{
            crosswordId,
            rows,
            cols,
            cellTypes,
            imageSrc,
            documentSize,
            gridArea,
            cropArea,
            competitionCells
          }}
          onSubmitAnswers={() => {}}
        />
      )}

    </div>
      )}
    </EditorWorkspace>
  );
}

export default App;
