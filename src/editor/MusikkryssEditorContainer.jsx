import React, { useEffect, useState } from "react";
import EditorScrollWorkspace from "./EditorScrollWorkspace";
import MusikkryssEditorPanel from "./MusikkryssEditorPanel";
import MusikkryssWeeklyContentImportContainer from "./MusikkryssWeeklyContentImportContainer";
import MusikkryssAnswerPathOverlay from "./MusikkryssAnswerPathOverlay";
import TemplateCanvas from "../template/TemplateCanvas";
import {
  normalizeCatalogMusikkryssContent
} from "../musikkryss/MusikkryssFormatCatalog";

export default function MusikkryssEditorContainer({
  template,
  editor,
  musikkryss,
  onMusikkryssChange,
  onCrosswordIdChange,
  onLoadReference,
  weeklyContentCandidate,
  weeklyContentFormatCatalog,
  onApplyWeeklyContent,
  zoomState,
  setZoomState,
  scrollState,
  setScrollState,
  documentLifecycleId
}) {
  const content = normalizeCatalogMusikkryssContent(
    musikkryss,
    weeklyContentFormatCatalog
  );
  const firstAnswerId = answerId(content.answers[0]);
  const [selectedAnswerId, setSelectedAnswerId] = useState(firstAnswerId);
  const selectedAnswer = content.answers.find(
    answer => answerId(answer) === selectedAnswerId
  ) || content.answers[0];

  useEffect(() => {
    setSelectedAnswerId(firstAnswerId);
  }, [documentLifecycleId, firstAnswerId]);

  return (
    <div
      data-testid="musikkryss-editor-container"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "20px",
        minWidth: 0,
        flex: 1
      }}
    >
      <aside
        style={{
          width: "220px",
          padding: "12px",
          border: "1px solid #e1e4ea",
          borderRadius: "6px",
          background: "#fff",
          boxSizing: "border-box"
        }}
      >
        <MusikkryssEditorPanel
          value={content}
          onChange={onMusikkryssChange}
          onLoadReference={onLoadReference}
          formatCatalog={weeklyContentFormatCatalog}
          selectedAnswerId={selectedAnswerId}
          onSelectedAnswerIdChange={setSelectedAnswerId}
          onCrosswordIdChange={onCrosswordIdChange}
        />
        <MusikkryssWeeklyContentImportContainer
          candidate={weeklyContentCandidate}
          formatId={content.formatId}
          formatCatalog={weeklyContentFormatCatalog}
          onApprove={onApplyWeeklyContent}
        />
      </aside>

      <EditorScrollWorkspace
        documentSize={template.documentSize}
        zoomState={zoomState}
        setZoomState={setZoomState}
        scrollState={scrollState}
        setScrollState={setScrollState}
        documentLifecycleId={documentLifecycleId}
      >
        <TemplateCanvas template={template}>
          {editor}
          <MusikkryssAnswerPathOverlay
            template={template}
            cellIndexes={selectedAnswer.answerPath}
          />
        </TemplateCanvas>
      </EditorScrollWorkspace>
    </div>
  );
}

function answerId(answer) {
  return `${answer.number}:${answer.direction}`;
}
