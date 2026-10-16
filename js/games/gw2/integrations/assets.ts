interface FetchJsonAssetOptions {
  readonly optional?: boolean;
}

/**
 * Fetches and parses a JSON asset, bypassing the browser cache.
 *
 * Optional requests return `null` instead of throwing for a non-success status.
 *
 * Parsed JSON, or `null` for a missing
 * optional asset.
 * @throws {Error} When a required asset cannot be loaded or the response is not
 * valid JSON.
 */
export async function fetchJsonAsset(
  path: string,
  { optional = false }: FetchJsonAssetOptions = {}
): Promise<unknown | null> {
  const response = await fetch(`${path}?t=${Date.now()}`);

  if (!response.ok) {
    if (optional) return null;

    throw new Error(`Could not load ${path}`);
  }

  return response.json();
}

/**
 * Extracts rotation items from either a bare array or a wrapped rotation payload.
 *
 * Rotation items when present.
 */
export function getRotationItems(payload: unknown): unknown[] | undefined {
  if (Array.isArray(payload)) return payload;

  if (!payload || typeof payload !== 'object') return undefined;

  const rotation = (payload as { rotation?: unknown }).rotation;
  return Array.isArray(rotation) ? rotation : undefined;
}
