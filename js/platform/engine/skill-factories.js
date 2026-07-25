/**
 * Minimal helper for skill-definition snippets that want to opt into the
 * canonical "implemented" flag used by generated catalog assembly.
 */
export const implemented = definition => ({
  implemented: true,
  ...definition,
});
