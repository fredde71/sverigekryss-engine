const assert = require("node:assert/strict");
const test = require("node:test");
const { createPublicationId } = require("./publicationIdGenerator");
const { getPublicationIdValidationError } = require("./publicationIdValidation");

test("createPublicationId returns stable URL-friendly publicationId format", () => {
  const publicationId = createPublicationId({
    now: () => new Date("2026-07-20T10:20:30.000Z"),
    random: () => 0.123456789
  });

  assert.equal(publicationId, "pub-20260720102030-4fzzzx");
  assert.equal(getPublicationIdValidationError(publicationId), null);
});
