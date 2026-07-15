export function getPublishSuccessMessage(publicUrl) {
  return `Publicerad! Öppna: ${publicUrl}`;
}

export function getPublishFailureMessage(error) {
  return `Publicering misslyckades: ${error.message}`;
}
