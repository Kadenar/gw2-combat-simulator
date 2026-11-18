/** Share cast attribution and impact offsets across Ritualist player actions and spirit execution. */
import { gw2Time } from '#gw2/platform/combat/clock.js';
import { ACTOR } from '#gw2/platform/constants.js';
import { copyStrikePayload, type StrikePayloadFields } from '#gw2/platform/effects/strike-payload.js';
import type { StrikeEffect, StrikeTick } from '#gw2/platform/effects/types.js';
import type { EffectMetadata } from '#gw2/platform/events/events.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { NecromancerSkill } from '#gw2/professions/necromancer/types.js';

/** Apply the authored attack offset and optional travel delay on the canonical clock. */
export function spiritImpactAt(at: number, cast: RuntimeCast<NecromancerSkill>, offsetMs: number): number {
  return gw2Time(at + offsetMs / 1000 + (cast.command.impactDelayMs ?? 0) / 1000);
}

export function attribution(cast: RuntimeCast<NecromancerSkill>) {
  return {
    at: cast.effectiveEnd,
    source: 'Spirit',
    sourceId: cast.skill.id,
    actorType: ACTOR.PLAYER,
    skillId: cast.skill.id,
    skillName: cast.skill.name,
    icon: cast.skill.icon,
    activationId: cast.id,
    offTarget: cast.command.offTarget
  };
}

/** Preserve authored strike metadata while the lifecycle supplies the spirit's identity and attack role. */
export function spiritFields(key: string, attackType: string, metadata?: EffectMetadata) {
  return {
    summonKind: 'spirit',
    summonOwner: `spirit:${key}`,
    metadata: {
      ...metadata,
      spiritAttackType: attackType
    }
  };
}

/**
 * Copy an authored strike the way shared emission does, so procedural spirit packets keep its strength profile,
 * payload flags, and metadata. Tick fields override the effect. Without a tick, the packet carries the whole
 * effect coefficient, as an autonomous attack does.
 */
export function spiritStrikeFields(key: string, attackType: string, effect: StrikeEffect, tick?: StrikeTick) {
  const payload: StrikePayloadFields = {};
  copyStrikePayload(effect, payload);

  if (tick) copyStrikePayload(tick, payload);

  return {
    ...payload,
    coefficient: tick ? tick.coefficient : (effect.coefficient ?? 0),
    weaponStrengthProfileId: effect.weaponStrengthProfileId,
    ...spiritFields(key, attackType, { ...effect.metadata, ...tick?.metadata })
  };
}
