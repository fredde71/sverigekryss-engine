import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import EditorLayer from "./EditorLayer";
import EditorToolbar from "./EditorToolbar";
import EditorViewport from "./EditorViewport";

export default function EditorWorkspace({
  rows,
  cols,
  cellTypes,
  competitionCells = [],
  answerPaths = [],
  horizontalLinePositions = null,
  verticalLinePositions = null,
  gridArea,
  documentSize,
  cropArea,
  setRows,
  setCols,
  setGridArea,
  setCropArea,
  setCompetitionCells,
  setAnswerPaths,
  setHorizontalLinePositions,
  setVerticalLinePositions,
  setCellTypes,
  gridProposal = null,
  documentLifecycleId = 0,
  documentAvailable = true,
  isPublicRuntime,
  children
}) {
  const [activeTool, setActiveTool] = useState("image");
  const [pendingRows, setPendingRows] = useState(25);
  const [pendingCols, setPendingCols] = useState(25);
  const [cropMode, setCropMode] = useState(null);
  const [competitionMenuCellIndex, setCompetitionMenuCellIndex] = useState(null);
  const [answerPathClueIndex, setAnswerPathClueIndex] = useState(null);
  const [answerPathDirection, setAnswerPathDirection] = useState(null);
  const [answerPathDraft, setAnswerPathDraft] = useState(null);
  const previousDocumentLifecycleId = useRef(documentLifecycleId);
  const gridLineProposal = createPersistedGridLineProposal({
    horizontalLinePositions,
    verticalLinePositions,
    gridArea
  });

  const activeCompetitionCell = (
    activeTool === "competition" &&
    Number.isInteger(competitionMenuCellIndex) &&
    cellTypes[competitionMenuCellIndex] === "write"
  ) ? competitionMenuCellIndex : null;
  const activeCompetitionPosition = activeCompetitionCell === null
    ? null
    : competitionCells.find(cell => cell.index === activeCompetitionCell)
      ?.position ?? null;

  const applyGridProposal = useCallback((proposal) => {
    setRows(proposal.rows);
    setCols(proposal.cols);
    setGridArea(proposal.gridArea);
    setCellTypes(proposal.cellTypes);
    setCompetitionCells?.(proposal.competitionCells);
    setHorizontalLinePositions?.(
      Array.isArray(proposal.horizontalLinePositions)
        ? [...proposal.horizontalLinePositions]
        : null
    );
    setVerticalLinePositions?.(
      Array.isArray(proposal.verticalLinePositions)
        ? [...proposal.verticalLinePositions]
        : null
    );
    setCompetitionMenuCellIndex(null);
    setAnswerPathClueIndex(null);
    setAnswerPathDirection(null);
    setAnswerPathDraft(null);
  }, [
    setRows,
    setCols,
    setGridArea,
    setCellTypes,
    setCompetitionCells,
    setHorizontalLinePositions,
    setVerticalLinePositions
  ]);

  useLayoutEffect(() => {
    if (previousDocumentLifecycleId.current === documentLifecycleId) {
      return;
    }

    previousDocumentLifecycleId.current = documentLifecycleId;
    setRows(INITIAL_GRID_DIMENSION);
    setCols(INITIAL_GRID_DIMENSION);
    setGridArea({ ...INITIAL_GRID_AREA });
    setCellTypes(
      Array(INITIAL_GRID_DIMENSION * INITIAL_GRID_DIMENSION).fill("empty")
    );
    setCompetitionCells?.([]);
    setAnswerPaths?.([]);
    setPendingRows(INITIAL_GRID_DIMENSION);
    setPendingCols(INITIAL_GRID_DIMENSION);
    setHorizontalLinePositions?.(null);
    setVerticalLinePositions?.(null);
    setCompetitionMenuCellIndex(null);
    setAnswerPathClueIndex(null);
    setAnswerPathDirection(null);
    setAnswerPathDraft(null);
    setCropArea({ ...INITIAL_GRID_AREA });
    setCropMode(null);
    setActiveTool("image");
  }, [
    documentLifecycleId,
    setRows,
    setCols,
    setGridArea,
    setCropArea,
    setCellTypes,
    setCompetitionCells,
    setAnswerPaths,
    setHorizontalLinePositions,
    setVerticalLinePositions
  ]);

  useEffect(() => {
    if (gridProposal) {
      applyGridProposal(gridProposal);
    }
  }, [gridProposal, applyGridProposal]);

  useEffect(() => {
    setCompetitionCells?.(prev => (
      prev.filter(cell => cellTypes[cell.index] === "write")
    ));
  }, [cellTypes, setCompetitionCells]);

  const createGrid = () => {
    setRows(pendingRows);
    setCols(pendingCols);

    setCellTypes(Array(pendingRows * pendingCols).fill("empty"));
    setCompetitionCells?.([]);
    setAnswerPaths?.([]);
    setHorizontalLinePositions?.(null);
    setVerticalLinePositions?.(null);
    setCompetitionMenuCellIndex(null);
  };

  const updateGridArea = useCallback((update) => {
    const nextGridArea = typeof update === "function"
      ? update(gridArea)
      : update;

    if (gridLineProposal) {
      setHorizontalLinePositions?.(projectPersistedPositions({
        positions: horizontalLinePositions,
        previousStart: gridArea.top,
        previousSize: gridArea.height,
        nextStart: nextGridArea.top,
        nextSize: nextGridArea.height
      }));
      setVerticalLinePositions?.(projectPersistedPositions({
        positions: verticalLinePositions,
        previousStart: gridArea.left,
        previousSize: gridArea.width,
        nextStart: nextGridArea.left,
        nextSize: nextGridArea.width
      }));
    }

    setGridArea(nextGridArea);
  }, [
    gridArea,
    gridLineProposal,
    horizontalLinePositions,
    verticalLinePositions,
    setGridArea,
    setHorizontalLinePositions,
    setVerticalLinePositions
  ]);

  const openCompetitionMenu = (index) => {
    setCompetitionMenuCellIndex(index);
  };

  const assignCompetitionPosition = (position) => {
    if (activeCompetitionCell === null) return;

    setCompetitionCells(prev => {
      const next = prev.filter(cell => (
        cell.index !== activeCompetitionCell &&
        cell.position !== position
      ));

      if (!position) {
        return next.sort((a, b) => a.position - b.position);
      }

      return [
        ...next,
        {
          index: activeCompetitionCell,
          position
        }
      ].sort((a, b) => a.position - b.position);
    });

    setCompetitionMenuCellIndex(null);
  };

  const clearCompetitionCell = () => {
    if (activeCompetitionCell === null) return;

    setCompetitionCells(prev => (
      prev
        .filter(cell => cell.index !== activeCompetitionCell)
        .sort((a, b) => a.position - b.position)
    ));
    setCompetitionMenuCellIndex(null);
  };

  const selectEditorTool = (tool) => {
    setActiveTool(tool);

    if (tool !== "competition") {
      setCompetitionMenuCellIndex(null);
    }

    if (tool !== "answer-path") {
      setAnswerPathClueIndex(null);
      setAnswerPathDirection(null);
      setAnswerPathDraft(null);
    }
  };

  const selectAnswerPathCell = (index) => {
    if (answerPathDraft) {
      if (
        cellTypes[index] === "write"
        && !answerPathDraft.cellIndexes.includes(index)
      ) {
        setAnswerPathDraft(prev => ({
          ...prev,
          cellIndexes: [...prev.cellIndexes, index]
        }));
      }
      return;
    }

    if (cellTypes[index] === "blocked" || cellTypes[index] === "double") {
      setAnswerPathClueIndex(index);
      setAnswerPathDirection(null);
    }
  };

  const startAnswerPath = (direction) => {
    if (!Number.isInteger(answerPathClueIndex)) return;

    const existingCellIndexes = answerPaths
      .find(entry => entry.clueIndex === answerPathClueIndex)
      ?.paths.find(path => path.direction === direction)
      ?.cellIndexes || [];

    setAnswerPathDirection(direction);
    setAnswerPathDraft({
      clueIndex: answerPathClueIndex,
      direction,
      cellIndexes: [...existingCellIndexes]
    });
  };

  const restartAnswerPath = () => {
    if (!answerPathDraft) return;

    setAnswerPathDraft(prev => ({ ...prev, cellIndexes: [] }));
  };

  const saveAnswerPath = () => {
    if (!answerPathDraft?.cellIndexes.length) return;

    setAnswerPaths?.(prev => saveEditorAnswerPath({
      answerPaths: prev,
      clueType: cellTypes[answerPathDraft.clueIndex],
      draft: answerPathDraft
    }));
    setAnswerPathDraft(null);
  };

  const clearAnswerPath = (direction) => {
    if (!Number.isInteger(answerPathClueIndex)) return;

    setAnswerPaths?.(prev => clearEditorAnswerPath({
      answerPaths: prev,
      clueIndex: answerPathClueIndex,
      direction
    }));
    if (answerPathDraft?.direction === direction) {
      setAnswerPathDraft(prev => ({ ...prev, cellIndexes: [] }));
    }
  };

  const toolbar = (
    <EditorToolbar
      pendingRows={pendingRows}
      setPendingRows={setPendingRows}
      pendingCols={pendingCols}
      setPendingCols={setPendingCols}
      activeTool={activeTool}
      setActiveTool={selectEditorTool}
      createGrid={createGrid}
    />
  );
  const competitionMenu = activeCompetitionCell !== null && (
    <div
      data-testid="competition-cell-menu"
      aria-label={`Tävlingsposition för cell ${activeCompetitionCell + 1}`}
      style={{
        marginTop: "10px",
        padding: "8px",
        border: "2px solid rgb(180, 138, 0)",
        background: "rgb(255, 250, 224)",
        display: "grid",
        gap: "6px"
      }}
    >
      <strong>Tävlingsruta · cell {activeCompetitionCell + 1}</strong>
      <div>Välj vilken position 1–6 som cellen ska ha.</div>
      <div data-testid="competition-cell-assignment-status">
        {activeCompetitionPosition === null
          ? "Ingen position tilldelad"
          : `Nuvarande position: ${activeCompetitionPosition}`}
      </div>
      <button
        type="button"
        disabled={activeCompetitionPosition === null}
        onClick={clearCompetitionCell}
        style={{
          width: "100%",
          marginBottom: "6px"
        }}
      >
        Ta bort tilldelning
      </button>
      {[1, 2, 3, 4, 5, 6].map(position => (
        <button
          key={position}
          type="button"
          aria-pressed={activeCompetitionPosition === position}
          onClick={() => assignCompetitionPosition(position)}
          style={{
            width: "100%",
            marginBottom: "4px",
            fontWeight: activeCompetitionPosition === position ? 700 : 400
          }}
        >
          Position {position}
        </button>
      ))}
    </div>
  );
  const answerPathMenu = Number.isInteger(answerPathClueIndex) && (
    <AnswerPathMenu
      clueIndex={answerPathClueIndex}
      clueType={cellTypes[answerPathClueIndex]}
      answerPaths={answerPaths}
      draft={answerPathDraft}
      activeDirection={answerPathDirection}
      onStart={startAnswerPath}
      onSave={saveAnswerPath}
      onCancel={() => setAnswerPathDraft(null)}
      onRestart={restartAnswerPath}
      onClear={clearAnswerPath}
    />
  );

  const editor = documentAvailable ? (
    <EditorViewport
      gridArea={gridArea}
      documentSize={documentSize}
      setGridArea={updateGridArea}
      setCropArea={setCropArea}
      cropMode={cropMode}
      setCropMode={setCropMode}
      rows={rows}
      cols={cols}
      cellTypes={cellTypes}
      activeTool={activeTool}
      onCompetitionCellClick={openCompetitionMenu}
      onAnswerPathCellClick={selectAnswerPathCell}
      setCellTypes={setCellTypes}
    >
      {({ startGridResize, handleGridClick }) => (
        <>
          <EditorLayer
            rows={rows}
            cols={cols}
            cellTypes={cellTypes}
            competitionCells={competitionCells}
            startGridResize={startGridResize}
            handleGridClick={handleGridClick}
            isPublicRuntime={isPublicRuntime}
            activeTool={activeTool}
            documentSize={documentSize}
            gridArea={gridArea}
            gridLineProposal={gridLineProposal}
            answerPathSelection={createAnswerPathSelection({
              clueIndex: answerPathClueIndex,
              direction: answerPathDirection,
              answerPaths,
              draft: answerPathDraft
            })}
            cropArea={cropArea}
            setCropMode={setCropMode}
          />
        </>
      )}
    </EditorViewport>
  ) : null;

  if (typeof children === "function") {
    return children({
      toolbar,
      competitionMenu,
      answerPathMenu,
      editor,
      applyGridProposal,
      cropArea,
      setCropArea
    });
  }

  return editor;
}

