import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import MusikkryssWeeklyContentImportContainer from "./MusikkryssWeeklyContentImportContainer";
import { createMusikkryssReferenceContent } from "../musikkryss/MusikkryssReferenceContentPack";
import { MUSIKKRYSS_FIXED_FORMAT } from "../musikkryss/MusikkryssFormat";
import {
  parseMusikkryssWeeklyContentExcelFile
} from "../musikkryss/adapters/MusikkryssWeeklyContentExcelAdapter";

jest.mock("../musikkryss/adapters/MusikkryssWeeklyContentExcelAdapter", () => ({
  parseMusikkryssWeeklyContentExcelFile: jest.fn()
}));

test("sends a parsed Excel candidate through preview before explicit approval", async () => {
  const candidate = createCandidate();
  parseMusikkryssWeeklyContentExcelFile.mockResolvedValue({
    status: "parsed",
    weeklyContent: candidate,
    diagnostics: { status: "valid", entries: [] }
  });
  const onApprove = jest.fn();

  render(
    <MusikkryssWeeklyContentImportContainer
      formatId={MUSIKKRYSS_FIXED_FORMAT.id}
      onApprove={onApprove}
    />
  );

  const file = { name: "vecka-38.xlsx", arrayBuffer: jest.fn() };
  fireEvent.change(screen.getByLabelText("Importera veckans innehåll"), {
    target: { files: [file] }
  });

  await waitFor(() => {
    expect(screen.getByText("Importförhandsvisning")).toBeInTheDocument();
  });
  expect(parseMusikkryssWeeklyContentExcelFile).toHaveBeenCalledWith({
    file,
    formatId: MUSIKKRYSS_FIXED_FORMAT.id
  });
  expect(onApprove).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", {
    name: "Använd veckans innehåll"
  }));
  expect(onApprove).toHaveBeenCalledWith(expect.objectContaining({
    status: "valid"
  }));
});

test("shows Excel parse diagnostics without creating an approvable preview", async () => {
  parseMusikkryssWeeklyContentExcelFile.mockResolvedValue({
    status: "invalid",
    weeklyContent: null,
    diagnostics: {
      status: "invalid",
      entries: [{
        code: "missing-column",
        sheet: "Frågor",
        column: "solution"
      }]
    }
  });

  render(
    <MusikkryssWeeklyContentImportContainer
      formatId={MUSIKKRYSS_FIXED_FORMAT.id}
      onApprove={jest.fn()}
    />
  );
  fireEvent.change(screen.getByLabelText("Importera veckans innehåll"), {
    target: { files: [{ name: "invalid.xlsx", arrayBuffer: jest.fn() }] }
  });

  expect(await screen.findByLabelText("Excel-importdiagnostik"))
    .toHaveTextContent("missing-column · Frågor · solution");
  expect(screen.queryByRole("button", { name: "Använd veckans innehåll" }))
    .not.toBeInTheDocument();
});

function createCandidate() {
  const reference = createMusikkryssReferenceContent();
  return {
    type: "musikkryss-weekly-content",
    version: 1,
    formatId: MUSIKKRYSS_FIXED_FORMAT.id,
    issue: {
      crosswordId: "MUSIK-2026-38",
      title: "Vecka 38",
      issueNumber: "38",
      publishWeek: "2026-W38",
      publishDate: "2026-09-19",
      producerReference: "PRODUCER-38"
    },
    introScript: reference.introScript,
    answers: reference.answers.map(answer => ({
      number: answer.number,
      direction: answer.direction,
      contentSequence: answer.contentSequence.map(entry => ({ ...entry })),
      solution: answer.solution
    }))
  };
}
