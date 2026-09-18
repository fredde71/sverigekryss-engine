import { getMusikkryssFormat } from "./MusikkryssFormatCatalog";
import {
  createTemplateSolutionIndex,
  normalizeCanonicalSolution
} from "../template/templateSolutions";

const IMPORT_TYPE = "musikkryss-weekly-content";
const IMPORT_VERSION = 1;
const RESULT_TYPE = "musikkryss-weekly-content-import-result";
const RESULT_VERSION = 1;
const ISSUE_FIELDS = Object.freeze([
  "crosswordId",
  "title",
  "issueNumber",
  "publishWeek",
  "publishDate",
  "producerReference"
]);

export function importMusikkryssWeeklyContent(input, {
  formatCatalog
} = {}) {
  const diagnostics = [];
  validateEnvelope(input, diagnostics);

  const format = typeof input?.formatId === "string"
    ? getMusikkryssFormat(input.formatId, formatCatalog)
    : null;
  if (!format) {
    diagnostics.push(diagnostic({
      code: "unknown-format",
      path: "formatId",
      details: { formatId: normalizeString(input?.formatId) }
    }));
  }

  const issue = normalizeIssue(input?.issue, diagnostics);
  const introScript = normalizeText(input?.introScript);
  if (typeof input?.introScript !== "string") {
    diagnostics.push(diagnostic({
      code: "invalid-intro-script",
      path: "introScript"
    }));
  }

  const answers = Array.isArray(input?.answers) ? input.answers : [];
  if (!Array.isArray(input?.answers)) {
    diagnostics.push(diagnostic({
      code: "invalid-answers",
      path: "answers"
    }));
  }

  const normalizedAnswers = format
    ? normalizeAnswers({ format, answers, diagnostics })
    : [];

  if (format && !hasBlockingAnswerDiagnostics(diagnostics)) {
    validateCrossings({ format, answers: normalizedAnswers, diagnostics });
  }

  const isValid = diagnostics.length === 0;
  const result = {
    type: RESULT_TYPE,
    version: RESULT_VERSION,
    status: isValid ? "valid" : "invalid",
    formatId: format?.id || normalizeString(input?.formatId),
    content: isValid ? {
      formatId: format.id,
      issue,
      introScript,
      answers: normalizedAnswers
    } : null,
    diagnostics: {
      status: isValid ? "valid" : "invalid",
      expectedAnswerCount: format?.answerDefinitions.length ?? 0,
      receivedAnswerCount: answers.length,
      normalizedAnswerCount: isValid ? normalizedAnswers.length : 0,
      entries: diagnostics
    }
  };

  return deepFreeze(result);
}

function validateEnvelope(input, diagnostics) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    diagnostics.push(diagnostic({
      code: "invalid-import",
      path: "$"
    }));
    return;
  }

  if (input.type !== IMPORT_TYPE) {
    diagnostics.push(diagnostic({
      code: "invalid-type",
      path: "type",
      details: { expected: IMPORT_TYPE, actual: input.type ?? null }
    }));
  }
  if (input.version !== IMPORT_VERSION) {
    diagnostics.push(diagnostic({
      code: "unsupported-version",
      path: "version",
      details: { expected: IMPORT_VERSION, actual: input.version ?? null }
    }));
  }
}

function normalizeIssue(value, diagnostics) {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;

  if (!source) {
    diagnostics.push(diagnostic({
      code: "invalid-issue",
      path: "issue"
    }));
  }

  return Object.fromEntries(ISSUE_FIELDS.map(field => {
    const fieldValue = source?.[field];
    if (typeof fieldValue !== "string") {
      diagnostics.push(diagnostic({
        code: "invalid-issue-field",
        path: `issue.${field}`,
        details: { field }
      }));
    }
    return [field, normalizeText(fieldValue)];
  }));
}

