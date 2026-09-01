/** Imperative Arcane trait behavior; callers preserve cross-line ordering through the trait index. */
import {
  balanceProfileEffectFromContext,
  balanceProfileValue,
  balanceProfileValueFromContext
} from '#gw2/platform/combat/state/balance-profiles.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { emitSkillBuff, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { SimulationEvent, Skill } from '#gw2/platform/engine/types.js';
import type { Gw2ResolverEvent, Gw2ResolverRuntime } from '#gw2/platform/resolver/types.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/content/professions/elementalist/data/ids.js';
import type {
  ElementalistCastContext as ElementalistLifecycleContext,
  ElementalistSchedulerContext
} from '#gw2/content/professions/elementalist/types.js';
import type { ElementalistAttunement } from '#gw2/content/professions/elementalist/core/state.js';
import {
  elementalistEventSkill,
  emitElementalistProc,
  emitProfiledBuff,
  emitProfiledCondition
} from '#gw2/content/professions/elementalist/core/mechanics/effects.js';
import {
  applyElementalistDerivedCondition,
  elementalistResolverCoreState,
  queueElementalistBuff,
  recordElementalistTraitProc
} from '#gw2/content/professions/elementalist/core/mechanics/resolution-helpers.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/elementalist/core/profiles.js';

