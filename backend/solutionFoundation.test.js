const assert = require("node:assert/strict");
const test = require("node:test");
const {
  projectPublicationForAccess
} = require("./publicationAccess");
const {
  publishPublicationHelpAccess,
  readPublication,
  writePublication
} = require("./publicationStorage");
const {
  createHelpAccessToken,
  normalizeHelpAccessToken
} = require("./helpAccessToken");

const HELP_TOKEN = "abcdefghijklmnopqrstuvwxyzABCDEFGH123456789";

test("help access tokens are unguessable storage capabilities", () => {
  const first = createHelpAccessToken();
  const second = createHelpAccessToken();

  assert.equal(normalizeHelpAccessToken(first), first);
  assert.equal(first.length, 43);
  assert.notEqual(first, second);
});

const publication = {
  publicationId: "PUB-SOLUTION-1",
  crosswordId: "TT-SOLUTION-1",
  status: "published",
  url: "https://wordex.example/play/PUB-SOLUTION-1",
  crosswordSnapshot: {
    type: "crossword-snapshot",
    version: 1,
    crosswordId: "TT-SOLUTION-1",
    template: {
      crosswordId: "TT-SOLUTION-1",
      crosswordType: "sverigekryss",
      rows: 1,
      cols: 3,
      cellTypes: ["blocked", "write", "write"],
      gridArea: { top: 0, left: 0, width: 300, height: 100 },
      imageSrc: "",
      answerPaths: [{
        clueIndex: 0,
        paths: [{
          direction: "across",
          cellIndexes: [1, 2],
          solution: "AB"
        }]
      }]
    }
  }
};

test("Publication storage round-trip preserves one immutable crossword snapshot", () => {
  const files = new Map();
  const fsModule = createFs(files);
  const pathModule = createPath();

  const saved = writePublication(publication, {
    fsModule,
    pathModule,
    publicationStorageDir: "/publications",
    generateHelpAccessToken: () => HELP_TOKEN
  });
  const loaded = readPublication(publication.publicationId, {
    fsModule,
    pathModule,
    publicationStorageDir: "/publications"
  });

  assert.equal(
    loaded.crosswordSnapshot.template.answerPaths[0].paths[0].solution,
    "AB"
  );
  assert.equal(loaded.crosswordSnapshot.crosswordId, publication.crosswordId);
  assert.equal(saved.helpAccessToken, HELP_TOKEN);
  assert.equal(saved.helpAccessStatus, "inactive");
  assert.equal(loaded.helpAccessToken, HELP_TOKEN);

  const changedSnapshot = structuredClone(publication);
  changedSnapshot.crosswordSnapshot.template.answerPaths[0].paths[0].solution = "CD";
  assert.throws(() => writePublication(changedSnapshot, {
    fsModule,
    pathModule,
    publicationStorageDir: "/publications"
  }), /crosswordSnapshot is immutable/);
});

test("only the stored help capability projects solutions from the same Publication", () => {
  const capablePublication = {
    ...publication,
    helpAccessToken: HELP_TOKEN,
    helpAccessStatus: "active"
  };
  const solve = projectPublicationForAccess(capablePublication, null);
  const modeOnly = projectPublicationForAccess(capablePublication, "help");
  const invalid = projectPublicationForAccess(capablePublication, "wrong");
  const help = projectPublicationForAccess(capablePublication, HELP_TOKEN);

  assert.equal(solve.publicationId, help.publicationId);
  assert.equal(solve.access.capabilities.useCanonicalSolutions, false);
  assert.equal(modeOnly.access.capabilities.useCanonicalSolutions, false);
  assert.equal(invalid.access.capabilities.useCanonicalSolutions, false);
  assert.equal(help.access.capabilities.useCanonicalSolutions, true);
  assert.equal(
    Object.hasOwn(
      solve.crosswordSnapshot.template.answerPaths[0].paths[0],
      "solution"
    ),
    false
  );
  assert.equal(
    help.crosswordSnapshot.template.answerPaths[0].paths[0].solution,
    "AB"
  );
  assert.equal(Object.hasOwn(help, "helpAccessToken"), false);
});

test("valid token remains solve-only until facit is explicitly published", () => {
  const files = new Map();
  const fsModule = createFs(files);
  const pathModule = createPath();
  const saved = writePublication(publication, {
    fsModule,
    pathModule,
    publicationStorageDir: "/publications",
    generateHelpAccessToken: () => HELP_TOKEN
  });

  assert.equal(
    projectPublicationForAccess(saved, HELP_TOKEN).access.mode,
    "solve"
  );

  const activated = publishPublicationHelpAccess(publication.publicationId, {
    fsModule,
    pathModule,
    publicationStorageDir: "/publications"
  });

  assert.equal(activated.helpAccessStatus, "active");
  assert.equal(activated.helpAccessToken, HELP_TOKEN);
  assert.equal(
    projectPublicationForAccess(activated, HELP_TOKEN).access.mode,
    "help"
  );
});

test("incomplete solutions allow solve publication but do not create help capability", () => {
  const files = new Map();
  const incomplete = structuredClone(publication);
  incomplete.crosswordSnapshot.template.answerPaths[0].paths[0].solution = "A";

  const saved = writePublication(incomplete, {
    fsModule: createFs(files),
    pathModule: createPath(),
    publicationStorageDir: "/publications",
    generateHelpAccessToken: () => HELP_TOKEN
  });

  assert.equal(saved.publicationId, publication.publicationId);
  assert.equal(Object.hasOwn(saved, "helpAccessToken"), false);
  assert.equal(
    saved.crosswordSnapshot.template.answerPaths[0].paths[0].solution,
    "A"
  );
  assert.throws(() => publishPublicationHelpAccess(
    incomplete.publicationId,
    {
      fsModule: createFs(files),
      pathModule: createPath(),
      publicationStorageDir: "/publications"
    }
  ), /Complete valid solutions are required/);
});

test("crossing conflicts block help capability generation", () => {
  const files = new Map();
  const conflicting = structuredClone(publication);
  conflicting.crosswordSnapshot.template.rows = 2;
  conflicting.crosswordSnapshot.template.cols = 3;
  conflicting.crosswordSnapshot.template.cellTypes = [
    "blocked", "write", "write", "blocked", "write", "empty"
  ];
  conflicting.crosswordSnapshot.template.answerPaths.push({
    clueIndex: 3,
    paths: [{
      direction: "down",
      cellIndexes: [1, 4],
      solution: "ZX"
    }]
  });

  const saved = writePublication(conflicting, {
    fsModule: createFs(files),
    pathModule: createPath(),
    publicationStorageDir: "/publications",
    generateHelpAccessToken: () => HELP_TOKEN
  });

  assert.equal(Object.hasOwn(saved, "helpAccessToken"), false);
});

function createFs(files) {
  return {
    existsSync(filePath) {
      return files.has(filePath);
    },
    mkdirSync() {},
    readFileSync(filePath) {
      return files.get(filePath);
    },
    writeFileSync(filePath, contents) {
      files.set(filePath, contents);
    }
  };
}

function createPath() {
  return {
    join(...parts) {
      return parts.join("/");
    }
  };
}
