import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import * as pdfjsLib from "pdfjs-dist";
import EditorWorkspace from "./editor/EditorWorkspace";
import EditorScrollWorkspace from "./editor/EditorScrollWorkspace";
import EditorModeSwitch from "./editor/EditorModeSwitch";
import EditorPlayModeSwitch from "./editor/EditorPlayModeSwitch";
import MusikkryssEditorContainer from "./editor/MusikkryssEditorContainer";
import EditorSessionWorkspace, {
  applyTemplateToEditorSession
} from "./editor/EditorSessionWorkspace";
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
import {
  createBackendPublication,
  loadBackendPublicationsForCrossword
} from "./publication/publicationApi";
import { createPublicationFromTemplate } from "./publication/publicationModel";
import { readBrowserImageData } from "./digitization/adapters/browserImageDataReader";
import { runDigitizationJob } from "./digitization/engine/DigitizationEngine";
import DigitizationSuggestionOverlay from "./digitization/DigitizationSuggestionOverlay";
import { runDigitizationUploadWithIdentity } from "./digitization/digitizationUploadIdentityGuard";
import {
  createGridLatticeEditorProposal
} from "./digitization/analysis/reconstruction/GridLatticeEditorProposal";
import {
  createEmptyMusikkryssContent,
  normalizeMusikkryssContent
} from "./musikkryss/MusikkryssFormat";
import { createMusikkryssTemplate } from "./musikkryss/MusikkryssTemplateInitializer";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

function AppSessionApplication({
  crosswordType,
  setCrosswordType,
  session,
  setters,
  updateSession
}) {
  const {
    modeView,
    rows,
    cols,
    cellTypes,
    crosswordId,
    gridArea,
    cropArea,
    competitionCells,
    answerPaths,
    horizontalLinePositions,
    verticalLinePositions,
    documentSize,
    imageSrc,
    imageFileName,
    templateFileName,
    editorZoomState,
    editorScrollState,
    digitizationResult,
    editorDocumentLifecycleId,
    musikkryss
  } = session;
  const {
    setModeView,
    setRows,
    setCols,
    setCellTypes,
    setCrosswordId,
    setGridArea,
    setCropArea,
    setCompetitionCells,
    setAnswerPaths,
    setHorizontalLinePositions,
    setVerticalLinePositions,
    setDocumentSize,
    setImageSrc,
    setImageFileName,
    setEditorZoomState,
    setEditorScrollState,
    setDigitizationResult,
    setEditorDocumentLifecycleId,
    setMusikkryss
  } = setters;
  
  const { id } = useParams();
  const isSharedView = window.location.search.includes("data=");
  const isPublicRuntime = !!id;
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const data = params.get("data");

    if (!data) return;

    try {
      const parsed = JSON.parse(decodeURIComponent(data));
      const targetType = parsed.crosswordType || "sverigekryss";

      updateSession(targetType, current => ({
        ...current,
        cellTypes: parsed.cellTypes || {},
        imageSrc: parsed.imageSrc || "",
        gridArea: parsed.gridArea,
        documentSize: parsed.documentSize || DEFAULT_DOCUMENT_SIZE,
        competitionCells: parsed.competitionCells || [],
        musikkryss: normalizeMusikkryssContent(parsed.musikkryss),
        modeView: "play"
      }));
      setCrosswordType(targetType);

    } catch (err) {
      console.error("Fel vid parsing av URL-data", err);
    }
  }, [setCrosswordType, updateSession]);

