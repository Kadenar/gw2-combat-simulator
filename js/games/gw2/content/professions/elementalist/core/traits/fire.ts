/** Imperative Fire trait behavior; dispatch order remains centralized in the trait index. */
import {
  balanceProfileEffectFromContext,
  balanceProfileValue,
  balanceProfileValueFromContext
} from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillCondition, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { SimulationEvent, Skill } from '#gw2/platform/engine/types.js';
import type { Gw2ResolverEvent, Gw2ResolverRuntime } from '#gw2/platform/resolver/types.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/content/professions/elementalist/data/ids.js';
import type {
  ElementalistCastContext as ElementalistLifecycleContext,
  ElementalistSchedulerContext
} from '#gw2/content/professions/elementalist/types.js';
import { PERSISTING_FLAMES_FIELD_SKILLS } from '#gw2/content/professions/elementalist/core/constants.js';
import type { ElementalistAuraApplier } from '#gw2/content/professions/elementalist/core/mechanics/effects.js';
import {
  combatStarted,
  elementalistEventSkill,
  emitElementalistProc,
  emitProfiledBuff,
  emitProfiledCondition
} from '#gw2/content/professions/elementalist/core/mechanics/effects.js';
import {
  applyElementalistDerivedCondition,
  elementalistSourceSkill,
  queueElementalistBuff,
  recordElementalistTraitProc
} from '#gw2/content/professions/elementalist/core/mechanics/resolution-helpers.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/elementalist/core/profiles.js';

const SUNSPOT_ICON = 'https://render.guildwars2.com/file/1405047ED70DE30F80B1F6304A787B215BB50878/1012316.png';
const FLAME_EXPULSION_ICON = 'https://render.guildwars2.com/file/998095CB1FD2CF0164B8A36BABFDB911DF08DB02/1012313.png';

// Materialize Sunspot's aura, strike, Burning, and proc at the entry timestamp.
export function triggerSunspot(
  context: ElementalistSchedulerContext,
  at: number,
  sourceId: Skill['id'],
  applyAura: ElementalistAuraApplier
): void {
  if (!combatStarted(context, at) || !hasTrait(context, 'Sunspot')) return;

  applyAura(context, {
    at,
    aura: 'Fire Aura',
    duration: balanceProfileValue(
      balanceProfileEffectFromContext(context, PROFILE.sunspot, 'buff', 0, 'Sunspot Aura'),
      'duration',
      3
    ),
    skillName: 'Sunspot',
    sourceId
  });
  emitSkillDamage(context, {
    at,
    source: 'Sunspot',
    sourceId,
    actorType: 'effect',
    ownerActorType: 'player',
    skillName: 'Sunspot',
    icon: SUNSPOT_ICON,
    coefficient: balanceProfileValue(
      balanceProfileEffectFromContext(context, PROFILE.sunspot, 'strike', 0, 'Sunspot'),
      'coefficient',
      0.6
    ),
    skillWeapon: 'Unequipped',
    noCrit: true
  });
  if (hasTrait(context, 'Burning Rage')) {
    emitProfiledCondition(context, at, PROFILE.burningRage, 'Sunspot Burning', 'Burning', 2, 4, 'Sunspot', sourceId);
  }

  emitElementalistProc(context, {
    at,
    name: 'Sunspot',
    procType: 'trait',
    sourceId,
    sourceSkill: context.catalog.skillsById.get(sourceId)?.name,
    icon: SUNSPOT_ICON
  });
}

// Snapshot capped might on Fire exit so the strike and Burning share deterministic scaling.
export function triggerFlameExpulsion(context: ElementalistSchedulerContext, at: number, sourceId: Skill['id']): void {
  if (!combatStarted(context, at) || !hasTrait(context, "Pyromancer's Puissance")) return;

  const cappedMight = Math.min(
    balanceProfileValueFromContext(context, PROFILE.pyromancersPuissance, 'maximumStacks', 10),
    context.buffStacks('might', at)
  );
  const flameExpulsionStrike = balanceProfileEffectFromContext(
    context,
    PROFILE.pyromancersPuissance,
    'strike',
    0,
    'Flame Expulsion'
  );
  const flameExpulsionCondition = balanceProfileEffectFromContext(
    context,
    PROFILE.pyromancersPuissance,
    'condition',
    0,
    'Flame Expulsion'
  );
  const baseCoefficient = balanceProfileValue(flameExpulsionStrike, 'coefficient', 1);
  const coefficientPerMight = balanceProfileValueFromContext(
    context,
    PROFILE.pyromancersPuissance,
    'damageIncreasePerStack',
    0.1
  );
  const baseBurningDuration = balanceProfileValue(flameExpulsionCondition, 'duration', 2);
  const burningDurationPerMight = balanceProfileValueFromContext(
    context,
    PROFILE.pyromancersPuissance,
    'durationPerTier',
    0.5
  );
  emitSkillDamage(context, {
    at,
    source: 'Flame Expulsion',
    sourceId,
    actorType: 'effect',
    ownerActorType: 'player',
    skillName: 'Flame Expulsion',
    icon: FLAME_EXPULSION_ICON,
    coefficient: baseCoefficient + coefficientPerMight * cappedMight,
    skillWeapon: 'Unequipped'
  });
  emitSkillCondition(context, elementalistEventSkill(context, 'Flame Expulsion', sourceId), {
    at,
    source: 'Flame Expulsion',
    sourceId,
    actorType: 'player',
    condition: 'Burning',
    stacks: balanceProfileValue(flameExpulsionCondition, 'stacks', 1),
    duration: Math.min(
      baseBurningDuration + burningDurationPerMight * cappedMight,
      baseBurningDuration +
        burningDurationPerMight *
          balanceProfileValueFromContext(context, PROFILE.pyromancersPuissance, 'maximumStacks', 10)
    ),
    skillName: 'Flame Expulsion'
  });
  emitElementalistProc(context, {
    at,
    name: 'Flame Expulsion',
    procType: 'trait',
    sourceId,
    sourceSkill: context.catalog.skillsById.get(sourceId)?.name,
    icon: FLAME_EXPULSION_ICON
  });
}

