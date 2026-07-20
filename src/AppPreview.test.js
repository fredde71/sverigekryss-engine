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
});

function getSourceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);

  return source.slice(startIndex, endIndex);
}
