import React, { useState } from "react";
import RuntimeLayer from "../runtime/RuntimeLayer";
import SubmissionDialog from "./SubmissionDialog";
import TemplateCanvas from "../template/TemplateCanvas";

export default function PlaySurface({
  template,
  responsive = false,
  onSubmitAnswers
}) {
  const [isSubmissionDialogOpen, setIsSubmissionDialogOpen] = useState(false);

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
        onClick={() => setIsSubmissionDialogOpen(true)}
        style={{
          padding: "10px 16px",
          fontSize: "16px",
          cursor: "pointer"
        }}
      >
        Skicka in svar
      </button>

      {isSubmissionDialogOpen && (
        <SubmissionDialog
          onClose={() => setIsSubmissionDialogOpen(false)}
          onSubmit={onSubmitAnswers}
        />
      )}
    </div>
  );
}
