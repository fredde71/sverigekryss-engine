import {
  applyMusikkryssWeeklyContentImport
} from "./MusikkryssWeeklyContentApplication";
import {
  importMusikkryssWeeklyContent
} from "./MusikkryssWeeklyContentImport";
import { createMusikkryssReferenceContent } from "./MusikkryssReferenceContentPack";
import {
  deriveAnswerDefinitions,
  MUSIKKRYSS_FIXED_FORMAT
} from "./MusikkryssFormat";
import { createMusikkryssTemplate } from "./MusikkryssTemplateInitializer";
import { createTemplate } from "../template/templateModel";
import { createTemplateSolutionIndex } from "../template/templateSolutions";

test("initializes a blank session from the validated registered format", () => {
  const session = createBlankSession();
  const before = clone(session);
  const importResult = importMusikkryssWeeklyContent(createValidImport());

  const application = applyMusikkryssWeeklyContentImport({
    session,
    importResult
  });

  expect(application.status).toBe("applied");
  expect(application.session.rows).toBe(9);
  expect(application.session.cols).toBe(10);
  expect(application.session.cellTypes).toHaveLength(90);
  expect(application.session.cellTypes.filter(value => value === "write"))
    .toHaveLength(59);
  expect(application.session.cellTypes.filter(value => value === "black"))
    .toHaveLength(31);
  expect(application.session.horizontalLinePositions).toHaveLength(10);
  expect(application.session.verticalLinePositions).toHaveLength(11);
  expect(application.session.musikkryss.introScript)
    .toBe(importResult.content.introScript);
  expect(application.session.musikkryss.answers.map(answer => answer.solution))
    .toEqual(importResult.content.answers.map(answer => answer.solution));
  expect(application.session.musikkryss.answers.map(answer => answer.answerPath))
    .toEqual(MUSIKKRYSS_FIXED_FORMAT.answerDefinitions.map(
      definition => definition.answerPath
    ));
  expect(MUSIKKRYSS_FIXED_FORMAT.numberedStartCells.every(start => (
    application.session.musikkryss.answers
      .filter(answer => answer.number === start.number)
      .every(answer => answer.answerPath[0] === start.cellIndex)
  ))).toBe(true);

  const playableTemplate = createTemplate(application.session);
  const solutionIndex = createTemplateSolutionIndex(playableTemplate);
  expect(playableTemplate.rows * playableTemplate.cols)
    .toBe(playableTemplate.cellTypes.length);
  expect(solutionIndex.completenessStatus).toBe("complete");
  expect(solutionIndex.conflicts).toEqual([]);
  expect(session).toEqual(before);
});

test("atomically applies valid issue content while preserving document and grid", () => {
  const template = createMusikkryssTemplate({
    crosswordId: "OLD-ID",
    documentSize: { width: 980, height: 1080 },
    imageSrc: "producer-weekly.pdf"
  });
  const session = {
    ...template,
    imageFileName: "producer-weekly.pdf",
    editorZoomState: { fitScale: 0.5, scale: 0.75, zoomMode: "manual" },
    editorScrollState: { top: 20, left: 30 }
  };
  const before = clone(session);
  const importResult = importMusikkryssWeeklyContent(createValidImport());

  const application = applyMusikkryssWeeklyContentImport({
    session,
    importResult
  });

  expect(application.status).toBe("applied");
  expect(application.session.crosswordId).toBe("MUSIK-2026-38");
  expect(application.session.musikkryss.issue).toEqual(
    importResult.content.issue
  );
  expect(application.session.musikkryss.introScript)
    .toBe(importResult.content.introScript);
  expect(application.session.musikkryss.answers).toHaveLength(15);
  expect(application.session.imageSrc).toBe(session.imageSrc);
  expect(application.session.documentSize).toBe(session.documentSize);
  expect(application.session.gridArea).toBe(session.gridArea);
  expect(application.session.cellTypes).toBe(session.cellTypes);
  expect(application.session.horizontalLinePositions)
    .toBe(session.horizontalLinePositions);
  expect(application.session.verticalLinePositions)
    .toBe(session.verticalLinePositions);
  expect(session).toEqual(before);

  const persisted = createTemplate(application.session);
  expect(persisted.musikkryss.issue).toEqual(importResult.content.issue);
  expect(persisted.musikkryss.answers.map(answer => answer.solution))
    .toEqual(importResult.content.answers.map(answer => answer.solution));
});

test("preserves format-derived answer paths during application", () => {
  const session = createMusikkryssTemplate({ imageSrc: "weekly.pdf" });
  const importResult = importMusikkryssWeeklyContent(createValidImport());
  const untrustedPathResult = {
    ...importResult,
    content: {
      ...importResult.content,
      answers: importResult.content.answers.map((answer, index) => ({
        ...answer,
        answerPath: index === 0 ? [999] : answer.answerPath
      }))
    }
  };

  const application = applyMusikkryssWeeklyContentImport({
    session,
    importResult: untrustedPathResult
  });

  expect(application.session.musikkryss.answers.map(answer => answer.answerPath))
    .toEqual(MUSIKKRYSS_FIXED_FORMAT.answerDefinitions.map(
      definition => definition.answerPath
    ));
});

