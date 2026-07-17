const assert = require("node:assert/strict");
const test = require("node:test");
const { parseImageDataUrl } = require("./imageDataUrl");
const { createPublishHandler } = require("./server");

test("parseImageDataUrl parses PNG image data", () => {
  const parsed = parseImageDataUrl("data:image/png;base64,AAAA");

  assert.equal(parsed.mimeType, "image/png");
  assert.equal(parsed.extension, "png");
  assert.equal(Buffer.isBuffer(parsed.buffer), true);
});

test("parseImageDataUrl parses JPEG image data", () => {
  const parsed = parseImageDataUrl("data:image/jpeg;base64,AAAA");

  assert.equal(parsed.mimeType, "image/jpeg");
  assert.equal(parsed.extension, "jpg");
  assert.equal(Buffer.isBuffer(parsed.buffer), true);
});

test("parseImageDataUrl parses WebP image data", () => {
  const parsed = parseImageDataUrl("data:image/webp;base64,AAAA");

  assert.equal(parsed.mimeType, "image/webp");
  assert.equal(parsed.extension, "webp");
  assert.equal(Buffer.isBuffer(parsed.buffer), true);
});

test("parseImageDataUrl ignores non-data URLs", () => {
  assert.equal(
    parseImageDataUrl("https://backend.example/uploads/TT-2026-0001.png"),
    null
  );
});

test("parseImageDataUrl rejects malformed image data URLs", () => {
  assert.throws(
    () => parseImageDataUrl("data:image/png,AAAA"),
    /Invalid image data/
  );
});

test("parseImageDataUrl rejects empty payloads", () => {
  assert.throws(
    () => parseImageDataUrl("data:image/png;base64,"),
    /Invalid image data/
  );
});

test("parseImageDataUrl rejects unsupported image MIME types", () => {
  assert.throws(
    () => parseImageDataUrl("data:image/gif;base64,AAAA"),
    /Invalid image data/
  );
});

test("parseImageDataUrl rejects invalid base64 characters", () => {
  assert.throws(
    () => parseImageDataUrl("data:image/png;base64,AA A="),
    /Invalid image data/
  );
});

test("PNG publish writes a Buffer to .png", () => {
  const { writes, res } = publish({
    crosswordId: "TT-2026-0001",
    imageSrc: "data:image/png;base64,AAAA"
  });

  assert.equal(res.statusCode, 200);
  assert.equal(writes[0][0], "/uploads/TT-2026-0001.png");
  assert.equal(Buffer.isBuffer(writes[0][1]), true);
  assert.equal(writes[0][2], undefined);
});

test("JPEG publish writes a Buffer to .jpg", () => {
  const { writes, res } = publish({
    crosswordId: "TT-2026-0001",
    imageSrc: "data:image/jpeg;base64,AAAA"
  });

  assert.equal(res.statusCode, 200);
  assert.equal(writes[0][0], "/uploads/TT-2026-0001.jpg");
  assert.equal(Buffer.isBuffer(writes[0][1]), true);
});

test("WebP publish writes a Buffer to .webp", () => {
  const { writes, res } = publish({
    crosswordId: "TT-2026-0001",
    imageSrc: "data:image/webp;base64,AAAA"
  });

  assert.equal(res.statusCode, 200);
  assert.equal(writes[0][0], "/uploads/TT-2026-0001.webp");
  assert.equal(Buffer.isBuffer(writes[0][1]), true);
});

test("saved public image URL matches the image extension", () => {
  const { writes } = publish({
    crosswordId: "TT-2026-0001",
    imageSrc: "data:image/jpeg;base64,AAAA"
  });
  const savedTemplate = JSON.parse(writes[1][1]);

  assert.equal(
    savedTemplate.imageSrc,
    "https://backend.example/uploads/TT-2026-0001.jpg"
  );
});

