import { readFileSync } from "fs";

const appSource = readFileSync(`${__dirname}/App.js`, "utf8");

test("editor preview TemplateCanvas remains uncropped", () => {
  const editModeCanvas = getSourceBetween(
    appSource,
    "{modeView === \"edit\" ? (",
    ") : ("
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
  expect(publishSection).toContain("await refreshPublications(crosswordId);");
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

test("upload flow runs digitization through the browser ImageData adapter without applying suggestions", () => {
  const uploadSection = getSourceBetween(
    appSource,
    "const handleImageUpload = async (e) => {",
    "const handleTemplateImport = async (e) => {"
  );
  const pdfStateUpdateSection = getSourceBetween(
    uploadSection,
    "setImageSrc(image);",
    "return;"
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

  expect(appSource).toContain("const [digitizationResult, setDigitizationResult] = useState(null);");
  expect(appSource).toContain("const digitizationUploadIdRef = useRef(0);");
  expect(uploadSection).toContain("const uploadId = ++digitizationUploadIdRef.current;");
  expect(appSource).toContain("import { runDigitizationUploadWithIdentity } from \"./digitization/digitizationUploadIdentityGuard\";");
  expect(appSource).toContain("import { readBrowserImageData } from \"./digitization/adapters/browserImageDataReader\";");
  expect(appSource).toContain("import { detectGridFromImageSource } from \"./digitization/detection/imageGridDetectionEngine\";");
  expect(digitizationSection).toContain("await import(\"./digitization/experiments/uploadDigitizationExperimentComparison\")");
  expect(appSource).toContain("import DigitizationDiagnosticPanel from \"./digitization/DigitizationDiagnosticPanel\";");
  expect(appSource).toContain("experimentComparison={digitizationExperimentComparison}");
  expect(pdfStateUpdateSection).toContain("setDocumentSize(documentSize);");
  expect(pdfStateUpdateSection).toContain("setCropArea(getFullDocumentArea(documentSize));");
  expect(pdfStateUpdateSection).toContain("setCompetitionCells([]);");
  expect(pdfStateUpdateSection).toContain("runDigitizationForUpload(canvas, documentSize, uploadId);");
  expect(imageStateUpdateSection).toContain("setImageSrc(image);");
  expect(imageStateUpdateSection).toContain("setDocumentSize(documentSize);");
  expect(imageStateUpdateSection).toContain("setCropArea(getFullDocumentArea(documentSize));");
  expect(imageStateUpdateSection).toContain("setCompetitionCells([]);");
  expect(imageStateUpdateSection).toContain("runDigitizationForUpload(image, documentSize, uploadId);");
  expect(uploadSection).not.toContain("setTimeout");
  expect(uploadSection).not.toContain("AbortController");
  expect(digitizationSection).toContain("setDigitizationResult({");
  expect(digitizationSection).toContain("status: \"pending\"");
  expect(digitizationSection).toContain("status: \"completed\"");
  expect(digitizationSection).toContain("status: \"failed\"");
  expect(digitizationSection).toContain("detectGridFromImageSource");
  expect(digitizationSection).toContain("runDigitizationUploadWithIdentity({");
  expect(digitizationSection).toContain("result: productionResult");
  expect(digitizationSection).toContain("runUploadDigitizationExperimentComparison(");
  expect(digitizationSection).toContain("productionResult");
  expect(digitizationSection).toContain("process.env.NODE_ENV !== \"production\"");
  expect(digitizationSection).toContain("documentSize: targetDocumentSize");
  expect(digitizationSection).toContain("readImageData: readBrowserImageData");
  expect(digitizationSection).toContain("candidateUploadId === digitizationUploadIdRef.current");
  expect(digitizationSection).toContain("console.warn(\"Digitization failed during upload\", err);");
  expect(digitizationSection).not.toContain("setGridArea");
  expect(digitizationSection).not.toContain("setRows");
  expect(digitizationSection).not.toContain("setCols");
  expect(digitizationSection).not.toContain("setCropArea");
  expect(digitizationSection).not.toContain("setSuggestions");
});

test("editor preview renders read-only digitization suggestion overlay", () => {
  const editModeCanvas = getSourceBetween(
    appSource,
    "{modeView === \"edit\" ? (",
    ") : ("
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

function getSourceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);

  return source.slice(startIndex, endIndex);
}
