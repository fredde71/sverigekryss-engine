const assert = require("node:assert/strict");
const test = require("node:test");
const {
  normalizeCrosswordId,
  getCrosswordIdValidationError
} = require("./crosswordIdValidation");
const {
  createPublishHandler,
  createLoadHandler
} = require("./server");

test("valid existing crosswordIds are accepted", () => {
  for (const id of [
    "TT-2026-0001",
    "TT2026-0001",
    "TT-2026-0002"
  ]) {
    assert.equal(getCrosswordIdValidationError(id), null);
    assert.equal(normalizeCrosswordId(id), id);
  }
});

test("lowercase and underscore crosswordIds are accepted", () => {
  const id = "wordex_test-2026";

  assert.equal(getCrosswordIdValidationError(id), null);
  assert.equal(normalizeCrosswordId(id), id);
});

test("surrounding whitespace is trimmed and canonicalized", () => {
  const id = "  TT-2026-0001  ";

  assert.equal(getCrosswordIdValidationError(id), null);
  assert.equal(normalizeCrosswordId(id), "TT-2026-0001");
});

test("missing value is reported as missing", () => {
  assert.equal(
    getCrosswordIdValidationError(undefined),
    "Missing crosswordId"
  );
});

test("empty value after trimming is reported as missing", () => {
  assert.equal(
    getCrosswordIdValidationError("   "),
    "Missing crosswordId"
  );
});

test("over 64 characters is invalid", () => {
  assert.equal(
    getCrosswordIdValidationError("A".repeat(65)),
    "Invalid crosswordId"
  );
});

test("spaces inside the ID are invalid", () => {
  assert.equal(
    getCrosswordIdValidationError("TT 2026 0001"),
    "Invalid crosswordId"
  );
});

test("dots are invalid", () => {
  assert.equal(
    getCrosswordIdValidationError("TT.2026.0001"),
    "Invalid crosswordId"
  );
});

test("forward slash and path traversal-like values are invalid", () => {
  for (const id of [
    "TT/2026",
    "../TT-2026-0001"
  ]) {
    assert.equal(
      getCrosswordIdValidationError(id),
      "Invalid crosswordId"
    );
  }
});

test("backslash is invalid", () => {
  assert.equal(
    getCrosswordIdValidationError("TT\\2026"),
    "Invalid crosswordId"
  );
});

test("Swedish and other non-ASCII characters are invalid", () => {
  for (const id of [
    "ÅÄÖ-2026",
    "TT-東京-2026"
  ]) {
    assert.equal(
      getCrosswordIdValidationError(id),
      "Invalid crosswordId"
    );
  }
});

test("invalid publish causes no template or image write", () => {
  const writes = [];
  let joins = 0;
  const handler = createPublishHandler({
    fsModule: {
      writeFileSync(...args) {
        writes.push(args);
      }
    },
    pathModule: {
      join() {
        joins += 1;
        return "should-not-be-used";
      }
    }
  });
  const res = createResponse();

  handler({
    body: {
      crosswordId: "../TT-2026-0001",
      imageSrc: "data:image/png;base64,AAAA"
    }
  }, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    success: false,
    error: "Invalid crosswordId"
  });
  assert.deepEqual(writes, []);
  assert.equal(joins, 0);
});

test("valid publish uses normalized crosswordId for files, URL, and saved template", () => {
  const writes = [];
  const handler = createPublishHandler({
    fsModule: {
      writeFileSync(...args) {
        writes.push(args);
      }
    },
    pathModule: {
      join(...parts) {
        return parts.join("/");
      }
    },
    templateStorageDir: "/templates",
    uploadStorageDir: "/uploads",
    publicBackendBaseUrl: "https://backend.example"
  });
  const res = createResponse();

  handler({
    body: {
      crosswordId: " TT-2026-0001 ",
      imageSrc: "data:image/png;base64,AAAA"
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    success: true,
    savedAs: "TT-2026-0001.json"
  });
  assert.equal(writes[0][0], "/uploads/TT-2026-0001.png");
  assert.equal(writes[1][0], "/templates/TT-2026-0001.json");

  const savedTemplate = JSON.parse(writes[1][1]);

  assert.equal(savedTemplate.crosswordId, "TT-2026-0001");
  assert.equal(
    savedTemplate.imageSrc,
    "https://backend.example/uploads/TT-2026-0001.png"
  );
});

test("invalid GET does not attempt a file read", () => {
  let existsChecks = 0;
  let reads = 0;
  const handler = createLoadHandler({
    fsModule: {
      existsSync() {
        existsChecks += 1;
        return true;
      },
      readFileSync() {
        reads += 1;
        return "{}";
      }
    },
    pathModule: {
      join() {
        throw new Error("path should not be constructed");
      }
    }
  });
  const res = createResponse();

  handler({
    params: {
      id: "../TT-2026-0001"
    }
  }, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    success: false,
    error: "Invalid crosswordId"
  });
  assert.equal(existsChecks, 0);
  assert.equal(reads, 0);
});

test("valid but nonexistent GET preserves not-found behavior", () => {
  const handler = createLoadHandler({
    fsModule: {
      existsSync() {
        return false;
      },
      readFileSync() {
        throw new Error("read should not happen");
      }
    },
    pathModule: {
      join(...parts) {
        return parts.join("/");
      }
    },
    templateStorageDir: "/templates"
  });
  const res = createResponse();

  handler({
    params: {
      id: "TT-2026-9999"
    }
  }, res);

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, {
    success: false,
    error: "Template not found"
  });
});

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}
