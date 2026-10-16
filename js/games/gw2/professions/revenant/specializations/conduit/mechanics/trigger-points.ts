import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

/** Shared Wisdom follows Entity completion and precedes invocation/form work. */
export const entityCastCompleted = defineTriggerPoint<{ readonly cast: RuntimeCast<RevenantSkill> }>(
  'revenant.entity-cast-completed',
  [TRAIT.SHARED_WISDOM]
);

/** Skill-authored boon actions retain their position relative to cleanse and shared-ammo completion. */
export const entityBoonCompleted = defineTriggerPoint<{ readonly cast: RuntimeCast<RevenantSkill> }>(
  'revenant.entity-boon-completed',
  [TRAIT.SHARED_WISDOM]
);
