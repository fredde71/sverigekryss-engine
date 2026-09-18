import React, { useEffect, useMemo, useRef, useState } from "react";
import RuntimeLayer from "../runtime/RuntimeLayer";
import { buildCompetitionSolution } from "./competitionSolution";
import SubmissionDialog from "./SubmissionDialog";
import TemplateCanvas from "../template/TemplateCanvas";
import { submitCompetitionEntry } from "../template/templateApi";
import { normalizeMusikkryssContent } from "../musikkryss/MusikkryssFormat";
import MusikkryssAnswerList from "./MusikkryssAnswerList";
import { createMusikkryssRuntimeSelection } from "./musikkryssRuntimeAdapter";
import { createTemplateSolutionIndex } from "../template/templateSolutions";
import {
  applySolutionReveal,
  createSolutionRevealState,
  SOLUTION_REVEAL_ACTIONS
} from "../engine/solutionReveal";
import SolutionHelpControls from "./SolutionHelpControls";

export default function PlaySurface({
  template,
  publicationId = "",
  publicationAccess = null,
  responsive = false,
  onSubmitAnswers
}) {
  const [isSubmissionDialogOpen, setIsSubmissionDialogOpen] = useState(false);
  const [runtimeAnswers, setRuntimeAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccessMessage, setSubmitSuccessMessage] = useState("");
  const [selectedMusikkryssAnswerId, setSelectedMusikkryssAnswerId] = useState(null);
  const [activeAnswerSelection, setActiveAnswerSelection] = useState(null);
  const [solutionRevealState, setSolutionRevealState] = useState(
    createSolutionRevealState
  );
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
  const solutionIndex = useMemo(
    () => createTemplateSolutionIndex(template),
    [template]
  );
  const helpEnabled = Boolean(
    publicationAccess?.capabilities?.useCanonicalSolutions
  );
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
        revealedCellLetters={solutionRevealState.cellLetters}
        onAnswerSelectionChange={helpEnabled
          ? setActiveAnswerSelection
          : undefined}
      />
    </TemplateCanvas>
  );

  useEffect(() => {
    setSelectedMusikkryssAnswerId(null);
    setActiveAnswerSelection(null);
    setSolutionRevealState(createSolutionRevealState());
  }, [publicationId, template.crosswordId, template.crosswordType]);

  const reveal = action => {
    setSolutionRevealState(previous => applySolutionReveal({
      state: previous,
      action,
      answerCellIndexes: activeAnswerSelection?.answerCellIndexes,
      solutionIndex
    }));
  };

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

      {helpEnabled && (
        <SolutionHelpControls
          answerSelected={Boolean(activeAnswerSelection)}
          onRevealLetter={() => reveal(SOLUTION_REVEAL_ACTIONS.LETTER)}
          onRevealAnswer={() => reveal(SOLUTION_REVEAL_ACTIONS.ANSWER)}
          onRevealAll={() => reveal(SOLUTION_REVEAL_ACTIONS.ALL)}
        />
      )}

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
