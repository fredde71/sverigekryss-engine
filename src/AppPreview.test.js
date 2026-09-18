import { readFileSync } from "fs";

const appSource = readFileSync(`${__dirname}/App.js`, "utf8");

test("editor preview TemplateCanvas remains uncropped", () => {
  const editModeCanvas = getSourceBetween(
    appSource,
    "{modeView === \"edit\" ? (",
    "<PlaySurface"
  );

  expect(editModeCanvas).toContain("<TemplateCanvas");
  expect(editModeCanvas).not.toContain("cropped");
});

test("local Play preview uses PlaySurface without responsive mode", () => {
  const localPlaySurface = getSourceBetween(
    appSource,
    "<PlaySurface",
    "</PlaySurface>"
  );

  expect(localPlaySurface).toContain("<PlaySurface");
  expect(localPlaySurface).not.toContain("responsive");
});

test("publish flow creates Publication after existing template publish succeeds", () => {
  const publishSection = getSourceBetween(
    appSource,
    "const data = await publishBackendTemplate(template);",
    "alert(getPublishSuccessMessage(publicUrl));"
  );

  expect(publishSection).toContain("const data = await publishBackendTemplate(template);");
  expect(publishSection).toContain("if (data.success)");
  expect(publishSection).toContain("createPublicationFromTemplate");
  expect(publishSection).toContain("const createdPublication = await createBackendPublication(publication);");
  expect(publishSection).toContain("createdPublication.publicationId || crosswordId");
  expect(publishSection).toContain("setLatestPublicationByType");
  expect(publishSection).toContain("await refreshPublications(crosswordId);");
});

test("publish flow delegates solve/help link presentation", () => {
  expect(appSource).toContain("<PublicationAccessLinks");
  expect(appSource).toContain("publication={latestPublicationByType[crosswordType]}");
  expect(appSource).toContain("publishBackendHelpAccess");
  expect(appSource).toContain("onPublishHelp={async () => {");
});

test("editor sidebar contains Publication list section", () => {
  const publicationsSection = getSourceBetween(
    appSource,
    "<h5 style={sidebarTitleStyle}>Publiceringar</h5>",
    "</section>"
  );

  expect(publicationsSection).toContain("Ange korsords-ID för att visa publiceringar.");
  expect(publicationsSection).toContain("Hämtar publiceringar...");
  expect(publicationsSection).toContain("Inga publiceringar finns ännu.");
  expect(publicationsSection).toContain("publication.publicationId");
  expect(publicationsSection).toContain("publication.newspaper");
  expect(publicationsSection).toContain("publication.publishDate");
  expect(publicationsSection).toContain("publication.status");
});

test("editor loads Publications for the current crosswordId", () => {
  expect(appSource).toContain("loadBackendPublicationsForCrossword");
  expect(appSource).toContain("refreshPublications(crosswordId);");
});