/** Grants Arcane Prowess might for one completed attunement transition. */
export function applyArcaneProwess(context: ElementalistSchedulerContext, at: number, sourceId: Skill['id']): void {
  if (hasTrait(context, 'Arcane Prowess')) {
    emitProfiledBuff(context, at, PROFILE.arcaneProwess, 'Might', 'Might', 1, 8, 'Arcane Prowess', sourceId);
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
  const fallback: Readonly<Record<ElementalistAttunement, readonly [string, number, number]>> = {
    Fire: ['Might', 1, 15],
    Water: ['Regeneration', 1, 5],
    Air: ['Swiftness', 1, 8],
    Earth: ['Protection', 1, 5]
  };
  const [kind, stacks, duration] = fallback[attunement];
  emitProfiledBuff(
    context,
    at,
    PROFILE.elementalAttunement,
    attunement,
    kind,
    stacks,
    duration,
    'Elemental Attunement',
    sourceId
  );
}

/** Accumulates Bountiful Power swaps and grants each completed threshold's timed effects. */
export function triggerBountifulPower(
  context: ElementalistSchedulerContext,
  at: number,
  stacks: number,
  sourceId: Skill['id']
): void {
  if (!hasTrait(context, 'Bountiful Power')) return;
  const state = professionCoreState(context);
  state.bountifulPowerProgress += stacks;
  const threshold = balanceProfileValueFromContext(context, PROFILE.bountifulPower, 'threshold', 5);
  while (state.bountifulPowerProgress >= threshold) {
    state.bountifulPowerProgress -= threshold;
    emitProfiledBuff(context, at, PROFILE.bountifulPower, 'Quickness', 'Quickness', 1, 5, 'Bountiful Power', sourceId);
    const active = balanceProfileEffectFromContext(context, PROFILE.bountifulPower, 'buff', 0, 'Damage Window');
    emitSkillBuff(context, elementalistEventSkill(context, 'Bountiful Power', sourceId), {
      at,
      source: 'Bountiful Power',
      sourceId,
      actorType: 'player',
      kind: 'bountiful power active',
      stacks: Number(active?.stacks ?? 1),
      duration: Number(active?.duration ?? 7),
      skillName: 'Bountiful Power'
    });
  }
}

// Materialize the current attunement's dodge proc while tracking an independent elemental ICD.
export function triggerEvasiveArcana(context: ElementalistLifecycleContext, skill: Skill): void {
  if (!hasTrait(context, 'Evasive Arcana')) return;
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const attunement = state.primaryAttunement;
  const key = `evasiveArcana${attunement}`;
  if (!isInternalCooldownReady(at, Number(state.procReadyAt[key] || 0))) return;
  state.procReadyAt[key] = at + balanceProfileValueFromContext(context, PROFILE.evasiveArcana, 'internalCooldown', 10);
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
    emitSkillDamage(context, {
      at,
      source,
      sourceId: skill.id,
      actorType: 'effect',
      ownerActorType: 'player',
      skillName: source,
      coefficient: balanceProfileValue(
        balanceProfileEffectFromContext(context, PROFILE.evasiveArcana, 'strike', 0, 'Fire'),
        'coefficient',
        1
      ),
      skillWeapon: 'Unequipped'
    });
    emitProfiledCondition(context, at, PROFILE.evasiveArcana, 'Fire Burning', 'Burning', 3, 6, source, skill.id);
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
    emitSkillDamage(context, {
      at,
      source,
      sourceId: skill.id,
      actorType: 'effect',
      skillName: source,
      coefficient: balanceProfileValue(
        balanceProfileEffectFromContext(context, PROFILE.evasiveArcana, 'strike', 0, 'Earth'),
        'coefficient',
        0.5
      ),
      skillWeapon: 'Unequipped',
      comboFinishers: [{ ownerId: 'elementalist', finisherType: 'Blast', ambiguousFieldSelection: 'oldest' }]
    });
    emitProfiledCondition(context, at, PROFILE.evasiveArcana, 'Earth Bleeding', 'Bleeding', 1, 20, source, skill.id);
    emitProfiledCondition(context, at, PROFILE.evasiveArcana, 'Earth Cripple', 'Cripple', 1, 2, source, skill.id);
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
  const arcaneWindow = balanceProfileEffectFromContext(context, PROFILE.arcaneLightning, 'buff', 0, 'Arcane Lightning');
  emitSkillBuff(context, skill, {
    at,
    source: skill.name,
    sourceId: skill.id,
    actorType: 'player',
    kind: 'arcane lightning',
    stacks: Number(arcaneWindow?.stacks ?? 1),
    duration: Number(arcaneWindow?.duration ?? 15),
    skillName: skill.name
  });
  if (skill.id === ID.ARCANE_BRILLIANCE) {
    emitProfiledBuff(
      context,
      at,
      PROFILE.arcaneLightning,
      'Arcane Brilliance',
      'Protection',
      1,
      3.5,
      skill.name,
      skill.id
    );
  } else if (skill.id === ID.ARCANE_WAVE) {
    emitProfiledCondition(
      context,
      at,
      PROFILE.arcaneLightning,
      'Arcane Wave',
      'Immobilized',
      1,
      2,
      skill.name,
      skill.id
    );
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
    emitProfiledBuff(context, at, PROFILE.arcaneLightning, 'Arcane Echo', 'Quickness', 1, 4, skill.name, skill.id);
  }
}

/** Grants Elemental Lockdown's attunement-specific boon after a classified control event. */
export function applyElementalLockdown(context: ElementalistSchedulerContext, event: SimulationEvent): void {
  const state = professionCoreState(context);
  if (
    !hasTrait(context, 'Elemental Lockdown') ||
    !isInternalCooldownReady(event.at, Number(state.procReadyAt.elementalLockdown || 0))
  )
    return;
  state.procReadyAt.elementalLockdown =
    event.at + balanceProfileValueFromContext(context, PROFILE.elementalLockdown, 'internalCooldown', 1);
  const fallback: Readonly<Record<ElementalistAttunement, readonly [string, number, number]>> = {
    Fire: ['Might', 5, 5],
    Water: ['Regeneration', 1, 10],
    Air: ['Fury', 1, 5],
    Earth: ['Protection', 1, 4]
  };
  const attunement = state.primaryAttunement;
  const [kind, stacks, duration] = fallback[attunement];
  emitProfiledBuff(
    context,
    event.at,
    PROFILE.elementalLockdown,
    attunement,
    kind,
    stacks,
    duration,
    'Elemental Lockdown',
    event.skillId ?? event.sourceId
  );
}

/** Materializes Arcane Precision after its registered critical-hit reaction succeeds. */
export function applyArcanePrecision(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
  const attunement = elementalistResolverCoreState(context).primaryAttunement;
  const condition = balanceProfileEffectFromContext(context, PROFILE.arcanePrecision, 'condition', 0, attunement);
  const fallback = {
    Fire: { condition: 'Burning', duration: 1.5 },
    Water: { condition: 'Vulnerability', duration: 10 },
    Air: { condition: 'Weakness', duration: 3 },
    Earth: { condition: 'Bleeding', duration: 5 }
  }[attunement];
  applyElementalistDerivedCondition(context, event, {
    source: 'Arcane Precision',
    sourceId: TRAIT.ARCANE_PRECISION,
    condition: String(condition?.condition || fallback.condition),
    stacks: Number(condition?.stacks ?? 1),
    duration: Number(condition?.duration ?? fallback.duration)
  });
  recordElementalistTraitProc(context, event, 'Arcane Precision');
}

/** Materializes Renewing Stamina after its registered critical-hit reaction succeeds. */
export function applyRenewingStamina(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
  const vigor = balanceProfileEffectFromContext(context, PROFILE.renewingStamina, 'boon', 0, 'Vigor');
  queueElementalistBuff(
    context,
    event,
    String(vigor?.boon || 'Vigor'),
    Number(vigor?.stacks ?? 1),
    Number(vigor?.duration ?? 5),
    'Renewing Stamina'
  );
}
