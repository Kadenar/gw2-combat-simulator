import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { buildThiefCondition } from '#gw2/professions/thief/core/events.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

/** Applies Cloaked in Shadow at its established mechanical boundary. */
export function enterCloakedInShadow(runtime: ThiefRuntime, skill: ThiefSkill, at: number): void {
  if (hasTrait(runtime, TRAIT.CLOAKED_IN_SHADOW))
    runtime.effects.emit({
      kind: 'packet',
      event: buildThiefCondition(skill, {
        at,
        source: 'Trait',
        sourceId: TRAIT.CLOAKED_IN_SHADOW,
        name: 'Cloaked in Shadow — Blindness',
        condition: 'Blindness',
        stacks: 1,
        duration: 5
      })
    });
}

/** Applies Shadow's Rejuvenation at its established mechanical boundary. */
export function enterShadowsRejuvenation(runtime: ThiefRuntime): void {
  if (hasTrait(runtime, TRAIT.SHADOWS_REJUVENATION)) runtime.resourceController.grant('initiative', 2);
}

/** Applies Shadow's Rejuvenation at its established mechanical boundary. */
export function exitShadowsRejuvenation(runtime: ThiefRuntime): void {
  if (hasTrait(runtime, TRAIT.SHADOWS_REJUVENATION)) {
    const initiativeGain = balanceProfileNumber(
      requireBalanceProfileFromContext(runtime, TRAIT.SHADOWS_REJUVENATION),
      'resourceGain'
    );
    if (initiativeGain > 0) runtime.resourceController.grant('initiative', initiativeGain);
  }
}

/** Sundering Shade's Vulnerability follows the completed stealth attack. */
export function completeThiefStealthAttack(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  if (!hasTrait(runtime, TRAIT.SUNDERING_SHADE)) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.SUNDERING_SHADE);
  const vulnerability = requireEffect(profile, 'condition', 'Vulnerability');
  // Explicit removal suppresses this packet without restoring baseline tuning.
  if (!vulnerability) return;
  runtime.effects.emit({
    kind: 'packet',
    event: buildThiefCondition(cast.skill, {
      at: runtime.time,
      source: 'Trait',
      sourceId: TRAIT.SUNDERING_SHADE,
      activationId: cast.id,
      name: 'Sundering Shade — Vulnerability',
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
