export function canonicalJsonValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Evidence JSON cannot contain a non-finite number.");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJsonValue).join(",")}]`;
  }
  if (typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    return `{${Object.keys(objectValue)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalJsonValue(objectValue[key])}`,
      )
      .join(",")}}`;
  }
  throw new Error("Evidence JSON contains an unsupported value.");
}

export function canonicalJson(value: unknown): string {
  return `${canonicalJsonValue(value)}\n`;
}