test("upload flow runs production digitization through the browser ImageData adapter", () => {
  const uploadSection = getSourceBetween(
    appSource,
    "const handleImageUpload = async (e) => {",
    "const handleTemplateImport = async (e) => {"
  );
  const documentApplicationSection = getSourceBetween(
    appSource,
    "const applyUploadedDocument = ({",
    "const refreshPublications"
  );
  const imageStateUpdateSection = getSourceBetween(
    uploadSection,
    "reader.onload = async () => {",
    "};"
  );
  const digitizationSection = getSourceBetween(
    appSource,
    "const runDigitizationForUpload = async (",
    "};"
  );

  expect(appSource).toContain("digitizationResult,");
  expect(appSource).toContain("imageSrc,");
  expect(appSource).toContain("editorDocumentLifecycleId,");
  expect(appSource).toContain("const digitizationUploadIdRef = useRef({");
  expect(uploadSection).toContain("const originatingCrosswordType = crosswordType;");
  expect(uploadSection).toContain(
    "++digitizationUploadIdRef.current[originatingCrosswordType]"
  );
  expect(uploadSection).toContain("setEditorDocumentLifecycleId(uploadId);");
  expect(uploadSection).toContain("setImageSrc(\"\");");
  expect(uploadSection).toContain("setDocumentSize(DEFAULT_DOCUMENT_SIZE);");
  expect(uploadSection).toContain("setAnswerPaths([]);");
  expect(appSource).toContain("import { runDigitizationUploadWithIdentity } from \"./digitization/digitizationUploadIdentityGuard\";");
  expect(appSource).toContain("import { readBrowserImageData } from \"./digitization/adapters/browserImageDataReader\";");
  expect(appSource).toContain("import { runDigitizationJob } from \"./digitization/engine/DigitizationEngine\";");
  expect(documentApplicationSection).toContain(
    "originatingCrosswordType === \"musikkryss\""
  );
  expect(documentApplicationSection).toContain("createMusikkryssTemplate({");
  expect(documentApplicationSection).toContain("applyTemplateToEditorSession(");
  expect(documentApplicationSection).toContain("setImageSrc(image);");
  expect(documentApplicationSection).toContain("setDocumentSize(uploadedDocumentSize);");
  expect(documentApplicationSection).toContain(
    "setCropArea(getFullDocumentArea(uploadedDocumentSize));"
  );
  expect(documentApplicationSection).toContain("setCompetitionCells([]);");
  expect(uploadSection.match(/applyUploadedDocument\(\{/g)).toHaveLength(2);
  expect(imageStateUpdateSection).toContain("applyUploadedDocument({");
  expect(imageStateUpdateSection).toContain("originatingCrosswordType");
  expect(uploadSection).not.toContain("setTimeout");
  expect(uploadSection).not.toContain("AbortController");
  expect(digitizationSection).toContain("updateSession(originatingCrosswordType");
  expect(digitizationSection).toContain("status: \"pending\"");
  expect(digitizationSection).toContain("status: \"completed\"");
  expect(digitizationSection).toContain("status: \"failed\"");
  expect(digitizationSection).toContain("runDigitizationJob({");
  expect(digitizationSection).toContain("runDigitizationUploadWithIdentity({");
  expect(digitizationSection).toContain("result: productionResult");
  expect(digitizationSection).toContain("productionResult");
  expect(digitizationSection).toContain("documentSize: targetDocumentSize");
  expect(digitizationSection).toContain("readImageData: readBrowserImageData");
  expect(digitizationSection).toContain(
    "digitizationUploadIdRef.current[originatingCrosswordType]"
  );
  expect(digitizationSection).toContain("console.warn(\"Digitization failed during upload\", err);");
  expect(digitizationSection).not.toContain("setGridArea");
  expect(digitizationSection).not.toContain("setRows");
  expect(digitizationSection).not.toContain("setCols");
  expect(digitizationSection).not.toContain("setCropArea");
  expect(digitizationSection).not.toContain("setSuggestions");
  expect(appSource).toContain(
    "documentAvailable={hasEditorSessionDocumentOrGrid(session)}"
  );
  expect(
    appSource.match(/documentLifecycleId=\{editorDocumentLifecycleId\}/g)
  ).toHaveLength(3);
});

test("Musikkryss upload selects the canonical format without filename logic", () => {
  expect(appSource).toContain(
    "import { createMusikkryssTemplate } from \"./musikkryss/MusikkryssTemplateInitializer\";"
  );
  expect(appSource).toContain(
    "applyTemplateToEditorSession(current, createMusikkryssTemplate({"
  );
  expect(appSource).toContain("crosswordType !== \"sverigekryss\"");
  expect(appSource).not.toContain("kryss2026w38");
});

test("answer paths remain Template-owned through import export publish and preview", () => {
  const publishTemplateSection = getSourceBetween(
    appSource,
    "const template = {",
    "};"
  );
  const exportSection = getSourceBetween(
    appSource,
    "const exportTemplate = () => {",
    "};"
  );
  const editModeCanvas = getSourceBetween(
    appSource,
    "{modeView === \"edit\" ? (",
    "<PlaySurface"
  );
  const localPlaySurface = getSourceBetween(
    appSource,
    "<PlaySurface",
    "</PlaySurface>"
  );

  expect(appSource).toContain("answerPaths,");
  expect(appSource).toContain("answerPaths: data.answerPaths || []");
  expect(appSource).toContain("answerPaths={answerPaths}");
  expect(appSource).toContain("setAnswerPaths={setAnswerPaths}");
  expect(appSource).toContain("answerPathMenu");
  expect(publishTemplateSection).toContain("answerPaths");
  expect(exportSection).toContain("answerPaths");
  expect(editModeCanvas).toContain("answerPaths");
  expect(localPlaySurface).toContain("answerPaths");
});

test("explicit grid-line positions remain Template-owned through Editor and Play", () => {
  expect(appSource).toContain("horizontalLinePositions,");
  expect(appSource).toContain("verticalLinePositions,");
  expect(appSource).toContain(
    "horizontalLinePositions: data.horizontalLinePositions || null"
  );
  expect(appSource).toContain(
    "verticalLinePositions: data.verticalLinePositions || null"
  );
  expect(appSource).toContain("horizontalLinePositions={horizontalLinePositions}");
  expect(appSource).toContain("verticalLinePositions={verticalLinePositions}");
  expect(appSource.match(/horizontalLinePositions/g).length).toBeGreaterThanOrEqual(7);
  expect(appSource.match(/verticalLinePositions/g).length).toBeGreaterThanOrEqual(7);
});

test("normal App contains no Digitization Lab diagnostics or controls", () => {
  expect(appSource).not.toContain("DigitizationDiagnosticPanel");
  expect(appSource).not.toContain("DigitizationDatasetHarness");
  expect(appSource).not.toContain("digitizationExperimentComparison");
  expect(appSource).not.toContain("runUploadDigitizationExperimentComparison");
  expect(appSource).not.toContain("Utvecklardetaljer");
  expect(appSource).not.toContain("Digitization Lab");
});

test("App orchestrates the top-level Musikkryss editor shell", () => {
  expect(appSource).toContain(
    "const [crosswordType, setCrosswordType] = useState(\"sverigekryss\");"
  );
  expect(appSource).toContain("<EditorModeSwitch");
  expect(appSource).toContain("<MusikkryssEditorContainer");
  expect(appSource).toContain("musikkryss={musikkryss}");
  expect(appSource).toContain("onMusikkryssChange={setMusikkryss}");
  expect(appSource).toContain("onLoadReference={() => updateSession(");
  expect(appSource).toContain("loadMusikkryssReferenceIntoEditorSession");
  expect(appSource).toContain("crosswordType === \"musikkryss\"");
  expect(appSource).not.toContain("setMusikkryssIntroScript");
  expect(appSource).not.toContain("setMusikkryssClueText");
});

test("Musikkryss uses its session-owned modeView to switch between Editor and Play", () => {
  const viewSection = getSourceBetween(
    appSource,
    "<h5 style={sidebarTitleStyle}>Läge</h5>",
    "</section>"
  );
  const renderedModeSection = getSourceBetween(
    appSource,
    "{modeView === \"edit\" ? (",
    "</PlaySurface>"
  );

  expect(appSource).toContain(
    "import EditorPlayModeSwitch from \"./editor/EditorPlayModeSwitch\";"
  );
  expect(viewSection).toContain("crosswordType === \"musikkryss\"");
  expect(viewSection).toContain("<EditorPlayModeSwitch");
  expect(viewSection).toContain("value={modeView}");
  expect(viewSection).toContain("onChange={setModeView}");
  expect(renderedModeSection).toContain("<MusikkryssEditorContainer");
  expect(renderedModeSection).toContain("<PlaySurface");
});

test("App delegates per-type document and editor state to EditorSessionWorkspace", () => {
  expect(appSource).toContain("<EditorSessionWorkspace activeType={crosswordType}>");
  expect(appSource).toContain("session={session}");
  expect(appSource).toContain("setters={setters}");
  expect(appSource).toContain("updateSession={updateSession}");
  expect(appSource).toContain("sessionKey={crosswordType}");
  expect(appSource).toContain("scrollState={editorScrollState}");
  expect(appSource).toContain("setScrollState={setEditorScrollState}");
});

test("top-level crossword type exclusively controls the visible editor", () => {
  const templateCanvas = getSourceBetween(
    appSource,
    "<TemplateCanvas",
    "</TemplateCanvas>"
  );

  expect(appSource).toContain("crosswordType === \"musikkryss\"");
  expect(appSource).toContain("<MusikkryssEditorContainer");
  expect(appSource).toContain("editor={editor}");
  expect(templateCanvas).toContain("{editor}");
  expect(templateCanvas).toContain("<DigitizationSuggestionOverlay");
});

test("editor preview renders read-only digitization suggestion overlay", () => {
  const editModeCanvas = getSourceBetween(
    appSource,
    "{modeView === \"edit\" ? (",
    "<PlaySurface"
  );
  const localPlaySurface = getSourceBetween(
    appSource,
    "<PlaySurface",
    "</PlaySurface>"
  );
  const overlaySection = getSourceBetween(
    appSource,
    "<DigitizationSuggestionOverlay",
    "/>"
  );

  expect(appSource).toContain("import DigitizationSuggestionOverlay from \"./digitization/DigitizationSuggestionOverlay\";");
  expect(editModeCanvas).toContain("<DigitizationSuggestionOverlay");
  expect(localPlaySurface).not.toContain("DigitizationSuggestionOverlay");
  expect(overlaySection).toContain("digitizationResult={digitizationResult}");
  expect(overlaySection).toContain("documentSize={documentSize}");
  expect(overlaySection).not.toContain("setGridArea");
  expect(overlaySection).not.toContain("setRows");
  expect(overlaySection).not.toContain("setCols");
  expect(overlaySection).not.toContain("setCropArea");
});

test("routes an available GridLattice proposal through EditorWorkspace ownership", () => {
  const proposalSection = getSourceBetween(
    appSource,
    "const gridLatticeEditorProposal = React.useMemo(() => {",
    "  ]);"
  );
  const editorWorkspaceSection = getSourceBetween(
    appSource,
    "<EditorWorkspace",
    ">"
  );

  expect(appSource).toContain(
    "import {\n  createGridLatticeEditorProposal\n} from \"./digitization/analysis/reconstruction/GridLatticeEditorProposal\";"
  );
  expect(appSource).toContain(
    "function App()"
  );
  expect(appSource).toContain(
    "digitizationResult.result?.gridLatticeReconstructionResult ?? null"
  );
  expect(appSource).toContain(
    "digitizationResult.result?.outerVisualExtent ?? null"
  );
  expect(appSource).toContain(
    "digitizationResult.result?.gridFormatGeometrySelection ?? null"
  );
  expect(proposalSection).toContain(
    "createGridLatticeEditorProposal({\n      gridLattice: gridLatticeReconstructionResult.lattice,\n      outerVisualExtent,\n      gridFormatGeometrySelection"
  );
  expect(proposalSection).not.toContain("imageAlignedGridLineGeometry");
  expect(proposalSection).not.toMatch(
    /setRows|setCols|setGridArea|setCellTypes|setCompetitionCells/
  );
  expect(editorWorkspaceSection).toContain(
    "gridProposal={gridLatticeEditorProposal}"
  );
  expect(appSource).not.toContain(
    "useState(gridLatticeReconstructionResult"
  );
  expect(proposalSection).toContain(
    "gridLatticeReconstructionResult?.status !== \"available\""
  );
  expect(proposalSection).toContain(
    "gridLatticeReconstructionResult.lattice?.status !== \"available\""
  );
  expect(proposalSection).toContain(
    "return proposal.status === \"available\" ? proposal : null"
  );
});

function getSourceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);

  return source.slice(startIndex, endIndex);
}
