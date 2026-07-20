function createPublicationId({
  now = () => new Date(),
  random = Math.random
} = {}) {
  const timestamp = now()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);
  const suffix = random()
    .toString(36)
    .slice(2, 8)
    .padEnd(6, "0");

  return `pub-${timestamp}-${suffix}`;
}

module.exports = {
  createPublicationId
};
