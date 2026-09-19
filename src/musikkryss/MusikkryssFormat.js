import { createGridFormatGeometry } from "../digitization/analysis/reconstruction/GridFormatGeometry";
import { normalizeCanonicalSolution } from "../template/templateSolutions";
import {
  normalizeSpokenAudioReference
} from "../speech/SpeechGeneration";

const ROWS = 9;
const COLS = 10;
const NON_WRITABLE_CELL_INDEXES = new Set([
  8,
  11, 13, 15, 17, 18,
  21, 23,
  31, 33, 35, 36, 37, 38,
  45,
  51, 53, 54, 55, 57, 58,
  67,
  71, 73, 75, 78,
  80, 81, 87, 88, 89
]);
const CELL_TOPOLOGY = Array.from({ length: ROWS * COLS }, (_, index) => (
  NON_WRITABLE_CELL_INDEXES.has(index) ? "non-writable" : "writable"
));
const ANSWER_DEFINITIONS = deriveAnswerDefinitions({
  rows: ROWS,
  cols: COLS,
  cellTopology: CELL_TOPOLOGY
});

export const MUSIKKRYSS_FIXED_FORMAT = deepFreeze({
  type: "musikkryss-format",
  version: 1,
  id: "musikkryss-recurring-v1",
  gridDimensions: {
    rows: ROWS,
    cols: COLS
  },
  gridGeometry: createGridFormatGeometry({
    id: "musikkryss-recurring-v1-grid-geometry",
    gridDimensions: { rows: ROWS, cols: COLS },
    axes: {
      horizontal: {
        normalizedLinePositions: normalizedLinePositions(ROWS)
      },
      vertical: {
        normalizedLinePositions: normalizedLinePositions(COLS)
      }
    },
    provenance: {
      source: "offline-confirmed-musikkryss-format"
    }
  }),
  normalizedDocumentGridArea: {
    top: 30 / 540,
    left: 20 / 490,
    width: 450 / 490,
    height: 405 / 540
  },
  cellTopology: CELL_TOPOLOGY,
  numberedStartCells: ANSWER_DEFINITIONS.numberedStartCells,
  answerDefinitions: ANSWER_DEFINITIONS.answers,
  clueNumbers: ANSWER_DEFINITIONS.numberedStartCells.map(start => start.number)
});

export function createEmptyMusikkryssContent(format = MUSIKKRYSS_FIXED_FORMAT) {
  return {
    formatId: format.id,
    introScript: "",
    answers: format.answerDefinitions.map(definition => ({
      number: definition.number,
      direction: definition.direction,
      answerPath: [...definition.answerPath],
      contentSequence: [{ type: "text", text: "" }]
    }))
  };
}

export function normalizeMusikkryssContent(
  value,
  format = MUSIKKRYSS_FIXED_FORMAT
) {
  const sourceAnswers = Array.isArray(value?.answers) ? value.answers : [];
  const issue = normalizeMusikkryssIssue(value?.issue);
  const introSpokenAudio = normalizeSpokenAudioReference(
    value?.introSpokenAudio
  );

  return {
    formatId: format.id,
    ...(issue ? { issue } : {}),
    ...(introSpokenAudio ? { introSpokenAudio } : {}),
    introScript: typeof value?.introScript === "string"
      ? value.introScript
      : "",
    answers: format.answerDefinitions.map(definition => {
      const source = sourceAnswers.find(answer => (
        answer?.number === definition.number
        && answer?.direction === definition.direction
      ));
      const textEntry = Array.isArray(source?.contentSequence)
        ? source.contentSequence.find(entry => entry?.type === "text")
        : null;
      const solution = normalizeCanonicalSolution(source?.solution);
      const spokenAudio = normalizeSpokenAudioReference(source?.spokenAudio);

      return {
        number: definition.number,
        direction: definition.direction,
        answerPath: [...definition.answerPath],
        contentSequence: [{
          type: "text",
          text: typeof textEntry?.text === "string" ? textEntry.text : "",
          ...(typeof textEntry?.speechText === "string"
            ? { speechText: textEntry.speechText }
            : {})
        }],
        ...(solution ? { solution } : {}),
        ...(spokenAudio ? { spokenAudio } : {})
      };
    })
  };
}

function normalizeMusikkryssIssue(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  return Object.fromEntries([
    "crosswordId",
    "title",
    "issueNumber",
    "publishWeek",
    "publishDate",
    "producerReference"
  ].map(field => [
    field,
    typeof value[field] === "string" ? value[field].trim() : ""
  ]));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function normalizedLinePositions(intervalCount) {
  return Array.from(
    { length: intervalCount + 1 },
    (_, index) => index / intervalCount
  );
}

export function deriveAnswerDefinitions({ rows, cols, cellTopology }) {
  const isWritable = (row, col) => (
    row >= 0
    && row < rows
    && col >= 0
    && col < cols
    && cellTopology[row * cols + col] === "writable"
  );
  const numberedStartCells = [];
  const answers = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (!isWritable(row, col)) continue;

      const startsAcross = (col === 0 || !isWritable(row, col - 1))
        && isWritable(row, col + 1);
      const startsDown = (row === 0 || !isWritable(row - 1, col))
        && isWritable(row + 1, col);
      if (!startsAcross && !startsDown) continue;

      const number = numberedStartCells.length + 1;
      const cellIndex = row * cols + col;
      const directions = [];

      if (startsAcross) {
        directions.push("across");
        answers.push({
          number,
          direction: "across",
          answerPath: collectPath({
            row,
            col,
            rowStep: 0,
            colStep: 1,
            cols,
            isWritable
          })
        });
      }
      if (startsDown) {
        directions.push("down");
        answers.push({
          number,
          direction: "down",
          answerPath: collectPath({
            row,
            col,
            rowStep: 1,
            colStep: 0,
            cols,
            isWritable
          })
        });
      }

      numberedStartCells.push({ number, cellIndex, directions });
    }
  }

  return { numberedStartCells, answers };
}

function collectPath({ row, col, rowStep, colStep, cols, isWritable }) {
  const answerPath = [];
  let currentRow = row;
  let currentCol = col;

  while (isWritable(currentRow, currentCol)) {
    answerPath.push(currentRow * cols + currentCol);
    currentRow += rowStep;
    currentCol += colStep;
  }

  return answerPath;
}