function AnswerPathMenu({
  clueIndex,
  clueType,
  answerPaths,
  draft,
  activeDirection,
  onStart,
  onSave,
  onCancel,
  onRestart,
  onClear
}) {
  const entry = answerPaths.find(candidate => candidate.clueIndex === clueIndex);

  return (
    <div data-testid="answer-path-menu" style={editorMenuStyle}>
      <strong>Svarsvägar · cell {clueIndex}</strong>
      <div>Välj den svarsväg som ska redigeras.</div>
      {(["across", "down"]).map((direction, index) => {
        const existing = entry?.paths.find(path => path.direction === direction);
        const disabled = clueType === "blocked"
          && entry?.paths.length > 0
          && !existing;
        const label = direction === "across" ? "vågrät" : "lodrät";
        const slotNumber = index + 1;
        const actionLabel = clueType === "double"
          ? `${existing ? "Redigera" : "Skapa"} svarsväg ${slotNumber} (${label})`
          : `Välj ${label} svarsväg`;

        return (
          <div
            key={direction}
            data-testid={clueType === "double"
              ? `answer-path-slot-${slotNumber}`
              : undefined}
            style={{ display: "grid", gap: "4px" }}
          >
            {clueType === "double" && (
              <span>
                Svarsväg {slotNumber}: {existing ? "sparad" : "inte skapad"}
              </span>
            )}
            <button
              type="button"
              disabled={disabled}
              aria-pressed={activeDirection === direction}
              onClick={() => onStart(direction)}
              style={activeDirection === direction
                ? activeAnswerPathButtonStyle
                : undefined}
            >
              {actionLabel}
            </button>
            {existing && (
              <button type="button" onClick={() => onClear(direction)}>
                Rensa {label} svarsväg
              </button>
            )}
          </div>
        );
      })}
      {draft && (
        <>
          <strong data-testid="active-answer-path-status">
            Aktiv svarsväg: {draft.direction === "across" ? "vågrät" : "lodrät"}
          </strong>
          <div data-testid="answer-path-draft-status">
            Valda svarsceller: {draft.cellIndexes.length}
          </div>
          <button type="button" onClick={onRestart}>
            Börja om med aktiv svarsväg
          </button>
          <button
            type="button"
            disabled={draft.cellIndexes.length === 0}
            onClick={onSave}
          >
            Spara svarsväg
          </button>
          <button type="button" onClick={onCancel}>Avbryt</button>
        </>
      )}
    </div>
  );
}

