const { helpAccessTokensMatch } = require("./helpAccessToken");
const {
  hasCompleteTemplateSolutions
} = require("./templateSolutionCompleteness");

const ACCESS_MODES = Object.freeze({
  SOLVE: "solve",
  HELP: "help"
});

function createPublicationAccess(helpAccessGranted = false) {
  const normalizedMode = helpAccessGranted
    ? ACCESS_MODES.HELP
    : ACCESS_MODES.SOLVE;

  return {
    type: "publication-access",
    version: 1,
    mode: normalizedMode,
    capabilities: {
      useCanonicalSolutions: normalizedMode === ACCESS_MODES.HELP
    }
  };
}

function projectPublicationForAccess(publication, presentedHelpAccessToken) {
  const helpAccessGranted = helpAccessTokensMatch(
    publication.helpAccessToken,
    presentedHelpAccessToken
  ) && publication.helpAccessStatus === "active"
    && hasCompleteTemplateSolutions(publication.crosswordSnapshot?.template);
  const access = createPublicationAccess(helpAccessGranted);
  const snapshot = publication.crosswordSnapshot;
  const { helpAccessToken, ...publicPublication } = publication;

  return {
    ...publicPublication,
    access,
    ...(snapshot ? {
      crosswordSnapshot: {
        ...snapshot,
        template: access.capabilities.useCanonicalSolutions
          ? snapshot.template
          : stripTemplateSolutions(snapshot.template)
      }
    } : {})
  };
}

function stripTemplateSolutions(template) {
  return {
    ...template,
    ...(Array.isArray(template.answerPaths) ? {
      answerPaths: template.answerPaths.map(entry => ({
        ...entry,
        paths: entry.paths.map(({ solution, ...path }) => ({
          ...path,
          cellIndexes: [...path.cellIndexes]
        }))
      }))
    } : {}),
    ...(template.musikkryss && Array.isArray(template.musikkryss.answers) ? {
      musikkryss: {
        ...template.musikkryss,
        answers: template.musikkryss.answers.map(({ solution, ...answer }) => ({
          ...answer,
          answerPath: [...answer.answerPath],
          contentSequence: answer.contentSequence.map(entry => ({ ...entry }))
        }))
      }
    } : {})
  };
}

module.exports = {
  ACCESS_MODES,
  createPublicationAccess,
  projectPublicationForAccess
};
