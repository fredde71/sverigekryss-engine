import { useCallback, useMemo, useState } from "react";
import { DEFAULT_DOCUMENT_SIZE } from "../template/documentGeometry";
import { createEmptyMusikkryssContent } from "../musikkryss/MusikkryssFormat";

export const EDITOR_SESSION_TYPES = Object.freeze([
  "sverigekryss",
  "musikkryss"
]);

export function createEmptyEditorSession(crosswordType) {
  return {
    crosswordType,
    modeView: "edit",
    rows: 25,
    cols: 25,
    cellTypes: Array(25 * 25).fill("empty"),
    crosswordId: "",
    gridArea: { top: 0, left: 0, width: 1200, height: 1200 },
    cropArea: { top: 0, left: 0, width: 1200, height: 1200 },
    competitionCells: [],
    answerPaths: [],
    horizontalLinePositions: null,
    verticalLinePositions: null,
    documentSize: { ...DEFAULT_DOCUMENT_SIZE },
    imageSrc: "",
    imageFileName: "",
    templateFileName: "",
    editorZoomState: { fitScale: 1, scale: 1, zoomMode: "fit" },
    editorScrollState: { top: 0, left: 0 },
    digitizationResult: null,
    editorDocumentLifecycleId: 0,
    musikkryss: createEmptyMusikkryssContent()
  };
}

export default function EditorSessionWorkspace({ activeType, children }) {
  const [sessions, setSessions] = useState(() => ({
    sverigekryss: createEmptyEditorSession("sverigekryss"),
    musikkryss: createEmptyEditorSession("musikkryss")
  }));

  const updateSession = useCallback((crosswordType, update) => {
    setSessions(current => {
      const currentSession = current[crosswordType];
      const nextSession = typeof update === "function"
        ? update(currentSession)
        : update;

      if (nextSession === currentSession) return current;
      return { ...current, [crosswordType]: nextSession };
    });
  }, []);

  const setters = useMemo(() => createSessionSetters({
    crosswordType: activeType,
    updateSession
  }), [activeType, updateSession]);

  return children({
    session: sessions[activeType],
    setters,
    updateSession
  });
}

function createSessionSetters({ crosswordType, updateSession }) {
  return Object.fromEntries(SESSION_FIELDS.map(field => [
    `set${field[0].toUpperCase()}${field.slice(1)}`,
    value => updateSession(crosswordType, current => ({
      ...current,
      [field]: typeof value === "function" ? value(current[field]) : value
    }))
  ]));
}

const SESSION_FIELDS = Object.freeze([
  "modeView",
  "rows",
  "cols",
  "cellTypes",
  "crosswordId",
  "gridArea",
  "cropArea",
  "competitionCells",
  "answerPaths",
  "horizontalLinePositions",
  "verticalLinePositions",
  "documentSize",
  "imageSrc",
  "imageFileName",
  "templateFileName",
  "editorZoomState",
  "editorScrollState",
  "digitizationResult",
  "editorDocumentLifecycleId",
  "musikkryss"
]);
