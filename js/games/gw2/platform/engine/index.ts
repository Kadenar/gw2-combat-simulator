/**
 * High-level engine entrypoint. Domain entrypoints expose lower-level authoring
 * and testing primitives without forcing ordinary consumers through one barrel.
 */
export * from '#gw2/platform/engine/config.js';
export { createScheduler } from '#gw2/platform/engine/execution/scheduler.js';
export * from '#gw2/platform/engine/profession/index.js';
export { resolveScheduledStream } from '#gw2/platform/engine/resolution/resolver.js';
export { createCanonicalCatalog, validateCanonicalCatalog } from '#gw2/platform/engine/skills/catalog.js';
