import React from "react";
import EditorLayer from "./EditorLayer";
import EditorViewport from "./EditorViewport";

export default function EditorWorkspace({
  rows,
  cols,
  cellTypes,
  gridArea,
  setGridArea,
  activeTool,
  setCellTypes,
  isPublicRuntime
}) {
  return (
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
}
