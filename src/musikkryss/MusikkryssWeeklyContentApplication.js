import { getMusikkryssFormat } from "./MusikkryssFormatCatalog";
import { createMusikkryssTemplate } from "./MusikkryssTemplateInitializer";
import { CELL_TYPE_BLACK } from "../template/cellTypes";

export function applyMusikkryssWeeklyContentImport({
  session,
  importResult,
  formatCatalog
}) {
  if (session?.crosswordType !== "musikkryss") {
    return notApplied(session, "not-musikkryss-session");
  }
  if (importResult?.status !== "valid" || !importResult.content) {
    return notApplied(session, "invalid-import");
  }

  const format = getMusikkryssFormat(
    importResult.content.formatId,
    formatCatalog
  );
  if (!format) {
    return notApplied(session, "unknown-format", {
      importedFormatId: importResult.content.formatId
    });
  }

  const hasOwnedStructure = hasSessionDocumentOrGrid(session);
  const activeFormatId = session.musikkryss?.formatId;
  if (hasOwnedStructure && activeFormatId !== format.id) {
    return notApplied(session, "format-mismatch", {
      activeFormatId: activeFormatId || "",
      importedFormatId: format.id
    });
  }

  if (hasOwnedStructure && !hasCompatibleFormatStructure(session, format)) {
    return notApplied(session, "incompatible-format-structure", {
      importedFormatId: format.id
    });
  }

  const baseSession = hasOwnedStructure
    ? normalizeCompatibleFormatStructure(session, format)
    : initializeSessionFormat({ session, format, formatCatalog });
  const content = cloneContent(importResult.content, format);
  return Object.freeze({
    type: "musikkryss-weekly-content-application-result",
    version: 1,
    status: "applied",
    session: {
      ...baseSession,
      crosswordId: content.issue.crosswordId,
      musikkryss: content
    },
    diagnostics: Object.freeze([])
  });
}

function notApplied(session, code, details) {
  return Object.freeze({
    type: "musikkryss-weekly-content-application-result",
    version: 1,
    status: "not-applied",
    session,
    diagnostics: Object.freeze([Object.freeze({
      code,
      ...(details ? { details: Object.freeze({ ...details }) } : {})
    })])
  });
}

function initializeSessionFormat({ session, format, formatCatalog }) {
  const template = createMusikkryssTemplate({
    formatId: format.id,
    formatCatalog,
    crosswordId: session.crosswordId,
    documentSize: session.documentSize,
    imageSrc: session.imageSrc
  });

  return {
    ...session,
    ...template
  };
}

function hasSessionDocumentOrGrid(session) {
  if (session.imageSrc) return true;

  const cellTypes = Array.isArray(session.cellTypes) ? session.cellTypes : [];
  const hasCellTopology = (
    Number.isInteger(session.rows)
    && Number.isInteger(session.cols)
    && cellTypes.length === session.rows * session.cols
    && cellTypes.some(cellType => cellType !== "empty")
  );
  const hasExplicitGridGeometry = (
    Array.isArray(session.horizontalLinePositions)
    && session.horizontalLinePositions.length === session.rows + 1
    && Array.isArray(session.verticalLinePositions)
    && session.verticalLinePositions.length === session.cols + 1
  );

  return hasCellTopology || hasExplicitGridGeometry;
}

function hasCompatibleFormatStructure(session, format) {
  const expectedCellTypes = format.cellTopology.map(cell => (
    cell === "writable" ? "write" : CELL_TYPE_BLACK
  ));

  return session.rows === format.gridDimensions.rows
    && session.cols === format.gridDimensions.cols
    && Array.isArray(session.cellTypes)
    && session.cellTypes.length === expectedCellTypes.length
    && session.cellTypes.every((cellType, index) => (
      cellType === expectedCellTypes[index]
      || (
        expectedCellTypes[index] === CELL_TYPE_BLACK
        && cellType === "empty"
      )
    ));
}

function normalizeCompatibleFormatStructure(session, format) {
  const hasLegacyEmptyBlackCells = format.cellTopology.some((cell, index) => (
    cell === "non-writable" && session.cellTypes[index] === "empty"
  ));
  if (!hasLegacyEmptyBlackCells) return session;

  return {
    ...session,
    cellTypes: session.cellTypes.map((cellType, index) => (
      format.cellTopology[index] === "non-writable"
        ? CELL_TYPE_BLACK
        : cellType
    ))
  };
}

function cloneContent(content, format) {
  const answersById = new Map(content.answers.map(answer => [
    `${answer.number}:${answer.direction}`,
    answer
  ]));

  return {
    formatId: format.id,
    issue: { ...content.issue },
    introScript: content.introScript,
    answers: format.answerDefinitions.map(definition => {
      const answer = answersById.get(
        `${definition.number}:${definition.direction}`
      );
      return {
        number: definition.number,
        direction: definition.direction,
        answerPath: [...definition.answerPath],
        contentSequence: answer.contentSequence.map(entry => ({ ...entry })),
        solution: answer.solution
      };
    })
  };
}
