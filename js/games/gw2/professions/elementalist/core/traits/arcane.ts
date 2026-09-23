/** Imperative Arcane trait behavior; callers preserve cross-line ordering through the trait index. */
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber,
  requireEffect,
  effectNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { tryConsumeProcCooldown } from '#gw2/platform/combat/procs.js';
import { emitSkillBuff, emitSkillDamage } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import type {
  ElementalistCastContext as ElementalistLifecycleContext,
  ElementalistSchedulerContext,
  ElementalistResolverContext
} from '#gw2/professions/elementalist/types.js';
import type { ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import {
  elementalistEventSkill,
  emitElementalistProc,
  emitProfiledBuff,
  emitProfiledCondition
} from '#gw2/professions/elementalist/core/mechanics/effects.js';
import {
  applyElementalistDerivedCondition,
  queueElementalistBuff,
  recordElementalistTraitProc
} from '#gw2/professions/elementalist/core/mechanics/resolution-helpers.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';

/** Grants Arcane Prowess might for one completed attunement transition. */
export function applyArcaneProwess(context: ElementalistSchedulerContext, at: number, sourceId: Skill['id']): void {
  if (hasTrait(context, 'Arcane Prowess')) {
    emitProfiledBuff(context, at, PROFILE.arcaneProwess, 'Might', 'Arcane Prowess', sourceId);
  }
}

/** Grants Elemental Attunement's boon matching the element just entered. */
export function grantElementalAttunementBoon(
  context: ElementalistSchedulerContext,
  at: number,
  attunement: ElementalistAttunement,
  sourceId: Skill['id']
): void {
  if (!hasTrait(context, 'Elemental Attunement')) return;
  emitProfiledBuff(context, at, PROFILE.elementalAttunement, attunement, 'Elemental Attunement', sourceId);
}

/** Accumulates Bountiful Power swaps and grants each completed threshold's timed effects. */
export function triggerBountifulPower(
  context: ElementalistSchedulerContext,
  at: number,
  stacks: number,
  sourceId: Skill['id']
): void {
  if (!hasTrait(context, 'Bountiful Power')) return;
  const bountifulPowerProfile = requireBalanceProfileFromContext(context, PROFILE.bountifulPower);
  const threshold = balanceProfileNumber(bountifulPowerProfile, 'threshold');
  // Nonpositive custom thresholds disable this proc so each loop iteration must consume progress.
  if (threshold <= 0) return;
  const state = professionCoreState(context);
  state.bountifulPowerProgress += stacks;
  while (state.bountifulPowerProgress >= threshold) {
    state.bountifulPowerProgress -= threshold;
    emitProfiledBuff(context, at, PROFILE.bountifulPower, 'Quickness', 'Bountiful Power', sourceId);
    const active = requireEffect(bountifulPowerProfile, 'buff', 'Damage Window');
    if (active) {
      emitSkillBuff(context, elementalistEventSkill(context, 'Bountiful Power', sourceId), {
        at,
        source: 'Bountiful Power',
        sourceId,
        actorType: 'player',
        kind: 'bountiful power active',
        stacks: Number(active.stacks),
        duration: Number(active.duration),
        skillName: 'Bountiful Power'
      });
    }
  }
}

// Materialize the current attunement's dodge proc while tracking an independent elemental ICD.
export function triggerEvasiveArcana(context: ElementalistLifecycleContext, skill: Skill): void {
  if (!hasTrait(context, 'Evasive Arcana')) return;
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const attunement = state.primaryAttunement;
  const key = `evasiveArcana${attunement}`;
  const evasiveArcanaProfile = requireBalanceProfileFromContext(context, PROFILE.evasiveArcana);
  // Claim the existing owner-local timer before any derived effect.
  if (
    !tryConsumeProcCooldown(state.procReadyAt, key, at, balanceProfileNumber(evasiveArcanaProfile, 'internalCooldown'))
  )
    return;
  const source =
    attunement === 'Fire'
      ? 'Flame Burst (trait)'
      : attunement === 'Water'
        ? 'Cleansing Wave (trait)'
        : attunement === 'Air'
          ? 'Blinding Flash (trait)'
          : 'Shock Wave (trait)';
  // Water is heal/cleanse only, so it emits no offensive packet beyond the marker.
  if (attunement === 'Fire') {
    const evasiveArcanaFireStrike = requireEffect(evasiveArcanaProfile, 'strike', 'Fire');
    if (evasiveArcanaFireStrike) {
      emitSkillDamage(context, {
        at,
        source,
        sourceId: skill.id,
        actorType: 'effect',
        ownerActorType: 'player',
        skillName: source,
        coefficient: effectNumber(evasiveArcanaProfile, evasiveArcanaFireStrike, 'coefficient'),
        skillWeapon: 'Unequipped'
      });
    }

    emitProfiledCondition(context, at, PROFILE.evasiveArcana, 'Fire Burning', source, skill.id);
  } else if (attunement === 'Air') {
    context.emit({
      type: 'blind',
      at,
      source,
      sourceId: skill.id,
      actorType: 'effect',
      ownerActorType: 'player',
      skillName: source,
      controlKind: 'blind'
    });
  } else if (attunement === 'Earth') {
    const evasiveArcanaEarthStrike = requireEffect(evasiveArcanaProfile, 'strike', 'Earth');
    if (evasiveArcanaEarthStrike) {
      emitSkillDamage(context, {
        at,
        source,
        sourceId: skill.id,
        actorType: 'effect',
        skillName: source,
        coefficient: effectNumber(evasiveArcanaProfile, evasiveArcanaEarthStrike, 'coefficient'),
        skillWeapon: 'Unequipped',
        comboFinishers: [{ ownerId: 'elementalist', finisherType: 'Blast', ambiguousFieldSelection: 'oldest' }]
      });
    }

    emitProfiledCondition(context, at, PROFILE.evasiveArcana, 'Earth Bleeding', source, skill.id);
    emitProfiledCondition(context, at, PROFILE.evasiveArcana, 'Earth Cripple', source, skill.id);
  }

  context.emit({
    type: 'elementalist.evasive-arcana',
    at,
    source,
    sourceId: skill.id,
    actorType: 'effect',
    skillName: source,
    attunement
  });
  emitElementalistProc(context as never, {
    at,
    name: source,
    procType: 'trait',
    sourceId: skill.id,
    sourceSkill: skill.name
  });
}

/** Applies Arcane Lightning's shared ferocity window and named Arcane-skill follow-up. */
export function applyArcaneLightning(context: ElementalistLifecycleContext, skill: Skill): void {
  if (!hasTrait(context, 'Arcane Lightning') || skill.skillFamily !== 'Arcane') return;
  const at = context.effectiveEnd;
  const arcaneLightningProfile = requireBalanceProfileFromContext(context, PROFILE.arcaneLightning);
  const arcaneWindow = requireEffect(arcaneLightningProfile, 'buff', 'Arcane Lightning');
  if (arcaneWindow) {
    emitSkillBuff(context, skill, {
      at,
      source: skill.name,
      sourceId: skill.id,
      actorType: 'player',
      kind: 'arcane lightning',
      stacks: Number(arcaneWindow.stacks),
      duration: Number(arcaneWindow.duration),
      skillName: skill.name
    });
  }

  if (skill.id === ID.ARCANE_BRILLIANCE) {
    emitProfiledBuff(context, at, PROFILE.arcaneLightning, 'Arcane Brilliance', skill.name, skill.id);
  } else if (skill.id === ID.ARCANE_WAVE) {
    emitProfiledCondition(context, at, PROFILE.arcaneLightning, 'Arcane Wave', skill.name, skill.id);
  } else if (skill.id === ID.ARCANE_BLAST) {
    context.emit({
      type: 'blind',
      at,
      source: skill.name,
      sourceId: skill.id,
      actorType: 'effect',
      skillName: skill.name,
      controlKind: 'blind'
    });
  } else if (skill.id === ID.ARCANE_ECHO) {
    emitProfiledBuff(context, at, PROFILE.arcaneLightning, 'Arcane Echo', skill.name, skill.id);
  }
}

/** Grants Elemental Lockdown's attunement-specific boon after a classified control event. */
export function applyElementalLockdown(context: ElementalistSchedulerContext, event: SimulationEvent): void {
  const state = professionCoreState(context);
  if (!hasTrait(context, 'Elemental Lockdown')) return;
  const elementalLockdownProfile = requireBalanceProfileFromContext(context, PROFILE.elementalLockdown);
  // Claim the existing owner-local timer before any derived effect.
  if (
    !tryConsumeProcCooldown(
      state.procReadyAt,
      'elementalLockdown',
      event.at,
      balanceProfileNumber(elementalLockdownProfile, 'internalCooldown')
    )
  )
    return;

  const attunement = state.primaryAttunement;
  emitProfiledBuff(
    context,
    event.at,
    PROFILE.elementalLockdown,
    attunement,
    'Elemental Lockdown',
    event.skillId ?? event.sourceId
  );
}

/** Materializes Arcane Precision after its registered critical-hit reaction succeeds. */
export function applyArcanePrecision(context: ElementalistResolverContext, event: Gw2ResolverEvent): void {
  const attunement = professionCoreState(context).primaryAttunement;
  const arcanePrecisionProfile = requireBalanceProfileFromContext(context, PROFILE.arcanePrecision);
  const condition = requireEffect(arcanePrecisionProfile, 'condition', attunement);

  if (condition) {
    applyElementalistDerivedCondition(context, event, {
      source: 'Arcane Precision',
      sourceId: TRAIT.ARCANE_PRECISION,
      condition: String(condition.condition),
      stacks: Number(condition.stacks),
      duration: Number(condition.duration)
    });

    recordElementalistTraitProc(context, event, 'Arcane Precision');
  }
}

/** Materializes Renewing Stamina after its registered critical-hit reaction succeeds. */
export function applyRenewingStamina(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
  const renewingStaminaProfile = requireBalanceProfileFromContext(context, PROFILE.renewingStamina);
  const vigor = requireEffect(renewingStaminaProfile, 'boon', 'Vigor');
  if (vigor) {
    queueElementalistBuff(
      context,
      event,
      String(vigor.boon),
      Number(vigor.stacks),
      Number(vigor.duration),
      'Renewing Stamina'
    );
  }
}
