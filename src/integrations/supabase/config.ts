export type SupabaseRuntimeConfig = {
  supabaseUrl?: string;
  supabasePublishableKey?: string;
};

export function isLikelySupabaseUrl(value: string | undefined): value is string {
  const trimmed = normalizeSupabaseEnvValue(value);
  if (!trimmed) return false;

  try {
    const url = new URL(trimmed);
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function isLikelySupabasePublishableKey(value: string | undefined): value is string {
  const trimmed = normalizeSupabaseEnvValue(value);
  if (!trimmed || hasControlCharacter(trimmed)) return false;

  return (
    trimmed.startsWith("sb_publishable_") ||
    (trimmed.split(".").length === 3 && trimmed.length > 80)
  );
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

export function firstValidSupabaseValue(
  values: Array<string | undefined>,
  isValid: (value: string | undefined) => value is string,
): string | undefined {
  return values.map(normalizeSupabaseEnvValue).find(isValid);
}

export function normalizeSupabaseEnvValue(value: string | undefined): string | undefined {
  let normalized = value?.replace(/^\uFEFF/, "").trim();
  if (
    normalized &&
    ((normalized.startsWith('"') && normalized.endsWith('"')) ||
      (normalized.startsWith("'") && normalized.endsWith("'")))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }
  return normalized || undefined;
}
