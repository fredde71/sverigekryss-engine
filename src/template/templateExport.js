import { createTemplate } from "./templateModel";

export function exportTemplateFile(input) {
  const data = createTemplate(input);

  const json = JSON.stringify(data, null, 2);

  const blob = new Blob(
    [json],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");

  a.href = url;
  a.download = "sverigekryss-template.json";

  a.click();

  URL.revokeObjectURL(url);
}
