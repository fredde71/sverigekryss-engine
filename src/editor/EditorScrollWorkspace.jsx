import React from "react";

export default function EditorScrollWorkspace({ children }) {
  return (
    <div
      data-testid="editor-scroll-workspace"
      style={{
        maxWidth: "calc(100vw - 220px)",
        maxHeight: "calc(100vh - 40px)",
        overflow: "auto",
        position: "relative",
        border: "1px solid #ddd"
      }}
    >
      <div
        data-testid="editor-scroll-source-frame"
        style={{
          position: "relative",
          width: "1200px",
          height: "1200px"
        }}
      >
        {children}
      </div>
    </div>
  );
}
