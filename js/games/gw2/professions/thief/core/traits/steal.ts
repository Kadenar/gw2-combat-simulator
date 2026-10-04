import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { gw2BaseRecharge } from '#gw2/platform/execution/recharge.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import {
  buildThiefBuff,
  buildThiefCondition,
  buildThiefControl,
  buildThiefStrikes
} from '#gw2/professions/thief/core/events.js';
import { grantThiefInitiative } from '#gw2/professions/thief/core/mechanics/resources.js';
import { potentPoisonStacks } from '#gw2/professions/thief/core/traits/poison.js';
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

export function applyEvenTheOdds(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  if (!hasTrait(runtime, TRAIT.EVEN_THE_ODDS)) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.EVEN_THE_ODDS);
  const vulnerability = requireEffect(profile, 'condition', 'Vulnerability');
  if (!vulnerability) return;
  runtime.effects.emit({
    kind: 'packet',
    event: buildThiefCondition(cast.skill, {
      at: runtime.time,
      source: 'Trait',
      sourceId: TRAIT.EVEN_THE_ODDS,
      activationId: cast.id,
      name: 'Even the Odds — Vulnerability',
      condition: String(vulnerability.condition),
      duration: effectNumber(profile, vulnerability, 'duration'),
      stacks: effectNumber(profile, vulnerability, 'stacks')
    })
  });
}

/** Hidden Thief claims its cooldown before either condition so a removed packet cannot re-arm it. */
export function applyHiddenThief(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  if (!hasTrait(runtime, TRAIT.HIDDEN_THIEF)) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.HIDDEN_THIEF);
  const blindness = requireEffect(profile, 'condition', 'Blindness');
  const weakness = requireEffect(profile, 'condition', 'Weakness');
  if (!runtime.procs.claimCooldown(TRAIT.HIDDEN_THIEF, runtime.time, balanceProfileNumber(profile, 'internalCooldown')))
    return;
  for (const [condition, effect] of [
    ['Blindness', blindness],
    ['Weakness', weakness]
  ] as const)
    if (effect)
      runtime.effects.emit({
        kind: 'packet',
        event: buildThiefCondition(cast.skill, {
          at: runtime.time,
          source: 'Trait',
          sourceId: TRAIT.HIDDEN_THIEF,
          activationId: cast.id,
          name: `Hidden Thief - ${condition}`,
          condition,
          duration: effectNumber(profile, effect, 'duration'),
          stacks: effectNumber(profile, effect, 'stacks')
        })
      });
}

/** A selected Improvisation grants the second use before the stored choice is locked. */
export function improvisationStolenUses(context: unknown): number {
  return hasTrait(context, TRAIT.IMPROVISATION)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.IMPROVISATION), 'maximumStacks')
    : 1;
}

/** Improvisation shortens every selected, still-recharging utility once per internal cooldown. */
export function reduceUtilityRecharges(runtime: ThiefRuntime): void {
  if (!hasTrait(runtime, TRAIT.IMPROVISATION)) return;
  // An eligible pilfer claims the interval even when no selected utility is recharging.
  if (!runtime.procs.claim(TRAIT.IMPROVISATION, 'thief.antiquary.improvisation', runtime.time)) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.IMPROVISATION);
  const multiplier = balanceProfileNumber(profile, 'rechargeMultiplier');
  for (const id of selectedSkillIdSet(runtime.config.selectedSkillIds)) {
    const skill = runtime.helpers.skillsById.get(id);
    if (skill?.type === 'Utility')
      runtime.cooldownController.reduceSkillRecharge(skill, gw2BaseRecharge(skill) * (1 - multiplier), runtime.time);
  }
}

/** Apply the selected shadow-force gain at the existing Siphon resource boundary. */
export function improvisationShadowForceMultiplier(runtime: ThiefRuntime): number {
  return hasTrait(runtime, TRAIT.IMPROVISATION)
    ? 1 + balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.IMPROVISATION), 'lifeForceGain')
    : 1;
}

/** Only Swipe pilfers receive Improvisation's extra use. */
export function improvisationArtifactUses(runtime: ThiefRuntime, source: string): number {
  return source === 'swipe' && hasTrait(runtime, TRAIT.IMPROVISATION)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.IMPROVISATION), 'resourceGain')
    : 0;
}

/** Applies Kleptomaniac at its established mechanical boundary. */
export function applyKleptomaniac(runtime: ThiefRuntime): void {
  if (hasTrait(runtime, TRAIT.KLEPTOMANIAC))
    grantThiefInitiative(
      runtime,
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.KLEPTOMANIAC), 'resourceGain')
    );
}

/** Mug is an uncritical strike owned by the steal skill. */
export function applyMug(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  if (!hasTrait(runtime, TRAIT.MUG)) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.MUG);
  const strike = requireEffect(profile, 'strike', 'Mug');
  if (!strike) return;
  buildThiefStrikes(null, {
    at: runtime.time,
    source: 'Trait',
    sourceId: TRAIT.MUG,
    skillId: cast.skill.id,
    skillName: cast.skill.name,
    activationId: cast.id,
    name: 'Mug',
    coefficient: effectNumber(profile, strike, 'coefficient'),
    hits: effectNumber(profile, strike, 'hits'),
    canCrit: false
  }).forEach((packet) => runtime.effects.emit({ kind: 'packet', event: packet }));
}

/** Serpent's Touch Poison is attributed to its trait while retaining the triggering steal. */
export function applySerpentsTouch(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  if (!hasTrait(runtime, TRAIT.SERPENTS_TOUCH)) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.SERPENTS_TOUCH);
  const poison = requireEffect(profile, 'condition', 'Poisoned');
  if (!poison) return;
  runtime.effects.emit({
    kind: 'packet',
    event: buildThiefCondition(null, {
      at: runtime.time,
      source: 'Trait',
      skillId: TRAIT.SERPENTS_TOUCH,
      skillName: "Serpent's Touch",
      triggeredBy: cast.skill.name,
      activationId: cast.id,
      name: "Serpent's Touch — Poison",
      condition: String(poison.condition),
      duration: effectNumber(profile, poison, 'duration'),
      stacks: potentPoisonStacks(runtime, profile, poison)
    })
  });
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
export function stealBoon(
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

/** Selected on-steal traits apply in the cross-line order shared by every steal variant. */
export function emitThiefStealTraits(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  applySerpentsTouch(runtime, cast);
  applyMug(runtime, cast);
  applyEvenTheOdds(runtime, cast);
  applyDeadlyAmbush(runtime, cast);
  applyThrillOfTheCrime(runtime, cast);
  applyBountifulTheft(runtime, cast);
  applySleightOfHand(runtime, cast);
  applyHiddenThief(runtime, cast);
}