function saveEditorAnswerPath({ answerPaths, clueType, draft }) {
  const otherEntries = answerPaths.filter(entry => entry.clueIndex !== draft.clueIndex);
  const currentEntry = answerPaths.find(entry => entry.clueIndex === draft.clueIndex);
  const retainedPaths = clueType === "double"
    ? (currentEntry?.paths || []).filter(path => path.direction !== draft.direction)
    : [];

  return [
    ...otherEntries,
    {
      clueIndex: draft.clueIndex,
      paths: [
        ...retainedPaths,
        {
          direction: draft.direction,
          cellIndexes: [...draft.cellIndexes]
        }
      ].sort(compareAnswerPathDirections)
    }
  ].sort((a, b) => a.clueIndex - b.clueIndex);
}

function clearEditorAnswerPath({ answerPaths, clueIndex, direction }) {
  return answerPaths.flatMap(entry => {
    if (entry.clueIndex !== clueIndex) return [entry];

    const paths = entry.paths.filter(path => path.direction !== direction);
    return paths.length > 0 ? [{ ...entry, paths }] : [];
  });
}

function createAnswerPathSelection({ clueIndex, direction, answerPaths, draft }) {
  if (!Number.isInteger(clueIndex)) return null;

  if (draft) {
    return {
      clueIndex,
      direction: draft.direction,
      cellIndexes: draft.cellIndexes
    };
  }

  const selectedPath = answerPaths
    .find(entry => entry.clueIndex === clueIndex)
    ?.paths.find(path => path.direction === direction);

  return selectedPath
    ? { clueIndex, ...selectedPath }
    : { clueIndex, direction: null, cellIndexes: [] };
}

