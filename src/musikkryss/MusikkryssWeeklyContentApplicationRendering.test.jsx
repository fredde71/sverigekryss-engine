import React from "react";
import { render, screen } from "@testing-library/react";
import PlaySurface from "../play/PlaySurface";
import {
  applyMusikkryssWeeklyContentImport
} from "./MusikkryssWeeklyContentApplication";
import {
  importMusikkryssWeeklyContent
} from "./MusikkryssWeeklyContentImport";
import {
  createMusikkryssReferenceContent
} from "./MusikkryssReferenceContentPack";
import { MUSIKKRYSS_FIXED_FORMAT } from "./MusikkryssFormat";
import { createMusikkryssTemplate } from "./MusikkryssTemplateInitializer";
import { createTemplate } from "../template/templateModel";

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    disconnect() {}
  };
});

afterAll(() => {
  delete global.ResizeObserver;
});

test("a blank-session weekly import immediately produces a renderable Play grid", () => {
  const reference = createMusikkryssReferenceContent();
  const importResult = importMusikkryssWeeklyContent({
    type: "musikkryss-weekly-content",
    version: 1,
    formatId: MUSIKKRYSS_FIXED_FORMAT.id,
    issue: {
      crosswordId: "MUSIK-PLAYABLE-1",
      title: "Playable",
      issueNumber: "1",
      publishWeek: "2026-W38",
      publishDate: "2026-09-19",
      producerReference: "PLAYABLE-1"
    },
    introScript: reference.introScript,
    answers: reference.answers.map(answer => ({
      number: answer.number,
      direction: answer.direction,
      contentSequence: answer.contentSequence.map(entry => ({ ...entry })),
      solution: answer.solution
    }))
  });
  const blankTemplate = createMusikkryssTemplate();
  const blankSession = {
    ...blankTemplate,
    rows: 25,
    cols: 25,
    cellTypes: Array(625).fill("empty"),
    horizontalLinePositions: null,
    verticalLinePositions: null
  };
  const application = applyMusikkryssWeeklyContentImport({
    session: blankSession,
    importResult
  });

  render(<PlaySurface template={createTemplate(application.session)} />);

  expect(screen.getByTestId("musikkryss-play-crossword")).toBeInTheDocument();
  expect(screen.getByTestId("runtime-grid-explicit")).toBeInTheDocument();
  expect(screen.getAllByTestId("runtime-black-cell")).toHaveLength(31);
  expect(screen.getAllByRole("textbox")).toHaveLength(59);
  expect(screen.getAllByRole("textbox")[0].parentElement).toHaveStyle({
    border: "1px solid rgb(0, 0, 0)",
    boxSizing: "border-box"
  });
  expect(screen.getByRole("button", { name: "1 vågrätt" }))
    .toBeInTheDocument();
  expect(screen.getByRole("button", { name: "1 lodrätt" }))
    .toBeInTheDocument();
});
