import { normalizeTemplate } from "./templateModel";

export async function loadBackendTemplate(id) {
  const response = await fetch(`http://localhost:5050/api/crossword/${id}`);
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
