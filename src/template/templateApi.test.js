import {
  loadBackendTemplate,
  publishBackendTemplate,
  submitCompetitionEntry
} from "./templateApi";
import { BACKEND_BASE_URL } from "./persistenceConfig";

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

function mockJsonResponse(body) {
  global.fetch.mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue(body)
  });
}

test("loadBackendTemplate uses the configured backend URL", async () => {
  mockJsonResponse({
    crosswordId: "TT-2026-0002",
    rows: 1,
    cols: 1,
    cellTypes: ["write"],
    gridArea: {},
    imageSrc: ""
  });

  await loadBackendTemplate("TT-2026-0002");

  expect(global.fetch).toHaveBeenCalledWith(
    `${BACKEND_BASE_URL}/api/crossword/TT-2026-0002`
  );
});

test("loadBackendTemplate returns normalized Template data", async () => {
  mockJsonResponse({
    cellTypes: {
      0: "write",
      2: "double"
    }
  });

  const template = await loadBackendTemplate("TT-2026-0002");

  expect(template).toEqual({
    crosswordId: "TT-2026-0002",
    rows: 25,
    cols: 25,
    cellTypes: [
      "write",
      "empty",
      "double",
      ...Array(622).fill("empty")
    ],
    gridArea: {
      top: 0,
      left: 0,
      width: 1200,
      height: 1200
    },
    documentSize: {
      width: 1200,
      height: 1200
    },
    cropArea: {
      top: 0,
      left: 0,
      width: 1200,
      height: 1200
    },
    imageSrc: "",
    metadata: undefined
  });
});

test("loadBackendTemplate preserves backend cropArea", async () => {
  const cropArea = {
    top: 100,
    left: 80,
    width: 900,
    height: 700
  };

  mockJsonResponse({
    crosswordId: "TT-2026-0002",
    rows: 1,
    cols: 1,
    cellTypes: ["write"],
    gridArea: {},
    cropArea,
    imageSrc: ""
  });

  const template = await loadBackendTemplate("TT-2026-0002");

  expect(template.cropArea).toEqual(cropArea);
});

test("loadBackendTemplate preserves backend documentSize", async () => {
  const documentSize = {
    width: 1200,
    height: 1697
  };

  mockJsonResponse({
    crosswordId: "TT-2026-0002",
    rows: 1,
    cols: 1,
    cellTypes: ["write"],
    documentSize,
    gridArea: {},
    imageSrc: ""
  });

  const template = await loadBackendTemplate("TT-2026-0002");

  expect(template.documentSize).toEqual(documentSize);
});

test("loadBackendTemplate preserves backend competitionCells", async () => {
  mockJsonResponse({
    crosswordId: "TT-2026-0002",
    rows: 3,
    cols: 3,
    cellTypes: Array(9).fill("write"),
    gridArea: {},
    imageSrc: "",
    competitionCells: [
      { index: 8, position: 2 },
      { index: 2, position: 1 }
    ]
  });

  const template = await loadBackendTemplate("TT-2026-0002");

  expect(template.competitionCells).toEqual([
    { index: 2, position: 1 },
    { index: 8, position: 2 }
  ]);
});

test("loadBackendTemplate keeps legacy templates without competitionCells valid", async () => {
  mockJsonResponse({
    crosswordId: "TT-2026-0002",
    rows: 1,
    cols: 1,
    cellTypes: ["write"],
    gridArea: {},
    imageSrc: ""
  });

  const template = await loadBackendTemplate("TT-2026-0002");

  expect(template).not.toHaveProperty("competitionCells");
});

test("loadBackendTemplate does not normalize backend 404 into a Template", async () => {
  global.fetch.mockResolvedValue({
    ok: false,
    status: 404,
    json: jest.fn().mockResolvedValue({
      success: false,
      error: "Template not found"
    })
  });

  await expect(loadBackendTemplate("missing-template"))
    .rejects
    .toThrow("Template not found");
});

test("publishBackendTemplate posts unchanged payload and returns parsed backend JSON", async () => {
  const payload = {
    crosswordId: "TT-2026-0002",
    rows: 25,
    cols: 25,
    cellTypes: ["write"],
    gridArea: {
      top: 1,
      left: 2,
      width: 300,
      height: 300
    },
    documentSize: {
      width: 1200,
      height: 1697
    },
    competitionCells: [
      { index: 12, position: 1 },
      { index: 18, position: 2 }
    ],
    imageSrc: "/grid.png"
  };
  const responseBody = {
    success: true,
    savedAs: "TT-2026-0002.json"
  };

  mockJsonResponse(responseBody);

  const result = await publishBackendTemplate(payload);

  expect(global.fetch).toHaveBeenCalledWith(
    `${BACKEND_BASE_URL}/api/publish`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }
  );
  expect(result).toEqual(responseBody);
});

test("publishBackendTemplate throws backend error for non-OK publish response", async () => {
  const payload = {
    crosswordId: "TT-2026-0002",
    rows: 25,
    cols: 25,
    cellTypes: ["write"],
    gridArea: {},
    imageSrc: "/grid.png"
  };

  global.fetch.mockResolvedValue({
    ok: false,
    status: 500,
    json: jest.fn().mockResolvedValue({
      success: false,
      error: "Failed to save template"
    })
  });

  await expect(publishBackendTemplate(payload))
    .rejects
    .toThrow("Failed to save template");
});

test("submitCompetitionEntry posts submission payload and returns parsed backend JSON", async () => {
  const payload = {
    publicationId: "pub-20260720102030-abc123",
    crosswordId: "TT-2026-0002",
    name: "Fredrik",
    email: "fredrik@example.com",
    phone: "0701234567",
    solution: "ABCDEF"
  };
  const responseBody = {
    success: true
  };

  mockJsonResponse(responseBody);

  const result = await submitCompetitionEntry(payload);

  expect(global.fetch).toHaveBeenCalledWith(
    `${BACKEND_BASE_URL}/api/submissions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }
  );
  expect(result).toEqual(responseBody);
});

test("submitCompetitionEntry throws backend error for failed submission", async () => {
  global.fetch.mockResolvedValue({
    ok: false,
    status: 400,
    json: jest.fn().mockResolvedValue({
      success: false,
      error: "Invalid solution"
    })
  });

  await expect(submitCompetitionEntry({
    templateId: "TT-2026-0002",
    name: "Fredrik",
    email: "fredrik@example.com",
    phone: "0701234567",
    solution: "ABCDE"
  }))
    .rejects
    .toThrow("Invalid solution");
});
