import React from "react";

export default function EditorScrollWorkspace({ children }) {
  return (
    <div
      data-testid="editor-scroll-workspace"
      style={{
        width: "100%",
        maxWidth: "100%",
        maxHeight: "calc(100vh - 40px)",
        overflow: "auto",
        position: "relative",
        border: "1px solid #ddd",
        boxSizing: "border-box"
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
