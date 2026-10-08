import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { buildThiefBuff, buildThiefCondition, buildThiefControl } from '#gw2/professions/thief/core/events.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

/** The boonless target grants both independent packets; removing either leaves its sibling intact. */
export function applyBountifulTheft(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  if (!hasTrait(runtime, TRAIT.BOUNTIFUL_THEFT)) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.BOUNTIFUL_THEFT);
  for (const name of ['Vigor', 'Might']) {
    const effect = requireEffect(profile, 'boon', name);
    if (effect)
      stealBoon(
        runtime,
        cast,
        TRAIT.BOUNTIFUL_THEFT,
        String(effect.boon),
        effectNumber(profile, effect, 'duration'),
        effectNumber(profile, effect, 'stacks')
      );
  }
}

export function applyDeadlyAmbush(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  if (!hasTrait(runtime, TRAIT.DEADLY_AMBUSH)) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.DEADLY_AMBUSH);
  const bleeding = requireEffect(profile, 'condition', 'Bleeding');
  if (!bleeding) return;
  runtime.effects.emit({
    kind: 'packet',
    event: buildThiefCondition(null, {
      at: runtime.time,
      source: 'Trait',
      skillId: TRAIT.DEADLY_AMBUSH,
      skillName: 'Deadly Ambush',
      triggeredBy: cast.skill.name,
      activationId: cast.id,
      name: 'Deadly Ambush — Bleeding',
      condition: String(bleeding.condition),
      duration: effectNumber(profile, bleeding, 'duration'),
      stacks: effectNumber(profile, bleeding, 'stacks')
    })
  });
}

/** Applies Kleptomaniac at its established mechanical boundary. */
export function applyKleptomaniac(runtime: ThiefRuntime): void {
  if (hasTrait(runtime, TRAIT.KLEPTOMANIAC)) {
    const initiativeGain = balanceProfileNumber(
      requireBalanceProfileFromContext(runtime, TRAIT.KLEPTOMANIAC),
      'resourceGain'
    );
    if (initiativeGain > 0) runtime.resourceController.grant('initiative', initiativeGain);
  }
}

export function applySleightOfHand(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  if (!hasTrait(runtime, TRAIT.SLEIGHT_OF_HAND)) return;
  const control = requireEffect(requireBalanceProfileFromContext(runtime, TRAIT.SLEIGHT_OF_HAND), 'control', 'daze');
  if (!control) return;
  runtime.effects.emit({
    kind: 'packet',
    event: buildThiefControl(cast.skill, {
      at: runtime.time,
      source: 'Trait',
      sourceId: TRAIT.SLEIGHT_OF_HAND,
      activationId: cast.id,
      name: 'Sleight of Hand - Daze',
      controlKind: String(control.kind)
    })
  });
}

/** Builds a steal-owned boon attributed to its trait source, scaled by boon duration when it applies. */
function stealBoon(
  runtime: ThiefRuntime,
  cast: RuntimeCast<ThiefSkill>,
  traitId: number,
  boon: string,
  duration: number,
  stacks: number
): void {
  runtime.effects.emit({
    kind: 'packet',
    event: buildThiefBuff(cast.skill, {
      at: runtime.time,
      source: 'Trait',
      sourceId: traitId,
      activationId: cast.id,
      name: `Steal — ${boon}`,
      kind: boon,
      boon,
      duration,
      stacks
    })
  });
}

export function applyThrillOfTheCrime(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  if (!hasTrait(runtime, TRAIT.THRILL_OF_THE_CRIME)) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.THRILL_OF_THE_CRIME);
  for (const effect of (profile.effects || []).filter((entry) => entry.type === 'boon'))
    stealBoon(
      runtime,
      cast,
      TRAIT.THRILL_OF_THE_CRIME,
      String(effect.boon),
      effectNumber(profile, effect, 'duration'),
      effectNumber(profile, effect, 'stacks')
    );
}
