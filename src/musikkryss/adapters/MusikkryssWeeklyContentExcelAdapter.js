import ExcelJS from "exceljs";

const ISSUE_SHEET = "Utgåva";
const ANSWERS_SHEET = "Frågor";
const ISSUE_COLUMNS = Object.freeze([
  "crosswordId",
  "title",
  "issueNumber",
  "publishWeek",
  "publishDate",
  "producerReference",
  "introScript"
]);
const ANSWER_COLUMNS = Object.freeze([
  "number",
  "direction",
  "script",
  "solution"
]);

export async function parseMusikkryssWeeklyContentExcelFile({
  file,
  formatId
}) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    return parseMusikkryssWeeklyContentExcel({ arrayBuffer, formatId });
  } catch (error) {
    return invalidResult([diagnostic({
      code: "excel-read-failed",
      details: { message: error instanceof Error ? error.message : "" }
    })]);
  }
}

export async function parseMusikkryssWeeklyContentExcel({
  arrayBuffer,
  formatId
}) {
  const diagnostics = [];
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(arrayBuffer);
  } catch (error) {
    return invalidResult([diagnostic({
      code: "excel-read-failed",
      details: { message: error instanceof Error ? error.message : "" }
    })]);
  }

  const issueSheet = workbook.getWorksheet(ISSUE_SHEET);
  const answersSheet = workbook.getWorksheet(ANSWERS_SHEET);
  if (!issueSheet) {
    diagnostics.push(diagnostic({
      code: "missing-sheet",
      sheet: ISSUE_SHEET
    }));
  }
  if (!answersSheet) {
    diagnostics.push(diagnostic({
      code: "missing-sheet",
      sheet: ANSWERS_SHEET
    }));
  }

  if (!issueSheet || !answersSheet) return invalidResult(diagnostics);

  const issueHeaders = readHeaders({
    worksheet: issueSheet,
    requiredColumns: ISSUE_COLUMNS,
    diagnostics
  });
  const answerHeaders = readHeaders({
    worksheet: answersSheet,
    requiredColumns: ANSWER_COLUMNS,
    diagnostics
  });
  if (!issueHeaders || !answerHeaders) return invalidResult(diagnostics);

  const issue = readIssue({ worksheet: issueSheet, headers: issueHeaders, diagnostics });
  const introScript = issue.introScript;
  delete issue.introScript;
  const answers = readAnswers({
    worksheet: answersSheet,
    headers: answerHeaders,
    diagnostics
  });

  if (!normalizeCellText(formatId)) {
    diagnostics.push(diagnostic({
      code: "empty-required-value",
      column: "formatId"
    }));
  }
  if (diagnostics.length > 0) return invalidResult(diagnostics);

  return deepFreeze({
    type: "musikkryss-weekly-content-excel-adapter-result",
    version: 1,
    status: "parsed",
    weeklyContent: {
      type: "musikkryss-weekly-content",
      version: 1,
      formatId: normalizeCellText(formatId),
      issue,
      introScript,
      answers
    },
    diagnostics: {
      status: "valid",
      entries: []
    }
  });
}

function readHeaders({ worksheet, requiredColumns, diagnostics }) {
  const headers = new Map();
  worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, columnNumber) => {
    const name = normalizeCellText(cell.value);
    if (name && !headers.has(name)) headers.set(name, columnNumber);
  });

  requiredColumns.forEach(column => {
    if (!headers.has(column)) {
      diagnostics.push(diagnostic({
        code: "missing-column",
        sheet: worksheet.name,
        column
      }));
    }
  });

  return requiredColumns.every(column => headers.has(column)) ? headers : null;
}

function readIssue({ worksheet, headers, diagnostics }) {
  const rowNumber = 2;
  const row = worksheet.getRow(rowNumber);

  return Object.fromEntries(ISSUE_COLUMNS.map(column => {
    const value = normalizeCellText(row.getCell(headers.get(column)).value);
    if (!value) {
      diagnostics.push(diagnostic({
        code: "empty-required-value",
        sheet: worksheet.name,
        row: rowNumber,
        column
      }));
    }
    return [column, value];
  }));
}

function readAnswers({ worksheet, headers, diagnostics }) {
  const answers = [];

  for (let rowNumber = 2; rowNumber <= worksheet.actualRowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const raw = Object.fromEntries(ANSWER_COLUMNS.map(column => [
      column,
      normalizeCellText(row.getCell(headers.get(column)).value)
    ]));
    if (ANSWER_COLUMNS.every(column => !raw[column])) continue;

    ANSWER_COLUMNS.forEach(column => {
      if (!raw[column]) {
        diagnostics.push(diagnostic({
          code: "empty-required-value",
          sheet: worksheet.name,
          row: rowNumber,
          column
        }));
      }
    });

    const number = Number(raw.number);
    if (!Number.isInteger(number) || number < 1) {
      diagnostics.push(diagnostic({
        code: "malformed-row",
        sheet: worksheet.name,
        row: rowNumber,
        column: "number",
        details: { value: raw.number }
      }));
    }

    const direction = normalizeDirection(raw.direction);
    if (raw.direction && !direction) {
      diagnostics.push(diagnostic({
        code: "invalid-direction",
        sheet: worksheet.name,
        row: rowNumber,
        column: "direction",
        details: { value: raw.direction }
      }));
    }

    answers.push({
      number: Number.isInteger(number) ? number : raw.number,
      direction: direction || raw.direction,
      contentSequence: [{ type: "text", text: raw.script }],
      solution: raw.solution.normalize("NFC")
    });
  }

  return answers;
}

function normalizeDirection(value) {
  const normalized = normalizeCellText(value).toLocaleLowerCase("sv-SE");
  if (normalized === "vågrätt") return "across";
  if (normalized === "lodrätt") return "down";
  return null;
}

function normalizeCellText(value) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (typeof value === "object") {
    if (value.result != null) return normalizeCellText(value.result);
    if (typeof value.text === "string") return value.text.trim();
    if (Array.isArray(value.richText)) {
      return value.richText.map(entry => entry.text || "").join("").trim();
    }
  }
  return "";
}

function invalidResult(entries) {
  return deepFreeze({
    type: "musikkryss-weekly-content-excel-adapter-result",
    version: 1,
    status: "invalid",
    weeklyContent: null,
    diagnostics: {
      status: "invalid",
      entries
    }
  });
}

function diagnostic({ code, sheet, row, column, details }) {
  return {
    code,
    ...(sheet ? { sheet } : {}),
    ...(Number.isInteger(row) ? { row } : {}),
    ...(column ? { column } : {}),
    ...(details ? { details } : {})
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
