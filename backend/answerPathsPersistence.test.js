const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createLoadHandler,
  createPublishHandler
} = require("./server");

test("backend publish and load preserve ordered answer paths unchanged", () => {
  const files = new Map();
  const fsModule = {
    existsSync(filePath) {
      return files.has(filePath);
    },
    readFileSync(filePath) {
      return files.get(filePath);
    },
    writeFileSync(filePath, contents) {
      files.set(filePath, contents);
    }
  };
  const pathModule = {
    join(...parts) {
      return parts.join("/");
    }
  };
  const answerPaths = [{
    clueIndex: 0,
    paths: [{
      direction: "across",
      cellIndexes: [1, 2, 6, 10, 9]
    }]
  }];
  const template = {
    crosswordId: "TT-2026-0003",
    rows: 3,
    cols: 4,
    cellTypes: [
      "blocked", "write", "write", "empty",
      "empty", "empty", "write", "empty",
      "empty", "write", "write", "empty"
    ],
    gridArea: {},
    imageSrc: "",
    answerPaths
  };
  const publishResponse = createResponse();

  createPublishHandler({
    fsModule,
    pathModule,
    templateStorageDir: "/templates",
    uploadStorageDir: "/uploads"
  })({ body: structuredClone(template) }, publishResponse);

  assert.equal(publishResponse.statusCode, 200);

  const loadResponse = createResponse();
  createLoadHandler({
    fsModule,
    pathModule,
    templateStorageDir: "/templates"
  })({ params: { id: template.crosswordId } }, loadResponse);

  assert.equal(loadResponse.statusCode, 200);
  assert.deepEqual(loadResponse.body.answerPaths, answerPaths);
  assert.equal(loadResponse.headers.get("Cache-Control"), "no-store");
});

test("backend load keeps legacy templates without answer paths unchanged", () => {
  const stored = JSON.stringify({
    crosswordId: "TT-2026-0004",
    rows: 1,
    cols: 1,
    cellTypes: ["write"],
    gridArea: {},
    imageSrc: ""
  });
  const loadResponse = createResponse();

  createLoadHandler({
    fsModule: {
      existsSync() {
        return true;
      },
      readFileSync() {
        return stored;
      }
    },
    pathModule: {
      join(...parts) {
        return parts.join("/");
      }
    },
    templateStorageDir: "/templates"
  })({ params: { id: "TT-2026-0004" } }, loadResponse);

  assert.equal(loadResponse.statusCode, 200);
  assert.equal(Object.hasOwn(loadResponse.body, "answerPaths"), false);
});

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    headers: new Map(),
    setHeader(name, value) {
      this.headers.set(name, value);
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}
