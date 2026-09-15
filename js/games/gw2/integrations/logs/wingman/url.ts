import { WingmanError } from '#gw2/integrations/logs/wingman/errors.js';
import { normalizeWingmanReport } from '#gw2/integrations/logs/wingman/normalize.js';
import { parseDpsReport } from '#gw2/integrations/logs/dps-report/parser.js';
import type { ParsedDpsReport } from '#gw2/integrations/logs/dps-report/types.js';

const WINGMAN_HOST = /(?:^|\.)gw2wingman\.nevermindcreations\.de$/i;
const LOG_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

/** Extracts the log id from a gw2wingman `/log/<id>` link; returns null for any other URL. */
export function wingmanLogId(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }

  if (!WINGMAN_HOST.test(url.hostname.toLowerCase())) return null;
  const segments = url.pathname.split('/').filter(Boolean);
  const logIndex = segments.indexOf('log');
  const id = logIndex >= 0 ? segments[logIndex + 1] : undefined;
  return id && LOG_ID.test(id) ? id : null;
}

/** True when the input looks like a gw2wingman log link, so callers can route it separately. */
export function isWingmanUrl(input: string): boolean {
  return wingmanLogId(input) != null;
}

/** Builds gw2wingman's log-JSON endpoint for a link. */
export function wingmanJsonUrl(input: string): string {
  const id = wingmanLogId(input);
  if (!id) {
    throw new WingmanError('INVALID_URL', 'Enter a valid gw2wingman log link.');
  }

  return new URL(`/api/getJson/${encodeURIComponent(id)}`, 'https://gw2wingman.nevermindcreations.de').toString();
}

/** Fetches a gw2wingman log and reshapes it into the same validated report dps.report imports use. */
export async function fetchWingmanReport(
  input: string,
  fetchImplementation: typeof fetch = fetch
): Promise<ParsedDpsReport> {
  const endpoint = wingmanJsonUrl(input);
  let response: Response;
  try {
    response = await fetchImplementation(endpoint, { headers: { accept: 'application/json' } });
  } catch (error) {
    throw new WingmanError('NETWORK_ERROR', `Unable to fetch gw2wingman: ${String(error)}`);
  }

  if (!response.ok) {
    throw new WingmanError('HTTP_ERROR', `gw2wingman returned HTTP ${response.status}.`, {
      status: response.status
    });
  }

  let value: unknown;
  try {
    value = await response.json();
  } catch (error) {
    throw new WingmanError('INVALID_JSON', `gw2wingman returned invalid JSON: ${String(error)}`);
  }

  return parseDpsReport(normalizeWingmanReport(value));
}
