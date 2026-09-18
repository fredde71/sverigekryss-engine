import { exportTemplateFile } from "./templateExport";
import { importTemplateFile } from "./templateImport";
import {
  createSpeechGenerationRequest,
  createSpokenAudioReference
} from "../speech/SpeechGeneration";

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

afterEach(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  jest.restoreAllMocks();
});

test("JSON import preserves documentSize", async () => {
  const documentSize = {
    width: 1200,
    height: 1697
  };
  const file = {
    text: jest.fn().mockResolvedValue(JSON.stringify({
      crosswordId: "TT-2026-0001",
      rows: 1,
      cols: 1,
      cellTypes: ["write"],
      documentSize,
      gridArea: {},
      cropArea: {
        top: 0,
        left: 0,
        width: 1200,
        height: 1697
      },
      imageSrc: "/grid.png"
    }))
  };

  const template = await importTemplateFile(file, {});

  expect(template.documentSize).toEqual(documentSize);
});

test("exported template JSON includes documentSize", async () => {
  const documentSize = {
    width: 1200,
    height: 1697
  };
  const createdUrls = [];

  URL.createObjectURL = jest.fn((blob) => {
    createdUrls.push(blob);
    return "blob:template";
  });
  URL.revokeObjectURL = jest.fn();
  jest.spyOn(document, "createElement").mockReturnValue({
    click: jest.fn()
  });

  exportTemplateFile({
    crosswordId: "TT-2026-0001",
    rows: 1,
    cols: 1,
    cellTypes: ["write"],
    documentSize,
    gridArea: {},
    imageSrc: "/grid.png"
  });

  const exported = JSON.parse(await readBlobText(createdUrls[0]));

  expect(exported.documentSize).toEqual(documentSize);
});

test("create import export round-trip preserves competitionCells metadata", async () => {
  const competitionCells = [
    { index: 5, position: 2 },
    { index: 2, position: 1 }
  ];
  const createdUrls = [];

  URL.createObjectURL = jest.fn((blob) => {
    createdUrls.push(blob);
    return "blob:template";
  });
  URL.revokeObjectURL = jest.fn();
  jest.spyOn(document, "createElement").mockReturnValue({
    click: jest.fn()
  });

  exportTemplateFile({
    crosswordId: "TT-2026-0001",
    rows: 3,
    cols: 3,
    cellTypes: Array(9).fill("write"),
    documentSize: {
      width: 1200,
      height: 1697
    },
    gridArea: {},
    cropArea: {
      top: 0,
      left: 0,
      width: 1200,
      height: 1697
    },
    imageSrc: "/grid.png",
    competitionCells
  });

  const exported = JSON.parse(await readBlobText(createdUrls[0]));
  const imported = await importTemplateFile({
    text: jest.fn().mockResolvedValue(JSON.stringify(exported))
  }, {});

  expect(imported.competitionCells).toEqual([
    { index: 2, position: 1 },
    { index: 5, position: 2 }
  ]);
});

test("create import export round-trip preserves explicit answer paths", async () => {
  const answerPaths = [{
    clueIndex: 0,
    paths: [{
      direction: "across",
      cellIndexes: [1, 2, 5, 8, 7],
      solution: "ABCDE"
    }]
  }];
  const createdUrls = [];

  URL.createObjectURL = jest.fn((blob) => {
    createdUrls.push(blob);
    return "blob:template";
  });
  URL.revokeObjectURL = jest.fn();
  jest.spyOn(document, "createElement").mockReturnValue({
    click: jest.fn()
  });

  exportTemplateFile({
    crosswordId: "TT-2026-0003",
    rows: 3,
    cols: 3,
    cellTypes: [
      "blocked", "write", "write",
      "empty", "empty", "write",
      "empty", "write", "write"
    ],
    gridArea: {},
    imageSrc: "/grid.png",
    answerPaths
  });

  const exported = JSON.parse(await readBlobText(createdUrls[0]));
  const imported = await importTemplateFile({
    text: jest.fn().mockResolvedValue(JSON.stringify(exported))
  }, {});

  expect(imported.answerPaths).toEqual(answerPaths);
});

test("create import export round-trip preserves explicit grid-line positions", async () => {
  const createdUrls = [];

  URL.createObjectURL = jest.fn((blob) => {
    createdUrls.push(blob);
    return "blob:template";
  });
  URL.revokeObjectURL = jest.fn();
  jest.spyOn(document, "createElement").mockReturnValue({ click: jest.fn() });

  exportTemplateFile({
    crosswordId: "TT-2026-0005",
    rows: 2,
    cols: 2,
    cellTypes: Array(4).fill("write"),
    gridArea: { top: 10, left: 20, width: 100, height: 80 },
    imageSrc: "/grid.png",
    horizontalLinePositions: [10, 42, 90],
    verticalLinePositions: [20, 57, 120]
  });

  const exported = JSON.parse(await readBlobText(createdUrls[0]));
  const imported = await importTemplateFile({
    text: jest.fn().mockResolvedValue(JSON.stringify(exported))
  }, {});

  expect(imported.horizontalLinePositions).toEqual([10, 42, 90]);
  expect(imported.verticalLinePositions).toEqual([20, 57, 120]);
});

