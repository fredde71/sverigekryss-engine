import React, { useEffect, useState } from "react";
import EditorLayer from "./EditorLayer";
import EditorToolbar from "./EditorToolbar";
import EditorViewport from "./EditorViewport";

export default function EditorWorkspace({
  rows,
  cols,
  cellTypes,
  competitionCells = [],
  gridArea,
  documentSize,
  cropArea,
  setRows,
  setCols,
  setGridArea,
  setCropArea,
  setCompetitionCells,
  setCellTypes,
  isPublicRuntime,
  children
}) {
  const [activeTool, setActiveTool] = useState("image");
  const [pendingRows, setPendingRows] = useState(25);
  const [pendingCols, setPendingCols] = useState(25);
  const [cropMode, setCropMode] = useState(null);
  const [competitionMenuCellIndex, setCompetitionMenuCellIndex] = useState(null);

  const activeCompetitionCell = (
    activeTool === "competition" &&
    Number.isInteger(competitionMenuCellIndex) &&
    cellTypes[competitionMenuCellIndex] === "write"
  ) ? competitionMenuCellIndex : null;

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
    setCompetitionMenuCellIndex(null);
  };

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
      style={{
        marginTop: "10px",
        padding: "8px",
        border: "1px solid #d6d6d6",
        background: "#fff"
      }}
    >
      <div>Tävlingsruta</div>
      <button
        type="button"
        onClick={clearCompetitionCell}
        style={{
          width: "100%",
          marginBottom: "6px"
        }}
      >
        Ta bort
      </button>
      {[1, 2, 3, 4, 5, 6].map(position => (
        <button
          key={position}
          type="button"
          onClick={() => assignCompetitionPosition(position)}
          style={{
            width: "100%",
            marginBottom: "4px"
          }}
        >
          Position {position}
        </button>
      ))}
    </div>
  );

  const editor = (
    <EditorViewport
      gridArea={gridArea}
      documentSize={documentSize}
      setGridArea={setGridArea}
      setCropArea={setCropArea}
      cropMode={cropMode}
      setCropMode={setCropMode}
      rows={rows}
      cols={cols}
      cellTypes={cellTypes}
      activeTool={activeTool}
      onCompetitionCellClick={openCompetitionMenu}
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
            cropArea={cropArea}
            setCropMode={setCropMode}
          />
        </>
      )}
    </EditorViewport>
  );

  if (typeof children === "function") {
    return children({
      toolbar,
      competitionMenu,
      editor,
      cropArea,
      setCropArea
    });
  }

  return editor;
}