useEffect(() => {

  if (!id) return;

  loadBackendTemplate(id)
    .then(data => {
      const targetType = data.crosswordType || "sverigekryss";

      updateSession(targetType, current => ({
        ...current,
        crosswordId: data.crosswordId,
        cellTypes: data.cellTypes,
        imageSrc: data.imageSrc,
        gridArea: data.gridArea,
        cropArea: data.cropArea,
        documentSize: data.documentSize,
        competitionCells: data.competitionCells || [],
        musikkryss: normalizeMusikkryssContent(data.musikkryss),
        rows: data.rows,
        cols: data.cols,
        modeView: "play"
      }));
      setCrosswordType(targetType);

    });

}, [id, setCrosswordType, updateSession]);

  const [publications, setPublications] = useState([]);
  const [publicationsStatus, setPublicationsStatus] = useState("idle");
  const [publicationsError, setPublicationsError] = useState("");
  const digitizationUploadIdRef = useRef({
    sverigekryss: 0,
    musikkryss: 0
  });
  const gridLatticeReconstructionResult =
    digitizationResult?.status === "completed"
      ? digitizationResult.result?.gridLatticeReconstructionResult ?? null
      : null;
  const outerVisualExtent = digitizationResult?.status === "completed"
    ? digitizationResult.result?.outerVisualExtent ?? null
    : null;
  const gridFormatGeometrySelection = digitizationResult?.status === "completed"
    ? digitizationResult.result?.gridFormatGeometrySelection ?? null
    : null;
  const gridLatticeEditorProposal = React.useMemo(() => {
    if (
      crosswordType !== "sverigekryss"
      || gridLatticeReconstructionResult?.status !== "available"
      || gridLatticeReconstructionResult.lattice?.status !== "available"
      || !outerVisualExtent
    ) {
      return null;
    }

    const proposal = createGridLatticeEditorProposal({
      gridLattice: gridLatticeReconstructionResult.lattice,
      outerVisualExtent,
      gridFormatGeometrySelection
    });

    return proposal.status === "available" ? proposal : null;
  }, [
    gridLatticeReconstructionResult,
    outerVisualExtent,
    gridFormatGeometrySelection,
    crosswordType
  ]);

  const applyUploadedDocument = ({
    originatingCrosswordType,
    image,
    documentSize: uploadedDocumentSize
  }) => {
    if (originatingCrosswordType === "musikkryss") {
      updateSession(originatingCrosswordType, current => (
        applyTemplateToEditorSession(current, createMusikkryssTemplate({
          crosswordId: current.crosswordId,
          documentSize: uploadedDocumentSize,
          imageSrc: image
        }))
      ));
      return;
    }

    setImageSrc(image);
    setDocumentSize(uploadedDocumentSize);
    setCropArea(getFullDocumentArea(uploadedDocumentSize));
    setCompetitionCells([]);
  };

  const refreshPublications = React.useCallback(async (targetCrosswordId) => {
    const normalizedCrosswordId = targetCrosswordId.trim();

    if (!normalizedCrosswordId) {
      setPublications([]);
      setPublicationsStatus("idle");
      setPublicationsError("");
      return;
    }

    setPublicationsStatus("loading");
    setPublicationsError("");

    try {
      const publicationList = await loadBackendPublicationsForCrossword(
        normalizedCrosswordId
      );

      setPublications(Array.isArray(publicationList) ? publicationList : []);
      setPublicationsStatus("loaded");
    } catch (err) {
      setPublications([]);
      setPublicationsStatus("error");
      setPublicationsError("Kunde inte hämta publiceringar.");
    }
  }, []);

  useEffect(() => {
    refreshPublications(crosswordId);
  }, [crosswordId, refreshPublications]);

  const handleImageUpload = async (e) => {

  const file = e.target.files?.[0];

  if (!file) return;

  const originatingCrosswordType = crosswordType;
  const uploadId = ++digitizationUploadIdRef.current[originatingCrosswordType];

  setEditorDocumentLifecycleId(uploadId);
  setImageSrc("");
  setDocumentSize(DEFAULT_DOCUMENT_SIZE);
  setAnswerPaths([]);
  setMusikkryss(createEmptyMusikkryssContent());
  setHorizontalLinePositions(null);
  setVerticalLinePositions(null);

  setDigitizationResult({
    status: "pending"
  });

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

applyUploadedDocument({
  originatingCrosswordType,
  image,
  documentSize
});

e.target.value = "";

    runDigitizationForUpload(
      canvas,
      documentSize,
      uploadId,
      originatingCrosswordType
    );

return;
}

  const reader = new FileReader();

  reader.onload = async () => {
    const image = reader.result;
    const documentSize = await loadImageDocumentSize(image);

    applyUploadedDocument({
      originatingCrosswordType,
      image,
      documentSize
    });

    runDigitizationForUpload(
      image,
      documentSize,
      uploadId,
      originatingCrosswordType
    );
  };

  reader.readAsDataURL(file);

};

  const runDigitizationForUpload = async (
    source,
    targetDocumentSize,
    uploadId,
    originatingCrosswordType
  ) => {
    await runDigitizationUploadWithIdentity({
      uploadId,
      isCurrentUpload: (candidateUploadId) => (
        candidateUploadId === (
          digitizationUploadIdRef.current[originatingCrosswordType]
        )
      ),
      runProduction: () => runDigitizationJob({
        job: {
          jobId: `upload-${uploadId}`,
          source,
          options: {
            documentSize: targetDocumentSize
          }
        },
        readImageData: readBrowserImageData
      }),
      onPending: () => {
        updateSession(originatingCrosswordType, current => ({
          ...current,
          digitizationResult: { status: "pending" }
        }));
      },
      onProductionCompleted: (productionResult) => {
        updateSession(originatingCrosswordType, current => ({
          ...current,
          digitizationResult: {
            status: "completed",
            result: productionResult
          }
        }));
      },
      onProductionFailed: (err) => {
        updateSession(originatingCrosswordType, current => ({
          ...current,
          digitizationResult: {
            status: "failed",
            error: err
          }
        }));
        console.warn("Digitization failed during upload", err);
      },
    });
  };
