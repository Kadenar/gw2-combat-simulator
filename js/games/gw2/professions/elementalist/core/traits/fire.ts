import { resolverSourceSkill } from '#gw2/platform/resolver/packets.js';
import { EPSILON } from '#kernel/core/clock.js';
/** Imperative Fire trait behavior; dispatch order remains centralized in the trait index. */
import {
  requireEffectFromContext,
  balanceProfileNumberFromContext,
  effectNumberFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitSkillBuff, emitSkillCondition, emitSkillDamage } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import type {
  ElementalistCastContext as ElementalistLifecycleContext,
  ElementalistSchedulerContext
} from '#gw2/professions/elementalist/types.js';
import type { ElementalistAuraApplier } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import {
  combatStarted,
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

  // Keep strike and Burning attribution aligned with the actual attunement or overload that triggered Sunspot.
  const sourceSkill = context.catalog.skillsById.get(sourceId)?.name || '';
  const sunspotAura = requireEffectFromContext(context, 'balance-profile', PROFILE.sunspot, 'buff', 'Sunspot Aura');
  if (sunspotAura) {
    applyAura(context, {
      at,
      aura: String(sunspotAura.kind),
      duration: Number(sunspotAura.duration),
      skillName: 'Sunspot',
      sourceId
    });
  }

  const sunspotStrike = requireEffectFromContext(context, 'balance-profile', PROFILE.sunspot, 'strike', 'Sunspot');
  if (sunspotStrike) {
    emitSkillDamage(context, {
      at,
      source: 'Sunspot',
      sourceId,
      actorType: 'effect',
      ownerActorType: 'player',
      skillName: 'Sunspot',
      icon: SUNSPOT_ICON,
      triggeredBy: sourceSkill,
      coefficient: effectNumberFromContext(context, 'balance-profile', PROFILE.sunspot, sunspotStrike, 'coefficient'),
      skillWeapon: 'Unequipped',
      noCrit: true
    });
  }

  const burningEmitted =
    hasTrait(context, 'Burning Rage') &&
    emitProfiledCondition(context, at, PROFILE.burningRage, 'Sunspot Burning', 'Sunspot', sourceId, sourceSkill);

  if (sunspotAura || sunspotStrike || burningEmitted)
    emitElementalistProc(context, {
      at,
      name: 'Sunspot',
      procType: 'trait',
      sourceId,
      sourceSkill,
      icon: SUNSPOT_ICON
    });
}

