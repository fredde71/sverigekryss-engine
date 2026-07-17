const assert = require("node:assert/strict");
const test = require("node:test");
const { createCorsMiddleware } = require("./corsConfig");

test("configured allowed origin succeeds", async () => {
  const server = await startTestServer({
    ALLOWED_ORIGINS: "https://wordex.example"
  });

  const response = await request(server, {
    origin: "https://wordex.example"
  });

  assert.equal(response.nextCalled, true);
  assert.equal(
    response.headers["access-control-allow-origin"],
    "https://wordex.example"
  );
});

test("configured unknown origin is rejected", async () => {
  const server = await startTestServer({
    ALLOWED_ORIGINS: "https://wordex.example"
  });

  const response = await request(server, {
    origin: "https://unknown.example"
  });

  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.body, {
    success: false,
    error: "Origin not allowed"
  });
  assert.equal(response.nextCalled, false);
});

test("request without Origin succeeds", async () => {
  const server = await startTestServer({
    ALLOWED_ORIGINS: "https://wordex.example"
  });

  const response = await request(server);

  assert.equal(response.nextCalled, true);
});

test("missing ALLOWED_ORIGINS preserves development behavior", async () => {
  const server = await startTestServer({});

  const response = await request(server, {
    origin: "https://any-origin.example"
  });

  assert.equal(response.nextCalled, true);
  assert.equal(response.headers["access-control-allow-origin"], "*");
});

test("comma-separated origins and whitespace are handled correctly", async () => {
  const server = await startTestServer({
    ALLOWED_ORIGINS: " https://one.example, , https://two.example "
  });

  const response = await request(server, {
    origin: "https://two.example"
  });

  assert.equal(response.nextCalled, true);
  assert.equal(
    response.headers["access-control-allow-origin"],
    "https://two.example"
  );
});

function startTestServer(env) {
  return createCorsMiddleware(env);
}

function request(middleware, options = {}) {
  const response = createResponse();
  const req = {
    headers: options.origin ? { origin: options.origin } : {},
    method: "GET"
  };

  return new Promise((resolve, reject) => {
    middleware(req, response, err => {
      if (err) {
        reject(err);
        return;
      }

      response.nextCalled = true;
      resolve(response);
    });

    if (response.finished) {
      resolve(response);
    }
  });
}

function createResponse() {
  return {
    headers: {},
    statusCode: 200,
    nextCalled: false,
    finished: false,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    getHeader(name) {
      return this.headers[name.toLowerCase()];
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      this.finished = true;
      return this;
    }
  };
}
