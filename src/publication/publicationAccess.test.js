import { createTemplate } from "../template/templateModel";
import { createCrosswordSnapshot } from "./crosswordSnapshot";
import {
  createPublicationAccess,
  createPublicationAccessLinks,
  getPublicationHelpAccessToken,
  projectPublicationForAccess
} from "./publicationAccess";

const HELP_TOKEN = "abcdefghijklmnopqrstuvwxyzABCDEFGH123456789";

const template = createTemplate({
  crosswordId: "TT-ACCESS-1",
  rows: 1,
  cols: 3,
  cellTypes: ["blocked", "write", "write"],
  documentSize: { width: 300, height: 100 },
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
});
const publication = {
  publicationId: "PUB-ACCESS-1",
  crosswordId: template.crosswordId,
  url: "https://wordex.example/play/PUB-ACCESS-1",
  helpAccessToken: HELP_TOKEN,
  helpAccessStatus: "active",
  crosswordSnapshot: createCrosswordSnapshot(template)
};

test("one Publication derives solve and help links from the same identity", () => {
  expect(createPublicationAccessLinks(publication)).toEqual({
    publicationId: "PUB-ACCESS-1",
    solveUrl: "https://wordex.example/play/PUB-ACCESS-1",
    helpUrl: `https://wordex.example/play/PUB-ACCESS-1?helpAccessToken=${HELP_TOKEN}`
  });
});

test("solve access cannot use or receive canonical solutions", () => {
  const access = createPublicationAccess(false);
  const projected = projectPublicationForAccess(publication, "");

  expect(access.capabilities.useCanonicalSolutions).toBe(false);
  expect(projected.access.mode).toBe("solve");
  expect(projected.crosswordSnapshot.template.answerPaths[0].paths[0])
    .not.toHaveProperty("solution");
  expect(publication.crosswordSnapshot.template.answerPaths[0].paths[0].solution)
    .toBe("AB");
});

test("only the unguessable help capability retains canonical solutions", () => {
  const projected = projectPublicationForAccess(publication, HELP_TOKEN);

  expect(projected.access).toEqual({
    type: "publication-access",
    version: 1,
    mode: "help",
    capabilities: {
      useCanonicalSolutions: true
    }
  });
  expect(projected.crosswordSnapshot.template.answerPaths[0].paths[0].solution)
    .toBe("AB");
  expect(projected).not.toHaveProperty("helpAccessToken");
});

test("mode=help and invalid tokens remain solve access", () => {
  expect(getPublicationHelpAccessToken("?mode=help")).toBe("");

  for (const token of ["", "help", "wrong-token"]) {
    const projected = projectPublicationForAccess(publication, token);
    expect(projected.access.mode).toBe("solve");
    expect(projected.crosswordSnapshot.template.answerPaths[0].paths[0])
      .not.toHaveProperty("solution");
  }
});

test("valid token remains solve access before explicit facit publication", () => {
  const projected = projectPublicationForAccess({
    ...publication,
    helpAccessStatus: "inactive"
  }, HELP_TOKEN);

  expect(projected.access.mode).toBe("solve");
  expect(projected.crosswordSnapshot.template.answerPaths[0].paths[0])
    .not.toHaveProperty("solution");
  expect(createPublicationAccessLinks({
    ...publication,
    helpAccessStatus: "inactive"
  }).helpUrl).toBe("");
});

test("help link remains unavailable while canonical solutions are incomplete", () => {
  const incomplete = {
    ...publication,
    crosswordSnapshot: createCrosswordSnapshot(createTemplate({
      ...template,
      answerPaths: [{
        clueIndex: 0,
        paths: [{
          direction: "across",
          cellIndexes: [1, 2],
          solution: "A"
        }]
      }]
    }))
  };

  expect(createPublicationAccessLinks(incomplete).helpUrl).toBe("");
});