/** Grants Pyromancer's Puissance might after an in-combat Fire-attuned cast. */
export function applyPyromancersPuissance(context: ElementalistLifecycleContext, skill: Skill): void {
  const at = context.effectiveEnd;
  if (
    !hasTrait(context, "Pyromancer's Puissance") ||
    professionCoreState(context).primaryAttunement !== 'Fire' ||
    !combatStarted(context, at)
  )
    return;
  emitProfiledBuff(context, at, PROFILE.pyromancersPuissance, 'Attunement Might', 'Might', 1, 15, skill.name, skill.id);
}

/** Applies Smothering Auras' profile-driven duration multiplier once. */
export function elementalistAuraDuration(context: unknown, duration: number): number {
  return hasTrait(context, 'Smothering Auras')
    ? duration * balanceProfileValueFromContext(context, PROFILE.smotheringAuras, 'durationMultiplier', 1.33)
    : duration;
}

// Clone only the final authored field packet and its attached conditions at the measured cadence.
export function extendPersistingFlamesPackets(context: ElementalistLifecycleContext, skill: Skill): void {
  if (!hasTrait(context, 'Persisting Flames') || !PERSISTING_FLAMES_FIELD_SKILLS.has(Number(skill.id))) return;

  const fieldPackets = context.events
    .filter(
      (event) =>
        event.activationId === context.reservationId && event.type === 'damage' && event.damageKind === 'field-tick'
    )
    .sort((left, right) => left.at - right.at);
  if (fieldPackets.length < 2) return;
  const template = fieldPackets.at(-1);
  const previous = fieldPackets.at(-2);
  if (!template || !previous) return;
  const interval = template.at - previous.at;
  if (!(interval > context.epsilon)) return;
  const attachedConditions = context.events.filter(
    (event) =>
      event.activationId === context.reservationId &&
      event.type === 'condition' &&
      Math.abs(event.at - template.at) <= context.epsilon
  );
  const extraPackets = Math.max(
    0,
    Math.trunc(balanceProfileValueFromContext(context, PROFILE.persistingFlames, 'summons', 2))
  );
  for (let index = 1; index <= extraPackets; index += 1) {
    const at = template.at + interval * index;
    context.emit({ ...template, at, largeHitboxOnly: false });
    for (const condition of attachedConditions) context.emit({ ...condition, at, largeHitboxOnly: false });
  }
}

/** Extends the active fire field selected for Persisting Flames and its scheduled field event. */
export function extendPersistingFlamesField(context: ElementalistSchedulerContext, event: SimulationEvent): void {
  if (
    event.type !== 'action' ||
    !hasTrait(context, 'Persisting Flames') ||
    !PERSISTING_FLAMES_FIELD_SKILLS.has(Number(event.skillId ?? event.sourceId))
  )
    return;
  const field = context.events.find(
    (candidate) =>
      candidate.type === 'combo_field' &&
      candidate.activationId === event.activationId &&
      candidate.fieldType === 'Fire'
  );
  if (!field) return;
  context.replaceEvent(field, {
    expiresAt:
      Number(field.expiresAt) + balanceProfileValueFromContext(context, PROFILE.persistingFlames, 'durationPerTier', 2)
  });
}

/** Materializes Burning Precision after its registered critical-hit reaction succeeds. */
export function applyBurningPrecision(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
  const burning = balanceProfileEffectFromContext(
    context,
    PROFILE.burningPrecision,
    'condition',
    0,
    'Burning Precision'
  );
  applyElementalistDerivedCondition(context, event, {
    source: 'Burning Precision',
    sourceId: TRAIT.BURNING_PRECISION,
    condition: String(burning?.condition || 'Burning'),
    stacks: Number(burning?.stacks ?? 1),
    duration: Number(burning?.duration ?? 3)
  });
  recordElementalistTraitProc(context, event, 'Burning Precision');
}

/** Grants one resolver-side Persisting Flames stack from a classified field tick or Burning application. */
export function grantPersistingFlames(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
  if (!hasTrait(context, 'Persisting Flames')) return;
  queueElementalistBuff(
    context,
    event,
    'Persisting Flames',
    1,
    balanceProfileValueFromContext(context, PROFILE.persistingFlames, 'durationMultiplier', 15),
    elementalistSourceSkill(event)
  );
}
