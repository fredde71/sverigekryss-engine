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
  const [selectedCellIndex, setSelectedCellIndex] = useState(null);

  const selectedCompetitionCell = (
    Number.isInteger(selectedCellIndex) &&
    cellTypes[selectedCellIndex] === "write"
  ) ? selectedCellIndex : null;
  const selectedCompetitionPosition = competitionCells.find(
    cell => cell.index === selectedCompetitionCell
  )?.position || "";

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
    setSelectedCellIndex(null);
  };

  const setSelectedCellCompetitionPosition = (position) => {
    if (selectedCompetitionCell === null) return;

    setCompetitionCells(prev => {
      const next = prev.filter(cell => (
        cell.index !== selectedCompetitionCell &&
        cell.position !== position
      ));

      if (!position) {
        return next.sort((a, b) => a.position - b.position);
      }

      return [
        ...next,
        {
          index: selectedCompetitionCell,
          position
        }
      ].sort((a, b) => a.position - b.position);
    });
  };

  const toolbar = (
    <EditorToolbar
      pendingRows={pendingRows}
      setPendingRows={setPendingRows}
      pendingCols={pendingCols}
      setPendingCols={setPendingCols}
      setActiveTool={setActiveTool}
      createGrid={createGrid}
    />
  );
  const competitionControl = selectedCompetitionCell !== null && (
    <div
      data-testid="competition-cell-control"
      style={{
        marginTop: "10px"
      }}
    >
      <div>Tävlingsruta</div>
      <select
        aria-label="Tävlingsruta"
        value={selectedCompetitionPosition}
        onChange={(event) => {
          setSelectedCellCompetitionPosition(
            event.target.value ? Number(event.target.value) : ""
          );
        }}
        style={{
          width: "100%"
        }}
      >
        <option value="">None</option>
        <option value="1">Position 1</option>
        <option value="2">Position 2</option>
        <option value="3">Position 3</option>
        <option value="4">Position 4</option>
        <option value="5">Position 5</option>
        <option value="6">Position 6</option>
      </select>
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
      onCellSelect={setSelectedCellIndex}
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
      competitionControl,
      editor,
      cropArea,
      setCropArea
    });
  }

  return editor;
}
