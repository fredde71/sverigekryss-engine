import React from "react";

export default function TemplateCanvas({
  template,
  children
}) {
  return (
    <div
      style={{
        position: "relative",
        width: "1200px",
        height: "1200px",
        margin: "0 auto"
      }}
    >
      <img
        src={template.imageSrc}
        alt="grid"
        style={{
          width: "1200px",
          display: "block"
        }}
      />

      {children}
    </div>
  );
}
