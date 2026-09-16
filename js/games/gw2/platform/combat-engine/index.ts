/**
 * Public surface of the migration's TypeScript combat engine.
 *
 * This runtime reproduces the pinned gw2combat reference and exists alongside
 * the current scheduler/resolver engine without modifying it. Callers select
 * one engine for an entire run; nothing here is wired into the application yet
 * (that is Phase 3 of the migration plan).
 */
export {
  COMBAT_ENGINE_REVISION,
  REFERENCE_REVISION,
  prepareEncounter,
  runCombatEngine
} from '#gw2/platform/combat-engine/run.js';
export {
  ConfigurationError,
  readBuild,
  readEncounter,
  readRotation,
  readRotationCsv,
  resolveUpstreamEncounter
} from '#gw2/platform/combat-engine/configuration.js';
export { DEFAULT_TICK_LIMIT, TICK_ORDER, RunawayRunError } from '#gw2/platform/combat-engine/loop.js';
export { roundHalfEven } from '#gw2/platform/combat-engine/numeric.js';
export type { Build, Encounter, Rotation } from '#gw2/platform/combat-engine/configuration.js';
export type {
  AuditEvent,
  EngineFailure,
  EngineIdentity,
  EngineOutcome,
  EngineRequest,
  EngineResult,
  SkillStatus
} from '#gw2/platform/combat-engine/types.js';