test("invalid import and non-Musikkryss targets remain untouched", () => {
  const session = createBlankSession();
  const invalidInput = createValidImport();
  invalidInput.answers.pop();
  const invalidResult = importMusikkryssWeeklyContent(invalidInput);

  const invalidApplication = applyMusikkryssWeeklyContentImport({
    session,
    importResult: invalidResult
  });
  expect(invalidApplication.status).toBe("not-applied");
  expect(invalidApplication.session).toBe(session);

  const sverigekryssSession = { ...session, crosswordType: "sverigekryss" };
  const wrongSessionApplication = applyMusikkryssWeeklyContentImport({
    session: sverigekryssSession,
    importResult: importMusikkryssWeeklyContent(createValidImport())
  });
  expect(wrongSessionApplication.status).toBe("not-applied");
  expect(wrongSessionApplication.session).toBe(sverigekryssSession);
  expect(wrongSessionApplication.diagnostics[0].code)
    .toBe("not-musikkryss-session");

  const unapprovedApplication = applyMusikkryssWeeklyContentImport({
    session,
    importResult: null
  });
  expect(unapprovedApplication.status).toBe("not-applied");
  expect(unapprovedApplication.session).toBe(session);
});

test("initializes an arbitrary registered future format without fixed-format assumptions", () => {
  const format = createFutureFormat();
  const formatCatalog = {
    type: "musikkryss-format-catalog",
    version: 1,
    defaultFormatId: format.id,
    formats: [format]
  };
  const input = createFutureImport(format);
  const importResult = importMusikkryssWeeklyContent(input, { formatCatalog });

  const application = applyMusikkryssWeeklyContentImport({
    session: createBlankSession(),
    importResult,
    formatCatalog
  });

  expect(importResult.status).toBe("valid");
  expect(application.status).toBe("applied");
  expect(application.session.rows).toBe(2);
  expect(application.session.cols).toBe(2);
  expect(application.session.cellTypes).toEqual(Array(4).fill("write"));
  expect(application.session.horizontalLinePositions).toHaveLength(3);
  expect(application.session.verticalLinePositions).toHaveLength(3);
  expect(application.session.musikkryss.formatId).toBe(format.id);
  expect(application.session.musikkryss.answers.map(answer => answer.answerPath))
    .toEqual(format.answerDefinitions.map(answer => answer.answerPath));
});

function createValidImport() {
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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createBlankSession() {
  return {
    crosswordType: "musikkryss",
    crosswordId: "",
    rows: 25,
    cols: 25,
    cellTypes: Array(625).fill("empty"),
    gridArea: { top: 0, left: 0, width: 1200, height: 1200 },
    cropArea: { top: 0, left: 0, width: 1200, height: 1200 },
    competitionCells: [],
    answerPaths: [],
    horizontalLinePositions: null,
    verticalLinePositions: null,
    documentSize: { width: 1200, height: 1200 },
    imageSrc: "",
    musikkryss: createMusikkryssTemplate().musikkryss
  };
}

function createFutureFormat() {
  const cellTopology = Array(4).fill("writable");
  const derived = deriveAnswerDefinitions({
    rows: 2,
    cols: 2,
    cellTopology
  });

  return {
    type: "musikkryss-format",
    version: 1,
    id: "future-2x2-format",
    gridDimensions: { rows: 2, cols: 2 },
    gridGeometry: {
      axes: {
        horizontal: { normalizedLinePositions: [0, 0.5, 1] },
        vertical: { normalizedLinePositions: [0, 0.5, 1] }
      }
    },
    normalizedDocumentGridArea: {
      top: 0.1,
      left: 0.2,
      width: 0.6,
      height: 0.8
    },
    cellTopology,
    numberedStartCells: derived.numberedStartCells,
    answerDefinitions: derived.answers,
    clueNumbers: derived.numberedStartCells.map(start => start.number)
  };
}

function createFutureImport(format) {
  const solutions = {
    "1:across": "AB",
    "1:down": "AC",
    "2:down": "BD",
    "3:across": "CD"
  };

  return {
    type: "musikkryss-weekly-content",
    version: 1,
    formatId: format.id,
    issue: {
      crosswordId: "FUTURE-1",
      title: "Future",
      issueNumber: "1",
      publishWeek: "2027-W01",
      publishDate: "2027-01-04",
      producerReference: "FUTURE-PRODUCER-1"
    },
    introScript: "Future intro",
    answers: format.answerDefinitions.map(answer => ({
      number: answer.number,
      direction: answer.direction,
      contentSequence: [{
        type: "text",
        text: `Question ${answer.number} ${answer.direction}`
      }],
      solution: solutions[`${answer.number}:${answer.direction}`]
    }))
  };
}
