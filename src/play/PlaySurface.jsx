import React, { useRef, useState } from "react";
import RuntimeLayer from "../runtime/RuntimeLayer";
import { buildCompetitionSolution } from "./competitionSolution";
import SubmissionDialog from "./SubmissionDialog";
import TemplateCanvas from "../template/TemplateCanvas";
import { submitCompetitionEntry } from "../template/templateApi";

export default function PlaySurface({
  template,
  responsive = false,
  onSubmitAnswers
}) {
  const [isSubmissionDialogOpen, setIsSubmissionDialogOpen] = useState(false);
  const [runtimeAnswers, setRuntimeAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccessMessage, setSubmitSuccessMessage] = useState("");
  const isSubmittingRef = useRef(false);
  const initialSolution = buildCompetitionSolution({
    template,
    answers: runtimeAnswers
  });

  const openSubmissionDialog = () => {
    setSubmitError("");
    setSubmitSuccessMessage("");
    setIsSubmissionDialogOpen(true);
  };

  const closeSubmissionDialog = () => {
    setIsSubmissionDialogOpen(false);
    setIsSubmitting(false);
    isSubmittingRef.current = false;
    setSubmitError("");
    setSubmitSuccessMessage("");
  };

  const handleSubmitAnswers = async (submission) => {
    if (isSubmittingRef.current || submitSuccessMessage) return;

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError("");

    try {
      await submitCompetitionEntry({
        templateId: template.crosswordId,
        ...submission
      });

      setSubmitSuccessMessage("Ditt tävlingsbidrag har skickats in.");
      onSubmitAnswers?.(submission);
    } catch (err) {
      setSubmitError(err.message || "Det gick inte att skicka tävlingsbidraget.");
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

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
        <RuntimeLayer
          data={template}
          onAnswersChange={setRuntimeAnswers}
        />
      </TemplateCanvas>

      <button
        type="button"
        data-testid="submit-answers-button"
        onClick={openSubmissionDialog}
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
          initialSolution={initialSolution}
          isSubmitting={isSubmitting}
          errorMessage={submitError}
          successMessage={submitSuccessMessage}
          onClose={closeSubmissionDialog}
          onSubmit={handleSubmitAnswers}
        />
      )}
    </div>
  );
}
