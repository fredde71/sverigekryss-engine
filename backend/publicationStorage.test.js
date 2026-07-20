const assert = require("node:assert/strict");
const test = require("node:test");
const {
  getPublicationFilePath,
  readPublication,
  writePublication
} = require("./publicationStorage");

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
    views: 10
  }
};

test("getPublicationFilePath stores publications by publicationId", () => {
  assert.equal(
    getPublicationFilePath(" PUB-2026-0001 ", {
      pathModule: createPathModule(),
      publicationStorageDir: "/publications"
    }),
    "/publications/PUB-2026-0001.json"
  );
});

test("writePublication writes normalized Publication JSON", () => {
  const writes = [];
  const madeDirs = [];
  const publication = writePublication({
    ...validPublication,
    publicationId: " PUB-2026-0001 "
  }, {
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

  assert.deepEqual(madeDirs, [
    ["/publications", { recursive: true }]
  ]);
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], "/publications/PUB-2026-0001.json");
  assert.deepEqual(JSON.parse(writes[0][1]), publication);
  assert.equal(publication.publicationId, "PUB-2026-0001");
});

test("readPublication returns normalized Publication data", () => {
  const publication = readPublication("PUB-2026-0001", {
    fsModule: {
      existsSync() {
        return true;
      },
      readFileSync() {
        return JSON.stringify({
          ...validPublication,
          status: " published "
        });
      }
    },
    pathModule: createPathModule(),
    publicationStorageDir: "/publications"
  });

  assert.deepEqual(publication, {
    ...validPublication,
    status: "published"
  });
});

test("readPublication returns null when the Publication file is missing", () => {
  const publication = readPublication("PUB-2026-0001", {
    fsModule: {
      existsSync() {
        return false;
      }
    },
    pathModule: createPathModule(),
    publicationStorageDir: "/publications"
  });

  assert.equal(publication, null);
});

test("invalid publicationId does not construct paths or read files", () => {
  let joins = 0;
  let reads = 0;

  assert.throws(() => readPublication("../PUB-2026", {
    fsModule: {
      existsSync() {
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
  }), /Invalid publicationId/);

  assert.equal(joins, 0);
  assert.equal(reads, 0);
});

test("invalid publication does not create directories or write files", () => {
  let madeDirs = 0;
  let writes = 0;

  assert.throws(() => writePublication({
    ...validPublication,
    publicationId: "../PUB-2026"
  }, {
    fsModule: {
      mkdirSync() {
        madeDirs += 1;
      },
      writeFileSync() {
        writes += 1;
      }
    },
    pathModule: {
      join() {
        throw new Error("path should not be constructed");
      }
    }
  }), /Invalid publicationId/);

  assert.equal(madeDirs, 0);
  assert.equal(writes, 0);
});

function createPathModule() {
  return {
    join(...parts) {
      return parts.join("/");
    }
  };
}