const handleTemplateImport = async (e) => {

  const file = e.target.files?.[0];

  if (!file) return;

  const data = await importTemplateFile(file, {
    crosswordId,
    rows,
    cols,
    documentSize,
    gridArea,
    cropArea,
    competitionCells,
    answerPaths,
    horizontalLinePositions,
    verticalLinePositions,
    imageSrc,
    crosswordType,
    musikkryss
  });

  const targetType = data.crosswordType || "sverigekryss";

  updateSession(targetType, current => ({
    ...current,
    crosswordId: data.crosswordId || current.crosswordId,
    rows: data.rows,
    cols: data.cols,
    gridArea: data.gridArea || current.gridArea,
    documentSize: data.documentSize || current.documentSize,
    cropArea: data.cropArea || current.cropArea,
    competitionCells: data.competitionCells || [],
    answerPaths: data.answerPaths || [],
    musikkryss: normalizeMusikkryssContent(data.musikkryss),
    horizontalLinePositions: data.horizontalLinePositions || null,
    verticalLinePositions: data.verticalLinePositions || null,
    cellTypes: data.cellTypes || current.cellTypes,
    imageSrc: data.imageSrc || current.imageSrc,
    templateFileName: file.name
  }));
  setCrosswordType(targetType);

};
  const exportTemplate = () => {
    exportTemplateFile({
      crosswordId,
      crosswordType,
      musikkryss,
      rows,
      cols,
      documentSize,
      gridArea,
      cropArea,
      competitionCells,
      answerPaths,
      horizontalLinePositions,
      verticalLinePositions,
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

  const publicationListStyle = {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    margin: 0,
    padding: 0,
    listStyle: "none"
  };

  const publicationItemStyle = {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    padding: "8px",
    border: "1px solid #e2e8f0",
    borderRadius: "4px",
    background: "#f8fafc",
    fontSize: "12px",
    lineHeight: 1.35,
    color: "#334155"
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
      sessionKey={crosswordType}
      rows={rows}
      cols={cols}
      cellTypes={cellTypes}
      competitionCells={competitionCells}
      answerPaths={answerPaths}
      horizontalLinePositions={horizontalLinePositions}
      verticalLinePositions={verticalLinePositions}
      gridArea={gridArea}
      setRows={setRows}
      setCols={setCols}
      setGridArea={setGridArea}
      documentSize={documentSize}
      cropArea={cropArea}
      setCropArea={setCropArea}
      setCompetitionCells={setCompetitionCells}
      setAnswerPaths={setAnswerPaths}
      setHorizontalLinePositions={setHorizontalLinePositions}
      setVerticalLinePositions={setVerticalLinePositions}
      setCellTypes={setCellTypes}
      gridProposal={gridLatticeEditorProposal}
      documentLifecycleId={editorDocumentLifecycleId}
      documentAvailable={Boolean(imageSrc)}
      isPublicRuntime={isPublicRuntime}
    >
      {({ toolbar, competitionMenu, answerPathMenu, editor }) => (
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

        <EditorModeSwitch
          value={crosswordType}
          onChange={setCrosswordType}
        />

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

	        {crosswordType === "sverigekryss" && (
          <>
	          {toolbar}
	          {competitionMenu}
	          {answerPathMenu}
          </>
        )}

	        <section style={sidebarSectionStyle}>
          <h5 style={sidebarTitleStyle}>Läge</h5>
	          {crosswordType === "musikkryss" ? (
	            <EditorPlayModeSwitch
	              value={modeView}
	              onChange={setModeView}
	            />
	          ) : (
	            <button
	              onClick={() => setModeView(modeView === "edit" ? "play" : "edit")}
	              style={sidebarButtonStyle}
	            >
	              {modeView === "edit" ? "SPELLÄGE" : "REDIGERINGSLÄGE"}
	            </button>
	          )}
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
                crosswordType,
                ...(crosswordType === "musikkryss" ? { musikkryss } : {}),
                gridArea,
                cropArea,
                documentSize,
                cellTypes,
                imageSrc,
                competitionCells,
                answerPaths,
                horizontalLinePositions,
                verticalLinePositions,
                rows,
                cols
              };

              try {
                const data = await publishBackendTemplate(template);

                console.log(data);

                if (data.success) {
                  const fallbackPublicUrl = `${window.location.origin}/play/${crosswordId}`;
                  const publication = createPublicationFromTemplate({
                    template,
                    publicUrl: fallbackPublicUrl
                  });
                  const createdPublication = await createBackendPublication(publication);
                  const publicUrl = `${window.location.origin}/play/${
                    createdPublication.publicationId || crosswordId
                  }`;

                  await refreshPublications(crosswordId);

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

        <section style={sidebarSectionStyle}>
          <h5 style={sidebarTitleStyle}>Publiceringar</h5>
          {!crosswordId.trim() ? (
            <div style={fileStatusStyle}>
              Ange korsords-ID för att visa publiceringar.
            </div>
          ) : publicationsStatus === "loading" ? (
            <div style={fileStatusStyle}>Hämtar publiceringar...</div>
          ) : publicationsStatus === "error" ? (
            <div style={fileStatusStyle}>{publicationsError}</div>
          ) : publications.length === 0 ? (
            <div style={fileStatusStyle}>Inga publiceringar finns ännu.</div>
          ) : (
            <ul style={publicationListStyle}>
              {publications.map((publication) => (
                <li
                  key={publication.publicationId}
                  style={publicationItemStyle}
                >
                  <strong>{publication.publicationId}</strong>
                  <span>{publication.newspaper || "Tidning ej angiven"}</span>
                  <span>{publication.publishDate || "Datum ej angivet"}</span>
                  <span>{publication.status || "Status saknas"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

</div>
      )} 

      {/* CANVAS */}
      {modeView === "edit" ? (
        crosswordType === "musikkryss" ? (
          <MusikkryssEditorContainer
            template={{
              crosswordId,
              crosswordType,
              musikkryss,
              rows,
              cols,
              cellTypes,
              imageSrc,
              documentSize,
              gridArea,
              cropArea,
              competitionCells,
              answerPaths,
              horizontalLinePositions,
              verticalLinePositions
            }}
            editor={editor}
            musikkryss={musikkryss}
            onMusikkryssChange={setMusikkryss}
            zoomState={editorZoomState}
            setZoomState={setEditorZoomState}
            scrollState={editorScrollState}
            setScrollState={setEditorScrollState}
            documentLifecycleId={editorDocumentLifecycleId}
          />
        ) : (
        <EditorScrollWorkspace
          documentSize={documentSize}
          zoomState={editorZoomState}
          setZoomState={setEditorZoomState}
          scrollState={editorScrollState}
          setScrollState={setEditorScrollState}
          documentLifecycleId={editorDocumentLifecycleId}
        >
          <TemplateCanvas
            template={{
              crosswordId,
              crosswordType,
              ...(crosswordType === "musikkryss" ? { musikkryss } : {}),
              rows,
              cols,
              cellTypes,
              imageSrc,
              documentSize,
              gridArea,
              cropArea,
              competitionCells,
              answerPaths,
              horizontalLinePositions,
              verticalLinePositions
	            }}
	          >
	            <DigitizationSuggestionOverlay
	              digitizationResult={digitizationResult}
	              documentSize={documentSize}
	            />
	            {editor}
	          </TemplateCanvas>
        </EditorScrollWorkspace>
        )
      ) : (
        <PlaySurface
          template={{
            crosswordId,
            crosswordType,
            ...(crosswordType === "musikkryss" ? { musikkryss } : {}),
            rows,
            cols,
            cellTypes,
            imageSrc,
            documentSize,
            gridArea,
            cropArea,
            competitionCells,
            answerPaths,
            horizontalLinePositions,
            verticalLinePositions
          }}
          onSubmitAnswers={() => {}}
        />
      )}

    </div>
      )}
    </EditorWorkspace>
  );
}

function App() {
  const [crosswordType, setCrosswordType] = useState("sverigekryss");

  return (
    <EditorSessionWorkspace activeType={crosswordType}>
      {({ session, setters, updateSession }) => (
        <AppSessionApplication
          crosswordType={crosswordType}
          setCrosswordType={setCrosswordType}
          session={session}
          setters={setters}
          updateSession={updateSession}
        />
      )}
    </EditorSessionWorkspace>
  );
}

export default App;
