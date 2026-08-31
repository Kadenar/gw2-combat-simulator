import { DpsReportError } from '#gw2/integrations/logs/dps-report/errors.js';
import { parseDpsReport } from '#gw2/integrations/logs/dps-report/parser.js';
import type { ParsedDpsReport } from '#gw2/integrations/logs/dps-report/types.js';

const REPORT_ID = /^[A-Za-z0-9]{4}[A-Za-z0-9_-]*$/;

/** Extracts a safe report ID from a dps.report permalink or a bare ID. */
export function dpsReportId(input: string): string | null {
  const value = input.trim();
  if (REPORT_ID.test(value)) return value;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname !== 'dps.report' && !hostname.endsWith('.dps.report')) return null;
  const id = url.pathname.split('/').filter(Boolean)[0] || '';
  return REPORT_ID.test(id) ? id : null;
}

/** Builds the public CORS-enabled Elite Insights JSON endpoint for a report. */
export function dpsReportJsonUrl(input: string): string {
  const id = dpsReportId(input);
  if (!id) {
    throw new DpsReportError('INVALID_URL', 'Enter a valid dps.report link or report ID.');
  }

  const endpoint = new URL('https://dps.report/getJson');
  endpoint.searchParams.set('permalink', `https://dps.report/${id}`);
  return endpoint.toString();
}

/** Fetches and validates the raw Elite Insights JSON behind a dps.report permalink. */
export async function fetchDpsReport(
  input: string,
  fetchImplementation: typeof fetch = fetch
): Promise<ParsedDpsReport> {
  const endpoint = dpsReportJsonUrl(input);
  let response: Response;
  try {
    response = await fetchImplementation(endpoint, { headers: { accept: 'application/json' } });
  } catch (error) {
    throw new DpsReportError('NETWORK_ERROR', `Unable to fetch dps.report: ${String(error)}`);
  }

  if (!response.ok) {
    throw new DpsReportError('HTTP_ERROR', `dps.report returned HTTP ${response.status}.`, {
      status: response.status
    });
  }

  let value: unknown;
  try {
    value = await response.json();
  } catch (error) {
    throw new DpsReportError('INVALID_JSON', `dps.report returned invalid JSON: ${String(error)}`);
  }

  if (value != null && typeof value === 'object' && 'error' in value && typeof value.error === 'string') {
    throw new DpsReportError('REPORT_ERROR', `dps.report error: ${value.error}`);
  }

  return parseDpsReport(value);
}