test("create import export round-trip preserves Musikkryss editor content", async () => {
  const createdUrls = [];
  const introRequest = createSpeechGenerationRequest({
    sourceRef: { type: "musikkryss-intro" },
    contentSequence: [{ type: "text", text: "Intro" }],
    locale: "sv-SE",
    voiceProfileId: "sv-female-natural-v1"
  });
  const answerRequest = createSpeechGenerationRequest({
    sourceRef: {
      type: "musikkryss-answer",
      number: 8,
      direction: "down"
    },
    contentSequence: [{ type: "text", text: "Lodrät ledtråd" }],
    locale: "sv-SE",
    voiceProfileId: "sv-female-natural-v1"
  });
  const introSpokenAudio = createTestAudioReference(
    "intro-asset",
    introRequest
  );
  const answerSpokenAudio = createTestAudioReference(
    "answer-8-down-asset",
    answerRequest
  );
  URL.createObjectURL = jest.fn((blob) => {
    createdUrls.push(blob);
    return "blob:template";
  });
  URL.revokeObjectURL = jest.fn();
  jest.spyOn(document, "createElement").mockReturnValue({ click: jest.fn() });

  exportTemplateFile({
    crosswordId: "MUSIK-2026-0001",
    crosswordType: "musikkryss",
    rows: 1,
    cols: 1,
    cellTypes: ["write"],
    gridArea: {},
    imageSrc: "/music-grid.png",
    musikkryss: {
      introScript: "Intro",
      introSpokenAudio,
      answers: [{
        number: 8,
        direction: "down",
        contentSequence: [{ type: "text", text: "Lodrät ledtråd" }],
        spokenAudio: answerSpokenAudio
      }]
    }
  });

  const exported = JSON.parse(await readBlobText(createdUrls[0]));
  const imported = await importTemplateFile({
    text: jest.fn().mockResolvedValue(JSON.stringify(exported))
  }, {});

  expect(imported.crosswordType).toBe("musikkryss");
  expect(imported.musikkryss.introScript).toBe("Intro");
  expect(imported.musikkryss.introSpokenAudio).toEqual(introSpokenAudio);
  const importedAnswer = imported.musikkryss.answers.find(answer => (
    answer.number === 8 && answer.direction === "down"
  ));
  expect(importedAnswer.contentSequence[0].text).toBe("Lodrät ledtråd");
  expect(importedAnswer.answerPath).toEqual([46, 56, 66, 76, 86]);
  expect(importedAnswer.spokenAudio).toEqual(answerSpokenAudio);
});

test("template round-trip preserves black cells and legacy cell types", async () => {
  const createdUrls = [];
  URL.createObjectURL = jest.fn(blob => {
    createdUrls.push(blob);
    return "blob:template";
  });
  URL.revokeObjectURL = jest.fn();
  jest.spyOn(document, "createElement").mockReturnValue({ click: jest.fn() });

  exportTemplateFile({
    crosswordId: "MUSIK-CELL-TYPES",
    crosswordType: "musikkryss",
    rows: 1,
    cols: 5,
    cellTypes: ["black", "write", "empty", "blocked", "double"],
    documentSize: { width: 500, height: 100 },
    gridArea: { top: 0, left: 0, width: 500, height: 100 },
    imageSrc: ""
  });

  const exported = JSON.parse(await readBlobText(createdUrls[0]));
  const imported = await importTemplateFile({
    text: jest.fn().mockResolvedValue(JSON.stringify(exported))
  }, {});

  expect(imported.cellTypes)
    .toEqual(["black", "write", "empty", "blocked", "double"]);
});

test("legacy Musikkryss empty topology normalizes to durable black cells", async () => {
  const legacyCellTypes = Array(90).fill("write");
  [
    8,
    11, 13, 15, 17, 18,
    21, 23,
    31, 33, 35, 36, 37, 38,
    45,
    51, 53, 54, 55, 57, 58,
    67,
    71, 73, 75, 78,
    80, 81, 87, 88, 89
  ].forEach(index => {
    legacyCellTypes[index] = "empty";
  });

  const imported = await importTemplateFile({
    text: jest.fn().mockResolvedValue(JSON.stringify({
      crosswordId: "LEGACY-MUSIK",
      crosswordType: "musikkryss",
      rows: 9,
      cols: 10,
      cellTypes: legacyCellTypes,
      documentSize: { width: 490, height: 540 },
      gridArea: { top: 30, left: 20, width: 450, height: 405 },
      imageSrc: "",
      musikkryss: { formatId: "musikkryss-recurring-v1" }
    }))
  }, {});

  expect(imported.cellTypes.filter(cellType => cellType === "write"))
    .toHaveLength(59);
  expect(imported.cellTypes.filter(cellType => cellType === "black"))
    .toHaveLength(31);
});

function readBlobText(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(blob);
  });
}

function createTestAudioReference(assetId, request) {
  return createSpokenAudioReference({
    assetId,
    assetVersion: 1,
    mediaType: "audio/mpeg",
    publicUrl: `/audio/${assetId}.mp3`,
    sourceFingerprint: request.sourceFingerprint,
    voiceProfileId: request.voiceProfileId,
    locale: request.locale
  });
}
