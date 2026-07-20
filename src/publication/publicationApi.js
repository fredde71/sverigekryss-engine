import { BACKEND_BASE_URL } from "../template/persistenceConfig";

export async function createBackendPublication(publication) {
  const response = await fetch(`${BACKEND_BASE_URL}/api/publications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(publication)
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "Failed to create publication");
  }

  return data;
}

export async function loadBackendPublicationsForCrossword(crosswordId) {
  const response = await fetch(
    `${BACKEND_BASE_URL}/api/crosswords/${crosswordId}/publications`
  );
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "Failed to load publications");
  }

  return data;
}
