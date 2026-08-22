/**
 * Barrel module for the profession-neutral engine layer. Re-exports the public
 * surface (catalog, scheduler, resolver, effect builders, and supporting
 * primitives) so consumers import from one entry point instead of reaching into
 * individual implementation files.
 */
export * from './catalog.js';
export * from './clock.js';
export * from './collections.js';
export * from './cooldown-controller.js';
export * from './event-queue.js';
export * from './events.js';
export * from './effect-factories.js';
export * from './effect-materializer.js';
export * from './handler-registry.js';
export * from './observation-policy.js';
export * from './profession.js';
export * from './prepare-config.js';
export * from './resolver.js';
export * from './rotation-commands.js';
export * from './scheduled-event-stream.js';
export * from './scheduler-state.js';
export * from './scheduler.js';
export * from './skill-factories.js';
export * from './task-queue.js';
