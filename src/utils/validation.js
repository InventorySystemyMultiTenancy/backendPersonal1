function isUuid(value) {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim();
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  return uuidRegex.test(normalized);
}

module.exports = { isUuid };
