import React from "react";
import RuntimeLayer from "../runtime/RuntimeLayer";
import TemplateCanvas from "../template/TemplateCanvas";

export default function PlaySurface({
  template,
  responsive = false,
  onSubmitAnswers
}) {
  return (
    <div
      data-testid="play-surface"
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "12px"
      }}
    >
      <TemplateCanvas template={template} responsive={responsive} cropped>
        <RuntimeLayer data={template} />
      </TemplateCanvas>

      <button
        type="button"
        data-testid="submit-answers-button"
        onClick={onSubmitAnswers}
        style={{
          padding: "10px 16px",
          fontSize: "16px",
          cursor: "pointer"
        }}
      >
        Skicka in svar
      </button>
    </div>
  );
}