function compareAnswerPathDirections(left, right) {
  return (left.direction === "across" ? 0 : 1)
    - (right.direction === "across" ? 0 : 1);
}

const editorMenuStyle = {
  display: "grid",
  gap: "8px",
  marginTop: "10px",
  padding: "8px",
  border: "1px solid #d6d6d6",
  background: "#fff"
};

const activeAnswerPathButtonStyle = {
  border: "2px solid rgb(126, 34, 206)",
  background: "rgba(147, 51, 234, 0.14)",
  fontWeight: 700
};

const INITIAL_GRID_DIMENSION = 25;
const INITIAL_GRID_AREA = Object.freeze({
  top: 0,
  left: 0,
  width: 1200,
  height: 1200
});

function createPersistedGridLineProposal({
  horizontalLinePositions,
  verticalLinePositions,
  gridArea
}) {
  if (
    !Array.isArray(horizontalLinePositions)
    || !Array.isArray(verticalLinePositions)
  ) {
    return null;
  }

  return {
    horizontalLinePositions,
    verticalLinePositions,
    referenceGridArea: gridArea,
    coordinateSpace: "document"
  };
}

function projectPersistedPositions({
  positions,
  previousStart,
  previousSize,
  nextStart,
  nextSize
}) {
  const scale = nextSize / previousSize;
  return positions.map(position => (
    nextStart + (position - previousStart) * scale
  ));
}
