import React, { useState } from "react";
import EditorLayer from "./EditorLayer";
import EditorToolbar from "./EditorToolbar";
import EditorViewport from "./EditorViewport";

export default function EditorWorkspace({
  rows,
  cols,
  cellTypes,
  gridArea,
  setRows,
  setCols,
  setGridArea,
  setCellTypes,
  isPublicRuntime,
  children
}) {
  const [activeTool, setActiveTool] = useState("image");
  const [pendingRows, setPendingRows] = useState(25);
  const [pendingCols, setPendingCols] = useState(25);

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
      rows={rows}
      cols={cols}
      activeTool={activeTool}
      setCellTypes={setCellTypes}
    >
      {({ setMode }) => (
        <>
          <EditorLayer
            rows={rows}
            cols={cols}
            cellTypes={cellTypes}
            setMode={setMode}
            isPublicRuntime={isPublicRuntime}
            gridArea={gridArea}
          />
        </>
      )}
    </EditorViewport>
  );

  if (typeof children === "function") {
    return children({
      toolbar,
      editor
    });
  }

  return editor;
}
