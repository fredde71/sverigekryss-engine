const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createPublicationSaveHandler,
  createPublicationLoadHandler,
  createCrosswordPublicationsListHandler
} = require("./server");

const validPublication = {
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
};

test("POST /api/publications saves and returns normalized Publication", () => {
  const writes = [];
  const madeDirs = [];
  const handler = createPublicationSaveHandler({
    fsModule: {
      mkdirSync(...args) {
        madeDirs.push(args);
      },
      writeFileSync(...args) {
        writes.push(args);
      }
    },
    pathModule: createPathModule(),
    publicationStorageDir: "/publications"
  });
  const res = createResponse();

  handler({
    body: {
      ...validPublication,
      publicationId: " PUB-2026-0001 ",
      crosswordId: " TT-2026-0001 "
    }
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.publicationId, "PUB-2026-0001");
  assert.equal(res.body.crosswordId, "TT-2026-0001");
  assert.deepEqual(madeDirs, [
    ["/publications", { recursive: true }]
  ]);
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], "/publications/PUB-2026-0001.json");
  assert.deepEqual(JSON.parse(writes[0][1]), res.body);
});

test("POST /api/publications rejects invalid Publication before writing", () => {
  const writes = [];
  let joins = 0;
  const handler = createPublicationSaveHandler({
    fsModule: {
      mkdirSync() {
        throw new Error("directory should not be created");
      },
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
      ...validPublication,
      publicationId: "../PUB-2026-0001"
    }
  }, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    success: false,
    error: "Invalid publicationId"
  });
  assert.deepEqual(writes, []);
  assert.equal(joins, 0);
});

test("POST /api/publications validates crosswordId", () => {
  const { res } = savePublication({
    ...validPublication,
    crosswordId: "../TT-2026-0001"
  });

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    success: false,
    error: "Invalid crosswordId"
  });
});

test("GET /api/publications/:publicationId returns stored Publication", () => {
  const handler = createPublicationLoadHandler({
    fsModule: {
      existsSync() {
        return true;
      },
      readFileSync() {
        return JSON.stringify({
          ...validPublication,
          publicationId: " PUB-2026-0001 ",
          status: " published "
        });
      }
    },
    pathModule: createPathModule(),
    publicationStorageDir: "/publications"
  });
  const res = createResponse();

  handler({
    params: {
      publicationId: "PUB-2026-0001"
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, validPublication);
});

test("GET /api/publications/:publicationId returns 404 for missing Publication", () => {
  const handler = createPublicationLoadHandler({
    fsModule: {
      existsSync() {
        return false;
      }
    },
    pathModule: createPathModule(),
    publicationStorageDir: "/publications"
  });
  const res = createResponse();

  handler({
    params: {
      publicationId: "PUB-2026-404"
    }
  }, res);

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, {
    success: false,
    error: "Publication not found"
  });
});

test("GET /api/publications/:publicationId rejects invalid id before reading", () => {
  let joins = 0;
  let existsChecks = 0;
  let reads = 0;
  const handler = createPublicationLoadHandler({
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
        joins += 1;
        return "should-not-be-used";
      }
    }
  });
  const res = createResponse();

  handler({
    params: {
      publicationId: "../PUB-2026-0001"
    }
  }, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    success: false,
    error: "Invalid publicationId"
  });
  assert.equal(joins, 0);
  assert.equal(existsChecks, 0);
  assert.equal(reads, 0);
});

test("GET /api/crosswords/:crosswordId/publications returns matching Publications", () => {
  const handler = createCrosswordPublicationsListHandler({
    fsModule: createPublicationFs({
      "late.json": {
        ...validPublication,
        publicationId: "PUB-LATE",
        publishDate: "2026-07-22"
      },
      "early.json": {
        ...validPublication,
        publicationId: "PUB-EARLY",
        publishDate: "2026-07-20"
      },
      "other.json": {
        ...validPublication,
        publicationId: "PUB-OTHER",
        crosswordId: "TT-2026-OTHER",
        publishDate: "2026-07-19"
      }
    }),
    pathModule: createPathModule(),
    publicationStorageDir: "/publications"
  });
  const res = createResponse();

  handler({
    params: {
      crosswordId: "TT-2026-0001"
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.map(publication => publication.publicationId), [
    "PUB-EARLY",
    "PUB-LATE"
  ]);
});

test("GET /api/crosswords/:crosswordId/publications returns an empty list", () => {
  const handler = createCrosswordPublicationsListHandler({
    fsModule: {
      existsSync() {
        return false;
      }
    },
    pathModule: createPathModule(),
    publicationStorageDir: "/publications"
  });
  const res = createResponse();

  handler({
    params: {
      crosswordId: "TT-2026-0001"
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, []);
});

test("GET /api/crosswords/:crosswordId/publications rejects invalid crosswordId before reading", () => {
  let existsChecks = 0;
  let reads = 0;
  const handler = createCrosswordPublicationsListHandler({
    fsModule: {
      existsSync() {
        existsChecks += 1;
        return true;
      },
      readdirSync() {
        throw new Error("directory should not be read");
      },
      readFileSync() {
        reads += 1;
        return "{}";
      }
    },
    pathModule: createPathModule()
  });
  const res = createResponse();

  handler({
    params: {
      crosswordId: "../TT-2026-0001"
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

function savePublication(body) {
  const writes = [];
  const handler = createPublicationSaveHandler({
    fsModule: {
      mkdirSync() {},
      writeFileSync(...args) {
        writes.push(args);
      }
    },
    pathModule: createPathModule(),
    publicationStorageDir: "/publications"
  });
  const res = createResponse();

  handler({ body }, res);

  return { writes, res };
}

function createPathModule() {
  return {
    join(...parts) {
      return parts.join("/");
    }
  };
}

function createPublicationFs(files) {
  return {
    existsSync(filePath) {
      return filePath === "/publications"
        || Object.prototype.hasOwnProperty.call(files, filePath);
    },
    readdirSync() {
      return Object.keys(files);
    },
    readFileSync(filePath) {
      const fileName = filePath.replace("/publications/", "");
      return JSON.stringify(files[fileName]);
    }
  };
}

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
