import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import MusikkryssWeeklyContentImportContainer from "./MusikkryssWeeklyContentImportContainer";
import { createMusikkryssReferenceContent } from "../musikkryss/MusikkryssReferenceContentPack";
import { MUSIKKRYSS_FIXED_FORMAT } from "../musikkryss/MusikkryssFormat";

test("previews and approves a parsed object for an arbitrary registered format", () => {
  const onApprove = jest.fn();
  const formatId = "future-compact-format";
  const formatCatalog = {
    defaultFormatId: formatId,
    formats: [{
      id: formatId,
      answerDefinitions: [{
        number: 42,
        direction: "across",
        answerPath: [0, 1]
      }],
      cellTopology: ["writable", "writable"]
    }]
  };
  const candidate = createCandidate({
    formatId,
    answers: [{
      number: 42,
      direction: "across",
      contentSequence: [{ type: "text", text: "Framtida fråga" }],
      solution: "AB"
    }]
  });

  render(
    <MusikkryssWeeklyContentImportContainer
      candidate={candidate}
      formatCatalog={formatCatalog}
      onApprove={onApprove}
    />
  );

  expect(screen.getByTestId("weekly-issue-crosswordId"))
    .toHaveTextContent("MUSIK-2026-38");
  expect(screen.getByText("Framtida fråga")).toBeInTheDocument();
  expect(screen.getByText("Lösning: AB")).toBeInTheDocument();
  expect(screen.getByTestId("weekly-answer-counts"))
    .toHaveTextContent("Förväntade svar: 1. Importerade svar: 1.");
  expect(screen.getByRole("button", { name: "Använd veckans innehåll" }))
    .toBeEnabled();
  expect(onApprove).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", {
    name: "Använd veckans innehåll"
  }));
  expect(onApprove).toHaveBeenCalledWith(expect.objectContaining({
    status: "valid",
    formatId
  }));
});

test("shows invalid diagnostics and cannot approve or mutate external state", () => {
  const reference = createMusikkryssReferenceContent();
  const candidate = createCandidate({
    formatId: MUSIKKRYSS_FIXED_FORMAT.id,
    answers: reference.answers.slice(0, -1).map(answer => ({
      number: answer.number,
      direction: answer.direction,
      contentSequence: answer.contentSequence.map(entry => ({ ...entry })),
      solution: answer.solution
    }))
  });
  candidate.answers[0].contentSequence[0].text = "";
  const before = JSON.parse(JSON.stringify(candidate));
  const onApprove = jest.fn();

  render(
    <MusikkryssWeeklyContentImportContainer
      candidate={candidate}
      onApprove={onApprove}
    />
  );

  expect(screen.getByText(/empty-script/)).toBeInTheDocument();
  expect(screen.getByText(/missing-answer/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Använd veckans innehåll" }))
    .toBeDisabled();
  fireEvent.click(screen.getByRole("button", {
    name: "Använd veckans innehåll"
  }));
  expect(onApprove).not.toHaveBeenCalled();
  expect(candidate).toEqual(before);
});

test("requires an explicit approval even for valid content", () => {
  const reference = createMusikkryssReferenceContent();
  const onApprove = jest.fn();
  const candidate = createCandidate({
    formatId: MUSIKKRYSS_FIXED_FORMAT.id,
    answers: reference.answers.map(answer => ({
      number: answer.number,
      direction: answer.direction,
      contentSequence: answer.contentSequence.map(entry => ({ ...entry })),
      solution: answer.solution
    }))
  });

  render(
    <MusikkryssWeeklyContentImportContainer
      candidate={candidate}
      onApprove={onApprove}
    />
  );

  expect(onApprove).not.toHaveBeenCalled();
});

function createCandidate({ formatId, answers }) {
  return {
    type: "musikkryss-weekly-content",
    version: 1,
    formatId,
    issue: {
      crosswordId: "MUSIK-2026-38",
      title: "Vecka 38",
      issueNumber: "38",
      publishWeek: "2026-W38",
      publishDate: "2026-09-19",
      producerReference: "PRODUCER-38"
    },
    introScript: "Veckans intro",
    answers
  };
}
