import { emitThiefStateSnapshot } from '#gw2/content/professions/thief/state.js';
import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/combat/state/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { emitSkillCondition } from '#gw2/platform/scheduler/skill-events.js';
import { spendEndurance } from '#gw2/platform/combat/resources/endurance.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/content/professions/thief/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gainThiefInitiative } from '#gw2/content/professions/thief/core/mechanics/resource-events.js';
import type { ThiefCastContext } from '#gw2/content/professions/thief/types.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/thief/core/profiles.js';

// Spend endurance at dodge start and materialize Uncatchable's delayed Lesser
// Caltrops pulses from the selected balance profile.
export function performThiefDodge(context: ThiefCastContext): void {
  const state = professionCoreState(context);
  const resources = balanceProfileFromContext(context, PROFILE.resources);
  Object.assign(
    state,
    spendEndurance(state, Number(resources?.resourceCost || 50), context.start, state.maximumEndurance)
  );
  emitThiefStateSnapshot(context, context.start, 'dodge');
  if (hasTrait(context.config, TRAIT.UNCATCHABLE)) {
    const profile = balanceProfileFromContext(context, PROFILE.uncatchable);
    const bleeding = balanceProfileEffect(profile, 'condition', 0);
    const crippled = balanceProfileEffect(profile, 'condition', 1);
    const applications = Math.max(0, Number(bleeding?.applications || 3));
    for (let pulse = 0; pulse < applications; pulse += 1) {
      const at = context.start + Number(profile?.initialDelay || 0.8) + pulse * Number(profile?.pulseInterval || 1);
      emitSkillCondition(context, {
        at,
        source: 'Trait',
        actorType: 'player',
        skillId: context.skill?.id ?? null,
        skillName: context.skill?.name ?? null,
        condition: String(bleeding?.condition || 'Bleeding'),
        duration: Number(bleeding?.duration || 5),
        stacks: Number(bleeding?.stacks || 1),
        sourceId: TRAIT.UNCATCHABLE,
        name: 'Uncatchable — Lesser Caltrops'
      });
      emitSkillCondition(context, {
        at,
        source: 'Trait',
        actorType: 'player',
        skillId: context.skill?.id ?? null,
        skillName: context.skill?.name ?? null,
        condition: String(crippled?.condition || 'Crippled'),
        duration: Number(crippled?.duration || 1),
        stacks: Number(crippled?.stacks || 1),
        sourceId: TRAIT.UNCATCHABLE,
        name: 'Uncatchable — Lesser Caltrops'
      });
    }
  }
}

// Grant Upper Hand's initiative at dodge completion only when its independent
// cooldown is ready.
export function completeThiefDodge(context: ThiefCastContext): void {
  if (!hasTrait(context.config, TRAIT.UPPER_HAND)) return;
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const profile = balanceProfileFromContext(context, PROFILE.upperHand);
  const readyAt = Number(state.traitProcReadyAt[TRAIT.UPPER_HAND] || 0);
  if (!isInternalCooldownReady(at, readyAt)) return;
  state.traitProcReadyAt[TRAIT.UPPER_HAND] = at + Number(profile?.internalCooldown || 2);
  gainThiefInitiative(context, Number(profile?.resourceGain || 1), at, 'upper-hand');
}