test("non-data URL is preserved and causes no image write", () => {
  const { writes, res } = publish({
    crosswordId: "TT-2026-0001",
    imageSrc: "https://backend.example/uploads/existing.png"
  });
  const savedTemplate = JSON.parse(writes[0][1]);

  assert.equal(res.statusCode, 200);
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], "/templates/TT-2026-0001.json");
  assert.equal(
    savedTemplate.imageSrc,
    "https://backend.example/uploads/existing.png"
  );
});

test("malformed data URL returns 400", () => {
  assertInvalidImagePublish("data:image/png,AAAA");
});

test("empty image payload returns 400", () => {
  assertInvalidImagePublish("data:image/png;base64,");
});

test("unsupported image MIME returns 400", () => {
  assertInvalidImagePublish("data:image/gif;base64,AAAA");
});

test("invalid base64 characters return 400", () => {
  assertInvalidImagePublish("data:image/png;base64,AA A=");
});

test("valid image publish writes image before template", () => {
  const { writes } = publish({
    crosswordId: "TT-2026-0001",
    imageSrc: "data:image/png;base64,AAAA"
  });

  assert.equal(writes[0][0], "/uploads/TT-2026-0001.png");
  assert.equal(writes[1][0], "/templates/TT-2026-0001.json");
});

test("image write failure does not write template", () => {
  const writes = [];
  const handler = createPublishHandler({
    fsModule: {
      writeFileSync(...args) {
        writes.push(args);

        if (writes.length === 1) {
          throw new Error("image write failed");
        }
      }
    },
    pathModule: createPathModule(),
    templateStorageDir: "/templates",
    uploadStorageDir: "/uploads",
    publicBackendBaseUrl: "https://backend.example"
  });
  const res = createResponse();

  const originalConsoleError = console.error;

  console.error = () => {};

  try {
    handler({
      body: {
        crosswordId: "TT-2026-0001",
        imageSrc: "data:image/png;base64,AAAA"
      }
    }, res);
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, {
    success: false,
    error: "Failed to save template"
  });
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], "/uploads/TT-2026-0001.png");
});

test("crosswordId validation happens before image parsing and writes", () => {
  const writes = [];
  const handler = createPublishHandler({
    fsModule: {
      writeFileSync(...args) {
        writes.push(args);
      }
    },
    pathModule: createPathModule(),
    templateStorageDir: "/templates",
    uploadStorageDir: "/uploads",
    publicBackendBaseUrl: "https://backend.example"
  });
  const res = createResponse();

  handler({
    body: {
      crosswordId: "../TT-2026-0001",
      imageSrc: "data:image/png;base64,"
    }
  }, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    success: false,
    error: "Invalid crosswordId"
  });
  assert.deepEqual(writes, []);
});

test("existing publish behavior without image data remains intact", () => {
  const { writes, res } = publish({
    crosswordId: "TT-2026-0001",
    rows: 10,
    cols: 10
  });
  const savedTemplate = JSON.parse(writes[0][1]);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    success: true,
    savedAs: "TT-2026-0001.json"
  });
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], "/templates/TT-2026-0001.json");
  assert.equal(savedTemplate.crosswordId, "TT-2026-0001");
  assert.equal(savedTemplate.rows, 10);
  assert.equal(savedTemplate.cols, 10);
});

function assertInvalidImagePublish(imageSrc) {
  const { writes, res } = publish({
    crosswordId: "TT-2026-0001",
    imageSrc
  });

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    success: false,
    error: "Invalid image data"
  });
  assert.deepEqual(writes, []);
}

function publish(template) {
  const writes = [];
  const handler = createPublishHandler({
    fsModule: {
      writeFileSync(...args) {
        writes.push(args);
      }
    },
    pathModule: createPathModule(),
    templateStorageDir: "/templates",
    uploadStorageDir: "/uploads",
    publicBackendBaseUrl: "https://backend.example"
  });
  const res = createResponse();

  handler({ body: template }, res);

  return { writes, res };
}

function createPathModule() {
  return {
    join(...parts) {
      return parts.join("/");
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
