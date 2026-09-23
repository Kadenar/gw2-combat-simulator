/** Imperative Earth trait behavior; dispatch and event classification remain outside this line module. */
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { tryConsumeProcCooldown } from '#gw2/platform/combat/procs.js';
import { emitSkillBuff, emitSkillDamage } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type {
  ElementalistCastContext as ElementalistLifecycleContext,
  ElementalistSchedulerContext,
  ElementalistResolverContext
} from '#gw2/professions/elementalist/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistAuraApplier } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import {
  combatStarted,
  emitElementalistProc,
  emitProfiledBuff,
  elementalistEventSkill
} from '#gw2/professions/elementalist/core/mechanics/effects.js';
import {
  applyElementalistDerivedCondition,
  queueElementalistBuff,
  recordElementalistTraitProc
} from '#gw2/professions/elementalist/core/mechanics/resolution-helpers.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';

const EARTHEN_BLAST_ICON = 'https://render.guildwars2.com/file/2531DCAFAEAB452C90C4572E1ADCE8236DCF5636/1012304.png';

/** Emits Earthen Blast's uncritable strike after entering Earth in combat. */
export function triggerEarthenBlast(context: ElementalistSchedulerContext, at: number, sourceId: Skill['id']): void {
  if (!combatStarted(context, at) || !hasTrait(context, 'Earthen Blast')) return;
  // Use the same attunement or overload trigger for the damage packet and its proc record.
  const sourceSkill = context.catalog.skillsById.get(sourceId)?.name || '';
  const earthenBlastProfile = requireBalanceProfileFromContext(context, PROFILE.earthenBlast);
  const earthenBlastStrike = requireEffect(earthenBlastProfile, 'strike', 'Earthen Blast');
  if (earthenBlastStrike) {
    emitSkillDamage(context, {
      at,
      source: 'Earthen Blast',
      sourceId,
      actorType: 'effect',
      ownerActorType: 'player',
      skillName: 'Earthen Blast',
      triggeredBy: sourceSkill,
      icon: EARTHEN_BLAST_ICON,
      coefficient: effectNumber(earthenBlastProfile, earthenBlastStrike, 'coefficient'),
      skillWeapon: 'Unequipped',
      noCrit: true
    });

    emitElementalistProc(context, {
      at,
      name: 'Earthen Blast',
      procType: 'trait',
      sourceId,
      sourceSkill,
      icon: EARTHEN_BLAST_ICON
    });
  }
}

/** Grants Rock Solid's Stability after entering Earth in combat. */
export function grantElementalistRockSolid(
  context: ElementalistSchedulerContext,
  at: number,
  sourceId: Skill['id']
): void {
  if (!combatStarted(context, at) || !hasTrait(context, 'Rock Solid')) return;
  emitProfiledBuff(context, at, PROFILE.rockSolid, 'Stability', 'Rock Solid', sourceId);
}

/** Grants Earth's Embrace Resistance from an eligible healing skill. */
export function applyEarthsEmbrace(context: ElementalistLifecycleContext, skill: Skill): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  if (!hasTrait(context, "Earth's Embrace")) return;
  const earthsEmbraceProfile = requireBalanceProfileFromContext(context, PROFILE.earthsEmbrace);
  // Claim the existing owner-local timer before any derived effect.
  if (
    !tryConsumeProcCooldown(
      state.procReadyAt,
      'earthsEmbrace',
      at,
      balanceProfileNumber(earthsEmbraceProfile, 'internalCooldown')
    )
  )
    return;
  emitProfiledBuff(context, at, PROFILE.earthsEmbrace, 'Resistance', "Earth's Embrace", skill.id);
}

/** Applies Written in Stone's signet-specific aura after a completed signet cast. */
export function applyWrittenInStone(
  context: ElementalistLifecycleContext,
  skill: Skill,
  applyAura: ElementalistAuraApplier
): void {
  if (!hasTrait(context, 'Written in Stone') || skill.skillFamily !== 'Signet') return;
  const signet =
    skill.id === ID.SIGNET_OF_RESTORATION
      ? 'Restoration'
      : skill.id === ID.SIGNET_OF_FIRE
        ? 'Fire'
        : skill.id === ID.SIGNET_OF_EARTH
          ? 'Earth'
          : null;
  if (!signet) return;
  const writtenInStoneProfile = requireBalanceProfileFromContext(context, PROFILE.writtenInStone);
  const effect = requireEffect(writtenInStoneProfile, 'buff', signet);
  if (effect) {
    applyAura(context, {
      at: context.effectiveEnd,
      aura: String(effect.kind),
      duration: Number(effect.duration),
      skillName: 'Written in Stone',
      sourceId: skill.id
    });
  }
}

/** Applies Strength of Stone after an already-classified immobilize event. */
export function applyStrengthOfStone(context: ElementalistResolverContext, event: Gw2ResolverEvent): void {
  if (!hasTrait(context, 'Strength of Stone')) return;
  const state = professionCoreState(context);
  const strengthOfStoneProfile = requireBalanceProfileFromContext(context, PROFILE.strengthOfStone);
  // Claim the existing owner-local timer before any derived effect.
  if (
    !tryConsumeProcCooldown(
      state.procReadyAt,
      'strengthOfStone',
      event.at,
      balanceProfileNumber(strengthOfStoneProfile, 'internalCooldown')
    )
  )
    return;
  const bleeding = requireEffect(strengthOfStoneProfile, 'condition', 'Strength of Stone');
  if (bleeding) {
    applyElementalistDerivedCondition(context, event, {
      source: 'Strength of Stone',
      sourceId: 'Strength of Stone',
      condition: String(bleeding.condition),
      stacks: Number(bleeding.stacks),
      duration: Number(bleeding.duration)
    });

    recordElementalistTraitProc(context, event, 'Strength of Stone');
  }
}

/** Shares Elemental Shielding's profile defaults without coupling phase-specific boon application. */
function elementalShieldingEffect(context: unknown) {
  const elementalShieldingProfile = requireBalanceProfileFromContext(context, PROFILE.elementalShielding);
  const effect = requireEffect(elementalShieldingProfile, 'boon', 'Protection');
  if (!effect) return undefined;
  return {
    kind: String(effect.boon).toLowerCase(),
    stacks: Number(effect.stacks),
    duration: Number(effect.duration)
  };
}

/** Grants scheduler-side Elemental Shielding protection for one aura application. */
export function applySchedulerElementalShielding(
  context: ElementalistSchedulerContext,
  at: number,
  skillName: string,
  sourceId: Skill['id']
): void {
  if (hasTrait(context, 'Elemental Shielding')) {
    const protection = elementalShieldingEffect(context);
    if (!protection) return;
    emitSkillBuff(context, elementalistEventSkill(context, skillName, sourceId), {
      at,
      source: skillName,
      sourceId,
      actorType: 'player',
      skillName,
      priority: 0,
      ...protection
    });
  }
}

/** Grants resolver-side Elemental Shielding protection for one classified aura event. */
export function applyResolverElementalShielding(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
  if (!hasTrait(context, 'Elemental Shielding')) return;
  const protection = elementalShieldingEffect(context);
  if (!protection) return;
  queueElementalistBuff(
    context,
    event,
    protection.kind,
    protection.stacks,
    protection.duration,
    String(event.skillName || event.name || event.source || '')
  );
}