// Snapshot capped Might on Fire exit; the delayed blast damages enemies and grants that Might to other allies.
export function triggerFlameExpulsion(context: ElementalistSchedulerContext, at: number, sourceId: Skill['id']): void {
  if (!combatStarted(context, at) || !hasTrait(context, "Pyromancer's Puissance")) return;

  const impactAt = at + balanceProfileNumberFromContext(context, PROFILE.pyromancersPuissance, 'initialDelay');
  const cappedMight = Math.min(
    balanceProfileNumberFromContext(context, PROFILE.pyromancersPuissance, 'maximumStacks'),
    context.buffStacks('might', at)
  );
  const flameExpulsionStrike = requireEffectFromContext(
    context,
    'balance-profile',
    PROFILE.pyromancersPuissance,
    'strike',
    'Flame Expulsion'
  );
  const flameExpulsionCondition = requireEffectFromContext(
    context,
    'balance-profile',
    PROFILE.pyromancersPuissance,
    'condition',
    'Flame Expulsion'
  );
  if (flameExpulsionStrike) {
    const baseCoefficient = effectNumberFromContext(
      context,
      'balance-profile',
      PROFILE.pyromancersPuissance,
      flameExpulsionStrike,
      'coefficient'
    );
    const coefficientPerMight = balanceProfileNumberFromContext(
      context,
      PROFILE.pyromancersPuissance,
      'damageIncreasePerStack'
    );
    emitSkillDamage(context, {
      at: impactAt,
      source: 'Flame Expulsion',
      sourceId,
      actorType: 'effect',
      ownerActorType: 'player',
      skillName: 'Flame Expulsion',
      icon: FLAME_EXPULSION_ICON,
      coefficient: baseCoefficient + coefficientPerMight * cappedMight,
      skillWeapon: 'Unequipped'
    });
  }

  if (flameExpulsionCondition) {
    const baseBurningDuration = Number(flameExpulsionCondition.duration);
    const burningDurationPerMight = balanceProfileNumberFromContext(
      context,
      PROFILE.pyromancersPuissance,
      'durationPerTier'
    );

    emitSkillCondition(context, {
      skill: elementalistEventSkill(context, 'Flame Expulsion', sourceId),
      at: impactAt,
      source: 'Flame Expulsion',
      sourceId,
      condition: String(flameExpulsionCondition.condition),
      stacks: Number(flameExpulsionCondition.stacks),
      duration: Math.min(
        baseBurningDuration + burningDurationPerMight * cappedMight,
        baseBurningDuration +
          burningDurationPerMight *
            balanceProfileNumberFromContext(context, PROFILE.pyromancersPuissance, 'maximumStacks')
      ),
      skillName: 'Flame Expulsion'
    });
  }

  const pyromancersPuissanceFlameExpulsionMight = requireEffectFromContext(
    context,
    'balance-profile',
    PROFILE.pyromancersPuissance,
    'boon',
    'Flame Expulsion Might'
  );
  if (cappedMight > 0) {
    if (pyromancersPuissanceFlameExpulsionMight) {
      emitSkillBuff(context, elementalistEventSkill(context, 'Flame Expulsion', sourceId), {
        at: impactAt,
        source: 'Flame Expulsion',
        sourceId,
        skillName: 'Flame Expulsion',
        kind: String(pyromancersPuissanceFlameExpulsionMight.boon).toLowerCase(),
        stacks: cappedMight,
        duration: Number(pyromancersPuissanceFlameExpulsionMight.duration),
        audience: { recipients: 'party', affectsSelf: false, maximumRecipients: 5 }
      });
    }
  }

  if (flameExpulsionStrike || flameExpulsionCondition || (cappedMight > 0 && pyromancersPuissanceFlameExpulsionMight))
    emitElementalistProc(context, {
      at: impactAt,
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
  emitProfiledBuff(context, at, PROFILE.pyromancersPuissance, 'Attunement Might', skill.name, skill.id);
}

/** Applies Smothering Auras' profile-driven duration multiplier once. */
export function elementalistAuraDuration(context: unknown, duration: number): number {
  return hasTrait(context, 'Smothering Auras')
    ? duration * balanceProfileNumberFromContext(context, PROFILE.smotheringAuras, 'durationMultiplier')
    : duration;
}

// Extend weapon Fire-field packets identified by catalog metadata, preserving their authored cadence.
export function extendPersistingFlamesPackets(context: ElementalistLifecycleContext, skill: Skill): void {
  if (
    !hasTrait(context, 'Persisting Flames') ||
    skill.type !== 'Weapon' ||
    !skill.comboFields?.some((field) => field.fieldType === 'Fire')
  )
    return;

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
  if (!(interval > EPSILON)) return;
  const attachedConditions = context.events.filter(
    (event) =>
      event.activationId === context.reservationId &&
      event.type === 'condition' &&
      Math.abs(event.at - template.at) <= EPSILON
  );
  const extraPackets = Math.max(
    0,
    Math.trunc(balanceProfileNumberFromContext(context, PROFILE.persistingFlames, 'summons'))
  );
  for (let index = 1; index <= extraPackets; index += 1) {
    const at = template.at + interval * index;
    context.emit({ ...template, at, metadata: { ...template.metadata, largeHitboxOnly: false } });
    for (const condition of attachedConditions) {
      context.emit({ ...condition, at, metadata: { ...condition.metadata, largeHitboxOnly: false } });
    }
  }
}

/** Extend scheduled Fire fields from weapon skills; profession fields only qualify for stack generation. */
export function extendPersistingFlamesField(context: ElementalistSchedulerContext, event: SimulationEvent): void {
  if (
    event.type !== 'action' ||
    !hasTrait(context, 'Persisting Flames') ||
    context.catalog.skillsById.get(event.skillId ?? event.sourceId ?? '')?.type !== 'Weapon'
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
      Number(field.expiresAt) + balanceProfileNumberFromContext(context, PROFILE.persistingFlames, 'durationPerTier')
  });
}

/** Materializes Burning Precision after its registered critical-hit reaction succeeds. */
export function applyBurningPrecision(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
  const burning = requireEffectFromContext(
    context,
    'balance-profile',
    PROFILE.burningPrecision,
    'condition',
    'Burning Precision'
  );
  if (burning) {
    applyElementalistDerivedCondition(context, event, {
      source: 'Burning Precision',
      procCount: 1,
      sourceId: TRAIT.BURNING_PRECISION,
      condition: String(burning.condition),
      stacks: Number(burning.stacks),
      duration: Number(burning.duration)
    });

    recordElementalistTraitProc(context, event, 'Burning Precision');
  }
}

/** Grants one resolver-side Persisting Flames stack from a classified field tick or Burning application. */
export function grantPersistingFlames(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
  if (!hasTrait(context, 'Persisting Flames')) return;
  queueElementalistBuff(
    context,
    event,
    'Persisting Flames',
    1,
    balanceProfileNumberFromContext(context, PROFILE.persistingFlames, 'durationMultiplier'),
    resolverSourceSkill(event)
  );
}
