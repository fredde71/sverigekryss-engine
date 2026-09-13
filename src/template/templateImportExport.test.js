import { exportTemplateFile } from "./templateExport";
import { importTemplateFile } from "./templateImport";

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
      cellIndexes: [1, 2, 5, 8, 7]
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

function readBlobText(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(blob);
  });
}
