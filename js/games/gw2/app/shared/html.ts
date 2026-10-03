/** Converts GW2 API line breaks and color tags into plain tooltip text. */
export function gw2ApiText(value: unknown): string {
  return String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?c(?:=[^>]*)?>/gi, '');
}
