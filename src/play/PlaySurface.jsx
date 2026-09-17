import React, { useEffect, useMemo, useRef, useState } from "react";
import RuntimeLayer from "../runtime/RuntimeLayer";
import { buildCompetitionSolution } from "./competitionSolution";
import SubmissionDialog from "./SubmissionDialog";
import TemplateCanvas from "../template/TemplateCanvas";
import { submitCompetitionEntry } from "../template/templateApi";
import { normalizeMusikkryssContent } from "../musikkryss/MusikkryssFormat";
import MusikkryssAnswerList from "./MusikkryssAnswerList";
import { createMusikkryssRuntimeSelection } from "./musikkryssRuntimeAdapter";

export default function PlaySurface({
  template,
  publicationId = "",
  responsive = false,
  onSubmitAnswers
}) {
  const [isSubmissionDialogOpen, setIsSubmissionDialogOpen] = useState(false);
  const [runtimeAnswers, setRuntimeAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccessMessage, setSubmitSuccessMessage] = useState("");
  const [selectedMusikkryssAnswerId, setSelectedMusikkryssAnswerId] = useState(null);
  const isSubmittingRef = useRef(false);
  const musikkryssContent = useMemo(() => (
    template.crosswordType === "musikkryss"
      ? normalizeMusikkryssContent(template.musikkryss)
      : null
  ), [template.crosswordType, template.musikkryss]);
  const selectedMusikkryssAnswer = musikkryssContent?.answers.find(answer => (
    `${answer.number}:${answer.direction}` === selectedMusikkryssAnswerId
  )) || null;
  const musikkryssRuntimeSelection = useMemo(() => (
    createMusikkryssRuntimeSelection(selectedMusikkryssAnswer)
  ), [selectedMusikkryssAnswer]);
  const initialSolution = buildCompetitionSolution({
    template,
    answers: runtimeAnswers
  });
  const runtimeCanvas = (
    <TemplateCanvas
      template={template}
      responsive={responsive || Boolean(musikkryssContent)}
      cropped
    >
      <RuntimeLayer
        data={template}
        onAnswersChange={setRuntimeAnswers}
        externalAnswerSelection={musikkryssRuntimeSelection}
        presentation={musikkryssContent ? "musikkryss" : "default"}
      />
    </TemplateCanvas>
  );

  useEffect(() => {
    setSelectedMusikkryssAnswerId(null);
  }, [template.crosswordId, template.crosswordType]);

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
        ...(publicationId ? { publicationId } : { templateId: template.crosswordId }),
        crosswordId: template.crosswordId,
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
      {musikkryssContent ? (
        <div
          data-testid="musikkryss-play-layout"
          style={{
            width: "100%",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "center",
            gap: "18px"
          }}
        >
          <MusikkryssAnswerList
            answers={musikkryssContent.answers}
            selectedAnswerId={selectedMusikkryssAnswerId}
            onSelectAnswer={setSelectedMusikkryssAnswerId}
          />
          <div
            data-testid="musikkryss-play-crossword"
            style={{
              flex: "0 0 650px",
              width: "100%",
              maxWidth: "650px",
              minWidth: 0
            }}
          >
            {runtimeCanvas}
          </div>
        </div>
      ) : runtimeCanvas}

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
