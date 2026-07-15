import {
  loadBackendTemplate,
  publishBackendTemplate
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
    imageSrc: "",
    metadata: undefined
  });
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
