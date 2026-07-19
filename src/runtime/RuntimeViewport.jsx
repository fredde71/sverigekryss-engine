import React from "react";

export default function RuntimeViewport({
  gridArea,
  children
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: gridArea.top,
        left: gridArea.left,
        width: gridArea.width,
        height: gridArea.height,
        overflow: "hidden"
      }}
    >
      {children}
    </div>
  );
}