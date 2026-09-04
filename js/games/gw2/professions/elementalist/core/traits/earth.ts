/** Imperative Earth trait behavior; dispatch and event classification remain outside this line module. */
import {
  balanceProfileEffectFromContext,
  balanceProfileValue,
  balanceProfileValueFromContext
} from '#gw2/platform/combat/state/balance-profiles.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ResolverEvent, Gw2ResolverRuntime } from '#gw2/platform/resolver/types.js';
import type {
  ElementalistCastContext as ElementalistLifecycleContext,
  ElementalistSchedulerContext
} from '#gw2/professions/elementalist/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistAuraApplier } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import {
  combatStarted,
  emitElementalistProc,
  emitProfiledBuff
} from '#gw2/professions/elementalist/core/mechanics/effects.js';
import {
  applyElementalistDerivedCondition,
  elementalistResolverCoreState,
  queueElementalistBuff,
  recordElementalistTraitProc
} from '#gw2/professions/elementalist/core/mechanics/resolution-helpers.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';

const EARTHEN_BLAST_ICON = 'https://render.guildwars2.com/file/2531DCAFAEAB452C90C4572E1ADCE8236DCF5636/1012304.png';

/** Emits Earthen Blast's uncritable strike after entering Earth in combat. */
export function triggerEarthenBlast(context: ElementalistSchedulerContext, at: number, sourceId: Skill['id']): void {
  if (!combatStarted(context, at) || !hasTrait(context, 'Earthen Blast')) return;
  emitSkillDamage(context, {
    at,
    source: 'Earthen Blast',
    sourceId,
    actorType: 'effect',
    ownerActorType: 'player',
    skillName: 'Earthen Blast',
    icon: EARTHEN_BLAST_ICON,
    coefficient: balanceProfileValue(
      balanceProfileEffectFromContext(context, PROFILE.earthenBlast, 'strike'),
      'coefficient',
      0.36
    ),
    skillWeapon: 'Unequipped',
    noCrit: true
  });
  emitElementalistProc(context, {
    at,
    name: 'Earthen Blast',
    procType: 'trait',
    sourceId,
    sourceSkill: context.catalog.skillsById.get(sourceId)?.name,
    icon: EARTHEN_BLAST_ICON
  });
}

/** Grants Rock Solid's Stability after entering Earth in combat. */
export function grantElementalistRockSolid(
  context: ElementalistSchedulerContext,
  at: number,
  sourceId: Skill['id']
): void {
  if (!combatStarted(context, at) || !hasTrait(context, 'Rock Solid')) return;
  emitProfiledBuff(context, at, PROFILE.rockSolid, 'Stability', 'Stability', 1, 3, 'Rock Solid', sourceId);
}

/** Grants Earth's Embrace Resistance from an eligible healing skill. */
export function applyEarthsEmbrace(context: ElementalistLifecycleContext, skill: Skill): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  if (
    !hasTrait(context, "Earth's Embrace") ||
    !isInternalCooldownReady(at, Number(state.procReadyAt.earthsEmbrace || 0))
  )
    return;
  state.procReadyAt.earthsEmbrace =
    at + balanceProfileValueFromContext(context, PROFILE.earthsEmbrace, 'internalCooldown', 15);
  emitProfiledBuff(context, at, PROFILE.earthsEmbrace, 'Resistance', 'Resistance', 1, 4, "Earth's Embrace", skill.id);
}

/** Applies Written in Stone's signet-specific aura after a completed signet cast. */
export function applyWrittenInStone(
  context: ElementalistLifecycleContext,
  skill: Skill,
  applyAura: ElementalistAuraApplier
): void {
  if (!hasTrait(context, 'Written in Stone') || skill.skillFamily !== 'Signet') return;
  const aura =
    skill.id === ID.SIGNET_OF_RESTORATION
      ? (['Restoration', 'Frost Aura', 4] as const)
      : skill.id === ID.SIGNET_OF_FIRE
        ? (['Fire', 'Fire Aura', 4] as const)
        : skill.id === ID.SIGNET_OF_EARTH
          ? (['Earth', 'Magnetic Aura', 3] as const)
          : null;
  if (!aura) return;
  const effect = balanceProfileEffectFromContext(context, PROFILE.writtenInStone, 'buff', 0, aura[0]);
  applyAura(context, {
    at: context.effectiveEnd,
    aura: String(effect?.kind || aura[1]),
    duration: Number(effect?.duration ?? aura[2]),
    skillName: 'Written in Stone',
    sourceId: skill.id
  });
}

/** Applies Strength of Stone after an already-classified immobilize event. */
export function applyStrengthOfStone(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
  if (!hasTrait(context, 'Strength of Stone')) return;
  const state = elementalistResolverCoreState(context);
  if (!isInternalCooldownReady(event.at, Number(state.procReadyAt.strengthOfStone || 0))) return;
  state.procReadyAt.strengthOfStone =
    event.at + balanceProfileValueFromContext(context, PROFILE.strengthOfStone, 'internalCooldown', 3);
  const bleeding = balanceProfileEffectFromContext(
    context,
    PROFILE.strengthOfStone,
    'condition',
    0,
    'Strength of Stone'
  );
  applyElementalistDerivedCondition(context, event, {
    source: 'Strength of Stone',
    sourceId: 'Strength of Stone',
    condition: String(bleeding?.condition || 'Bleeding'),
    stacks: Number(bleeding?.stacks ?? 3),
    duration: Number(bleeding?.duration ?? 10)
  });
  recordElementalistTraitProc(context, event, 'Strength of Stone');
}

/** Grants scheduler-side Elemental Shielding protection for one aura application. */
export function applySchedulerElementalShielding(
  context: ElementalistSchedulerContext,
  at: number,
  skillName: string,
  sourceId: Skill['id']
): void {
  if (hasTrait(context, 'Elemental Shielding')) {
    emitProfiledBuff(context, at, PROFILE.elementalShielding, 'Protection', 'Protection', 1, 3, skillName, sourceId);
  }
}

/** Grants resolver-side Elemental Shielding protection for one classified aura event. */
export function applyResolverElementalShielding(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
  if (!hasTrait(context, 'Elemental Shielding')) return;
  const protection = balanceProfileEffectFromContext(context, PROFILE.elementalShielding, 'boon', 0, 'Protection');
  queueElementalistBuff(
    context,
    event,
    String(protection?.boon || 'Protection'),
    Number(protection?.stacks ?? 1),
    Number(protection?.duration ?? 3),
    String(event.skillName || event.name || event.source || '')
  );
}
