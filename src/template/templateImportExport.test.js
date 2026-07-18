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

function readBlobText(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(blob);
  });
}
