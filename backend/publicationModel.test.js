const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createPublication,
  normalizePublication,
  getPublicationValidationErrors
} = require("./publicationModel");

const validPublication = {
  publicationId: " PUB-2026-0001 ",
  crosswordId: " TT-2026-0001 ",
  newspaper: " Dagens Kryss ",
  group: " Grupp A ",
  publishDate: " 2026-07-20 ",
  publishWeek: " 2026-W30 ",
  status: " published ",
  url: " https://example.com/play/PUB-2026-0001 ",
  statistics: {
    views: 10,
    submissions: 2
  }
};

test("normalizePublication returns the canonical Publication fields", () => {
  assert.deepEqual(normalizePublication(validPublication), {
    publicationId: "PUB-2026-0001",
    crosswordId: "TT-2026-0001",
    newspaper: "Dagens Kryss",
    group: "Grupp A",
    publishDate: "2026-07-20",
    publishWeek: "2026-W30",
    status: "published",
    url: "https://example.com/play/PUB-2026-0001",
    statistics: {
      views: 10,
      submissions: 2
    }
  });
});

test("normalizePublication defaults optional Publication fields safely", () => {
  assert.deepEqual(normalizePublication({
    publicationId: "PUB-2026-0001",
    crosswordId: "TT-2026-0001"
  }), {
    publicationId: "PUB-2026-0001",
    crosswordId: "TT-2026-0001",
    newspaper: "",
    group: "",
    publishDate: "",
    publishWeek: "",
    status: "draft",
    url: "",
    statistics: {}
  });
});

test("createPublication validates required public identifiers", () => {
  assert.throws(() => createPublication({
    ...validPublication,
    publicationId: "../PUB-2026-0001"
  }), /Invalid publicationId/);

  assert.throws(() => createPublication({
    ...validPublication,
    crosswordId: "../TT-2026-0001"
  }), /Invalid crosswordId/);
});

test("getPublicationValidationErrors reports missing identifiers", () => {
  assert.deepEqual(getPublicationValidationErrors({}), [
    "Missing publicationId",
    "Missing crosswordId"
  ]);
});

test("createPublication preserves normalized statistics without sharing the object", () => {
  const statistics = {
    views: 4
  };
  const publication = createPublication({
    ...validPublication,
    statistics
  });

  assert.deepEqual(publication.statistics, statistics);
  assert.notEqual(publication.statistics, statistics);
});
