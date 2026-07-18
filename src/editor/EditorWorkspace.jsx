import React, { useState } from "react";
import EditorLayer from "./EditorLayer";
import EditorToolbar from "./EditorToolbar";
import EditorViewport from "./EditorViewport";

export default function EditorWorkspace({
  rows,
  cols,
  cellTypes,
  gridArea,
  cropArea,
  setRows,
  setCols,
  setGridArea,
  setCropArea,
  setCellTypes,
  isPublicRuntime,
  children
}) {
  const [activeTool, setActiveTool] = useState("image");
  const [pendingRows, setPendingRows] = useState(25);
  const [pendingCols, setPendingCols] = useState(25);
  const [cropMode, setCropMode] = useState(null);

  const createGrid = () => {
    setRows(pendingRows);
    setCols(pendingCols);

    setCellTypes(Array(pendingRows * pendingCols).fill("empty"));
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

  const editor = (
    <EditorViewport
      gridArea={gridArea}
      setGridArea={setGridArea}
      setCropArea={setCropArea}
      cropMode={cropMode}
      setCropMode={setCropMode}
      rows={rows}
      cols={cols}
      activeTool={activeTool}
      setCellTypes={setCellTypes}
    >
      {({ setMode, handleGridClick }) => (
        <>
          <EditorLayer
            rows={rows}
            cols={cols}
            cellTypes={cellTypes}
            setMode={setMode}
            handleGridClick={handleGridClick}
            isPublicRuntime={isPublicRuntime}
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
      editor,
      cropArea,
      setCropArea
    });
  }

  return editor;
}
