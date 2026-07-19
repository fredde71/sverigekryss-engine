const assert = require("node:assert/strict");
const test = require("node:test");
const { createSubmissionHandler } = require("./server");

const validSubmission = {
  templateId: "TT-2026-0001",
  name: "Anna Andersson",
  email: "anna@example.com",
  phone: "0701234567",
  solution: "ABCDEF"
};

test("submission endpoint saves required fields with submittedAt", () => {
  const { writes, res } = submit(validSubmission);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    success: true
  });
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], "/submissions/TT-2026-0001.json");

  const savedSubmissions = JSON.parse(writes[0][1]);

  assert.deepEqual(savedSubmissions, [
    {
      ...validSubmission,
      submittedAt: "2026-07-19T10:20:30.000Z"
    }
  ]);
});

test("submission endpoint appends to existing submissions", () => {
  const existingSubmission = {
    templateId: "TT-2026-0001",
    name: "Existing",
    email: "existing@example.com",
    phone: "0700000000",
    solution: "AAAAAA",
    submittedAt: "2026-07-18T10:20:30.000Z"
  };
  const { writes, res } = submit(validSubmission, {
    existingFiles: {
      "/submissions/TT-2026-0001.json": JSON.stringify([existingSubmission])
    }
  });

  assert.equal(res.statusCode, 200);

  const savedSubmissions = JSON.parse(writes[0][1]);

  assert.deepEqual(savedSubmissions, [
    existingSubmission,
    {
      ...validSubmission,
      submittedAt: "2026-07-19T10:20:30.000Z"
    }
  ]);
});

test("submission endpoint trims string fields before saving", () => {
  const { writes } = submit({
    templateId: " TT-2026-0001 ",
    name: " Anna Andersson ",
    email: " anna@example.com ",
    phone: " 0701234567 ",
    solution: " ABCDEF "
  });
  const savedSubmission = JSON.parse(writes[0][1])[0];

  assert.deepEqual(savedSubmission, {
    ...validSubmission,
    submittedAt: "2026-07-19T10:20:30.000Z"
  });
});

test("submission endpoint requires templateId", () => {
  assertInvalidSubmission({
    ...validSubmission,
    templateId: ""
  }, "Missing templateId");
});

test("submission endpoint rejects unsafe templateId", () => {
  assertInvalidSubmission({
    ...validSubmission,
    templateId: "../TT-2026-0001"
  }, "Invalid templateId");
});

test("submission endpoint requires name", () => {
  assertInvalidSubmission({
    ...validSubmission,
    name: " "
  }, "Missing name");
});

test("submission endpoint requires email", () => {
  assertInvalidSubmission({
    ...validSubmission,
    email: ""
  }, "Missing email");
});

test("submission endpoint requires phone", () => {
  assertInvalidSubmission({
    ...validSubmission,
    phone: undefined
  }, "Missing phone");
});

test("submission endpoint requires solution", () => {
  assertInvalidSubmission({
    ...validSubmission,
    solution: ""
  }, "Missing solution");
});

test("submission endpoint requires solution to be exactly 6 characters", () => {
  assertInvalidSubmission({
    ...validSubmission,
    solution: "ABCDE"
  }, "Invalid solution");

  assertInvalidSubmission({
    ...validSubmission,
    solution: "ABCDEFG"
  }, "Invalid solution");
});

test("invalid submission does not construct paths or write files", () => {
  const writes = [];
  let joins = 0;
  const handler = createSubmissionHandler({
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
      ...validSubmission,
      templateId: "../TT-2026-0001"
    }
  }, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(writes, []);
  assert.equal(joins, 0);
});

function assertInvalidSubmission(body, error) {
  const { writes, res } = submit(body);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    success: false,
    error
  });
  assert.deepEqual(writes, []);
}

function submit(body, options = {}) {
  const writes = [];
  const existingFiles = options.existingFiles || {};
  const handler = createSubmissionHandler({
    fsModule: {
      existsSync(filePath) {
        return Object.prototype.hasOwnProperty.call(existingFiles, filePath);
      },
      readFileSync(filePath) {
        return existingFiles[filePath];
      },
      writeFileSync(...args) {
        writes.push(args);
      }
    },
    pathModule: createPathModule(),
    submissionStorageDir: "/submissions",
    now: () => new Date("2026-07-19T10:20:30.000Z")
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
