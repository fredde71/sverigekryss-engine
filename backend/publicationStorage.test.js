const assert = require("node:assert/strict");
const test = require("node:test");
const {
  getPublicationFilePath,
  listPublicationsByCrosswordId,
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

test("writePublication generates publicationId when missing", () => {
  const writes = [];
  const publication = writePublication({
    ...validPublication,
    publicationId: ""
  }, {
    fsModule: {
      mkdirSync() {},
      writeFileSync(...args) {
        writes.push(args);
      }
    },
    pathModule: createPathModule(),
    publicationStorageDir: "/publications",
    generatePublicationId: () => "pub-20260720102030-abc123"
  });

  assert.equal(publication.publicationId, "pub-20260720102030-abc123");
  assert.equal(
    publication.url,
    "https://example.com/play/pub-20260720102030-abc123"
  );
  assert.equal(writes[0][0], "/publications/pub-20260720102030-abc123.json");

  const savedPublication = JSON.parse(writes[0][1]);

  assert.equal(savedPublication.crosswordId, "TT-2026-0001");
  assert.equal(
    savedPublication.url,
    "https://example.com/play/pub-20260720102030-abc123"
  );
});

test("writePublication preserves explicit publicationId URL", () => {
  const writes = [];
  const publication = writePublication(validPublication, {
    fsModule: {
      mkdirSync() {},
      writeFileSync(...args) {
        writes.push(args);
      }
    },
    pathModule: createPathModule(),
    publicationStorageDir: "/publications"
  });

  assert.equal(publication.publicationId, "PUB-2026-0001");
  assert.equal(publication.url, "https://example.com/play/PUB-2026-0001");
  assert.equal(
    JSON.parse(writes[0][1]).url,
    "https://example.com/play/PUB-2026-0001"
  );
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

test("listPublicationsByCrosswordId returns matching Publications sorted by date then id", () => {
  const publications = listPublicationsByCrosswordId("TT-2026-0001", {
    fsModule: createPublicationFs({
      "beta.json": {
        ...validPublication,
        publicationId: "PUB-B",
        publishDate: "2026-07-22"
      },
      "alpha.json": {
        ...validPublication,
        publicationId: "PUB-A",
        publishDate: "2026-07-20"
      },
      "no-date-b.json": {
        ...validPublication,
        publicationId: "PUB-NO-DATE-B",
        publishDate: ""
      },
      "no-date-a.json": {
        ...validPublication,
        publicationId: "PUB-NO-DATE-A",
        publishDate: ""
      },
      "other-crossword.json": {
        ...validPublication,
        publicationId: "PUB-OTHER",
        crosswordId: "TT-2026-OTHER",
        publishDate: "2026-07-19"
      },
      "notes.txt": {
        ignored: true
      }
    }),
    pathModule: createPathModule(),
    publicationStorageDir: "/publications"
  });

  assert.deepEqual(publications.map(publication => publication.publicationId), [
    "PUB-A",
    "PUB-B",
    "PUB-NO-DATE-A",
    "PUB-NO-DATE-B"
  ]);
});

test("listPublicationsByCrosswordId returns empty list when directory is missing", () => {
  const publications = listPublicationsByCrosswordId("TT-2026-0001", {
    fsModule: {
      existsSync() {
        return false;
      }
    },
    pathModule: createPathModule(),
    publicationStorageDir: "/publications"
  });

  assert.deepEqual(publications, []);
});

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
