import { normalizeTemplate } from "./templateModel";
import { BACKEND_BASE_URL } from "./persistenceConfig";

export async function loadBackendTemplate(id) {
  const response = await fetch(`${BACKEND_BASE_URL}/api/crossword/${id}`);
  const template = await response.json();

  return normalizeTemplate(template, {
    crosswordId: id,
    rows: 25,
    cols: 25,
    gridArea: {
      top: 0,
      left: 0,
      width: 1200,
      height: 1200
    },
    imageSrc: ""
  });
}

export async function publishBackendTemplate(template) {
  const response = await fetch(`${BACKEND_BASE_URL}/api/publish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(template)
  });

  return response.json();
}