function normalizeAnswers({ format, answers, diagnostics }) {
  const expectedById = new Map(format.answerDefinitions.map(definition => (
    [answerId(definition), definition]
  )));
  const suppliedById = new Map();

  answers.forEach((answer, index) => {
    const id = answerId(answer);
    const path = `answers[${index}]`;

    if (!expectedById.has(id)) {
      diagnostics.push(diagnostic({
        code: "unexpected-answer",
        path,
        answerRef: normalizeAnswerRef(answer)
      }));
      return;
    }
    if (suppliedById.has(id)) {
      diagnostics.push(diagnostic({
        code: "duplicate-answer",
        path,
        answerRef: normalizeAnswerRef(answer)
      }));
      return;
    }

    suppliedById.set(id, { answer, index });
  });

  format.answerDefinitions.forEach(definition => {
    const id = answerId(definition);
    if (!suppliedById.has(id)) {
      diagnostics.push(diagnostic({
        code: "missing-answer",
        path: "answers",
        answerRef: normalizeAnswerRef(definition)
      }));
    }
  });

  return format.answerDefinitions.flatMap(definition => {
    const supplied = suppliedById.get(answerId(definition));
    if (!supplied) return [];

    const { answer, index } = supplied;
    const path = `answers[${index}]`;
    const script = getTextScript(answer?.contentSequence);
    if (!script) {
      diagnostics.push(diagnostic({
        code: "empty-script",
        path: `${path}.contentSequence`,
        answerRef: normalizeAnswerRef(definition)
      }));
    }

    const solution = normalizeCanonicalSolution(answer?.solution);
    if (!solution) {
      diagnostics.push(diagnostic({
        code: "invalid-solution",
        path: `${path}.solution`,
        answerRef: normalizeAnswerRef(definition)
      }));
    } else if (Array.from(solution).length !== definition.answerPath.length) {
      diagnostics.push(diagnostic({
        code: "solution-length-mismatch",
        path: `${path}.solution`,
        answerRef: normalizeAnswerRef(definition),
        details: {
          expectedLength: definition.answerPath.length,
          actualLength: Array.from(solution).length
        }
      }));
    } else if (Array.from(solution).some(letter => /\s/u.test(letter))) {
      diagnostics.push(diagnostic({
        code: "invalid-solution",
        path: `${path}.solution`,
        answerRef: normalizeAnswerRef(definition)
      }));
    }

    return [{
      number: definition.number,
      direction: definition.direction,
      answerPath: [...definition.answerPath],
      contentSequence: [{ type: "text", text: script }],
      ...(solution ? { solution } : {})
    }];
  });
}

function validateCrossings({ format, answers, diagnostics }) {
  const solutionIndex = createTemplateSolutionIndex({
    crosswordType: "musikkryss",
    cellTypes: format.cellTopology.map(cell => (
      cell === "writable" ? "write" : "empty"
    )),
    musikkryss: { answers }
  });

  solutionIndex.conflicts.forEach(conflict => {
    diagnostics.push(diagnostic({
      code: "crossing-conflict",
      path: "answers",
      details: {
        cellIndex: conflict.cellIndex,
        existingLetter: conflict.existingLetter,
        conflictingLetter: conflict.conflictingLetter,
        answerId: conflict.answerId
      }
    }));
  });
}

function hasBlockingAnswerDiagnostics(diagnostics) {
  return diagnostics.some(entry => (
    entry.path === "answers"
    || entry.path.startsWith("answers[")
  ));
}

function getTextScript(contentSequence) {
  if (!Array.isArray(contentSequence)) return "";

  const textEntry = contentSequence.find(entry => entry?.type === "text");
  return normalizeText(textEntry?.text);
}

function answerId(value) {
  return `${value?.number}:${value?.direction}`;
}

function normalizeAnswerRef(value) {
  return {
    number: Number.isInteger(value?.number) ? value.number : null,
    direction: value?.direction === "across" || value?.direction === "down"
      ? value.direction
      : null
  };
}

function diagnostic({ code, path, answerRef, details }) {
  return {
    code,
    path,
    ...(answerRef ? { answerRef } : {}),
    ...(details ? { details } : {})
  };
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
