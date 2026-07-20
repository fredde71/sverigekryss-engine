import {
  createBackendPublication,
  loadBackendPublicationsForCrossword
} from "./publicationApi";
import { BACKEND_BASE_URL } from "../template/persistenceConfig";

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("createBackendPublication posts Publication payload and returns backend JSON", async () => {
  const payload = {
    publicationId: "PUB-2026-0001",
    crosswordId: "TT-2026-0001",
    newspaper: "",
    group: "",
    publishDate: "",
    publishWeek: "",
    status: "published",
    url: "https://wordex.example/play/TT-2026-0001",
    statistics: {}
  };
  const responseBody = {
    ...payload
  };

  global.fetch.mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue(responseBody)
  });

  const result = await createBackendPublication(payload);

  expect(global.fetch).toHaveBeenCalledWith(
    `${BACKEND_BASE_URL}/api/publications`,
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

test("createBackendPublication throws backend error for failed Publication creation", async () => {
  global.fetch.mockResolvedValue({
    ok: false,
    status: 400,
    json: jest.fn().mockResolvedValue({
      success: false,
      error: "Invalid publicationId"
    })
  });

  await expect(createBackendPublication({
    publicationId: "../PUB-2026-0001",
    crosswordId: "TT-2026-0001"
  })).rejects.toThrow("Invalid publicationId");
});

test("loadBackendPublicationsForCrossword uses backend URL and returns Publication list", async () => {
  const responseBody = [
    {
      publicationId: "PUB-2026-0001",
      crosswordId: "TT-2026-0001",
      newspaper: "Dagens Kryss",
      group: "Grupp A",
      publishDate: "2026-07-20",
      publishWeek: "2026-W30",
      status: "published",
      url: "https://wordex.example/play/TT-2026-0001",
      statistics: {}
    }
  ];

  global.fetch.mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue(responseBody)
  });

  const result = await loadBackendPublicationsForCrossword("TT-2026-0001");

  expect(global.fetch).toHaveBeenCalledWith(
    `${BACKEND_BASE_URL}/api/crosswords/TT-2026-0001/publications`
  );
  expect(result).toEqual(responseBody);
});

test("loadBackendPublicationsForCrossword throws backend error for failed list load", async () => {
  global.fetch.mockResolvedValue({
    ok: false,
    status: 400,
    json: jest.fn().mockResolvedValue({
      success: false,
      error: "Invalid crosswordId"
    })
  });

  await expect(loadBackendPublicationsForCrossword("../TT-2026-0001"))
    .rejects
    .toThrow("Invalid crosswordId");
});
