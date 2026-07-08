import { normalizeTemplate } from "./templateModel";

export async function importTemplateFile(file, defaults) {
  const text = await file.text();
  const parsed = JSON.parse(text);

  return normalizeTemplate(parsed, defaults);
}
