import React from "react";

export default function EditorViewport({
  gridArea,
  children
}) {
  return (
    <div
      onClick={gridArea.onGridClick}
      style={{
        position: "absolute",
        top: gridArea.top,
        left: gridArea.left,
        width: gridArea.width,
        height: gridArea.height
      }}
    >
      {children}
    </div>
  );
}