const assert = require("node:assert/strict");
const test = require("node:test");
const {
  normalizePublicationId,
  getPublicationIdValidationError
} = require("./publicationIdValidation");

test("valid publicationIds are accepted", () => {
  for (const id of [
    "PUB-2026-0001",
    "PUB2026_0001",
    "wordex-test_1"
  ]) {
    assert.equal(getPublicationIdValidationError(id), null);
    assert.equal(normalizePublicationId(id), id);
  }
});

test("surrounding whitespace is trimmed and canonicalized", () => {
  assert.equal(getPublicationIdValidationError(" PUB-2026-0001 "), null);
  assert.equal(normalizePublicationId(" PUB-2026-0001 "), "PUB-2026-0001");
});

test("missing and empty publicationIds are reported as missing", () => {
  assert.equal(
    getPublicationIdValidationError(undefined),
    "Missing publicationId"
  );
  assert.equal(
    getPublicationIdValidationError("   "),
    "Missing publicationId"
  );
});

test("unsafe publicationIds are invalid", () => {
  for (const id of [
    123,
    "A".repeat(65),
    "PUB 2026",
    "PUB.2026",
    "../PUB-2026",
    "PUB/2026",
    "PUB\\2026",
    "ÅÄÖ-2026"
  ]) {
    assert.equal(
      getPublicationIdValidationError(id),
      "Invalid publicationId"
    );
  }
});
