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
    ") : (",
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
  expect(publishSection).toContain("await createBackendPublication(publication);");
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

function getSourceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);

  return source.slice(startIndex, endIndex);
}
