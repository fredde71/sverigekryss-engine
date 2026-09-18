import ExcelJS from "exceljs";
import {
  parseMusikkryssWeeklyContentExcel
} from "./MusikkryssWeeklyContentExcelAdapter";

test("maps the documented workbook layout into the weekly-content contract", async () => {
  const arrayBuffer = await createWorkbook();

  const result = await parseMusikkryssWeeklyContentExcel({
    arrayBuffer,
    formatId: "future-registered-format"
  });

  expect(result).toMatchObject({
    type: "musikkryss-weekly-content-excel-adapter-result",
    version: 1,
    status: "parsed",
    diagnostics: { status: "valid", entries: [] },
    weeklyContent: {
      type: "musikkryss-weekly-content",
      version: 1,
      formatId: "future-registered-format",
      issue: {
        crosswordId: "MUSIK-2026-38",
        title: "Vecka 38",
        issueNumber: "38",
        publishWeek: "2026-W38",
        publishDate: "2026-09-19",
        producerReference: "PRODUCER-38"
      },
      introScript: "Veckans intro",
      answers: [{
        number: 1,
        direction: "across",
        contentSequence: [{ type: "text", text: "Vågrät fråga" }],
        solution: "SVAR"
      }, {
        number: 1,
        direction: "down",
        contentSequence: [{ type: "text", text: "Lodrät fråga" }],
        solution: "TEST"
      }]
    }
  });
  expect(Object.isFrozen(result)).toBe(true);
});

test("reports missing required sheets", async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Utgåva");

  const result = await parseMusikkryssWeeklyContentExcel({
    arrayBuffer: await workbook.xlsx.writeBuffer(),
    formatId: "format"
  });

  expectInvalidWith(result, "missing-sheet");
  expect(result.diagnostics.entries).toContainEqual(expect.objectContaining({
    sheet: "Frågor"
  }));
});

test("reports missing required columns", async () => {
  const arrayBuffer = await createWorkbook({
    answerHeaders: ["number", "direction", "script"]
  });

  const result = await parseMusikkryssWeeklyContentExcel({
    arrayBuffer,
    formatId: "format"
  });

  expectInvalidWith(result, "missing-column");
  expect(result.diagnostics.entries).toContainEqual(expect.objectContaining({
    sheet: "Frågor",
    column: "solution"
  }));
});

test("reports malformed answer rows and invalid Swedish direction", async () => {
  const arrayBuffer = await createWorkbook({
    answerRows: [["ett", "Diagonalt", "Fråga", "SVAR"]]
  });

  const result = await parseMusikkryssWeeklyContentExcel({
    arrayBuffer,
    formatId: "format"
  });

  expectInvalidWith(result, "malformed-row");
  expectInvalidWith(result, "invalid-direction");
  expect(result.diagnostics.entries).toEqual(expect.arrayContaining([
    expect.objectContaining({ sheet: "Frågor", row: 2 })
  ]));
});

test("reports empty required issue and answer values", async () => {
  const arrayBuffer = await createWorkbook({
    issueValues: [
      "MUSIK-2026-38", "", "38", "2026-W38", "2026-09-19",
      "PRODUCER-38", "Veckans intro"
    ],
    answerRows: [[1, "Vågrätt", "", "SVAR"]]
  });

  const result = await parseMusikkryssWeeklyContentExcel({
    arrayBuffer,
    formatId: "format"
  });

  expectInvalidWith(result, "empty-required-value");
  expect(result.diagnostics.entries).toEqual(expect.arrayContaining([
    expect.objectContaining({ sheet: "Utgåva", column: "title" }),
    expect.objectContaining({ sheet: "Frågor", column: "script" })
  ]));
});

async function createWorkbook({
  issueHeaders = [
    "crosswordId", "title", "issueNumber", "publishWeek", "publishDate",
    "producerReference", "introScript"
  ],
  issueValues = [
    "MUSIK-2026-38", "Vecka 38", 38, "2026-W38", "2026-09-19",
    "PRODUCER-38", "Veckans intro"
  ],
  answerHeaders = ["number", "direction", "script", "solution"],
  answerRows = [
    [1, "Vågrätt", "Vågrät fråga", "SVAR"],
    [1, "Lodrätt", "Lodrät fråga", "TEST"]
  ]
} = {}) {
  const workbook = new ExcelJS.Workbook();
  const issueSheet = workbook.addWorksheet("Utgåva");
  issueSheet.addRow(issueHeaders);
  issueSheet.addRow(issueValues);
  const answersSheet = workbook.addWorksheet("Frågor");
  answersSheet.addRow(answerHeaders);
  answerRows.forEach(row => answersSheet.addRow(row));
  return workbook.xlsx.writeBuffer();
}

function expectInvalidWith(result, code) {
  expect(result.status).toBe("invalid");
  expect(result.weeklyContent).toBeNull();
  expect(result.diagnostics.entries.map(entry => entry.code)).toContain(code);
}
