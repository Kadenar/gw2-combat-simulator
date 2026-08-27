/**
 * High-level engine entrypoint. Domain entrypoints expose lower-level authoring
 * and testing primitives without forcing ordinary consumers through one barrel.
 */
export * from './config.js';
export { createScheduler } from './execution/scheduler.js';
export * from './profession/index.js';
export { resolveScheduledStream } from './resolution/resolver.js';
export { createCanonicalCatalog, validateCanonicalCatalog } from './skills/catalog.js';
