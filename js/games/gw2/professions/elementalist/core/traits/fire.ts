import type { SkillEffect } from '#gw2/platform/engine/skills/types.js';
import { buffApplicationStacks } from '#gw2/platform/combat/boons.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { resolverSourceSkill } from '#gw2/platform/resolver/packets.js';
/** Imperative Fire trait behavior; dispatch order remains centralized in the trait index. */
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import {
  emitElementalistBuff,
  emitElementalistCondition,
  emitElementalistDamage
} from '#gw2/professions/elementalist/core/live-events.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';
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
  context: ElementalistRuntime,
  at: number,
  sourceId: Skill['id'],
  applyAura: ElementalistAuraApplier
): void {
  if (!combatStarted(context, at) || !hasTrait(context, 'Sunspot')) return;

  // Keep strike and Burning attribution aligned with the actual attunement or overload that triggered Sunspot.
  const sourceSkill = context.helpers.skillsById.get(sourceId)?.name || '';
  const sunspotProfile = requireBalanceProfileFromContext(context, PROFILE.sunspot);
  const sunspotAura = requireEffect(sunspotProfile, 'buff', 'Sunspot Aura');
  if (sunspotAura) {
    applyAura(context, {
      at,
      aura: String(sunspotAura.kind),
      duration: Number(sunspotAura.duration),
      skillName: 'Sunspot',
      sourceId
    });
  }

  const sunspotStrike = requireEffect(sunspotProfile, 'strike', 'Sunspot');
  if (sunspotStrike) {
    emitElementalistDamage(context, {
      at,
      source: 'Sunspot',
      sourceId,
      actorType: 'effect',
      ownerActorType: 'player',
      skillName: 'Sunspot',
      icon: SUNSPOT_ICON,
      triggeredBy: sourceSkill,
      coefficient: effectNumber(sunspotProfile, sunspotStrike, 'coefficient'),
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
export function triggerFlameExpulsion(context: ElementalistRuntime, at: number, sourceId: Skill['id']): void {
  if (!combatStarted(context, at) || !hasTrait(context, "Pyromancer's Puissance")) return;

  const pyromancersPuissanceProfile = requireBalanceProfileFromContext(context, PROFILE.pyromancersPuissance);
  const impactAt = at + balanceProfileNumber(pyromancersPuissanceProfile, 'initialDelay');
  const cappedMight = Math.min(
    balanceProfileNumber(pyromancersPuissanceProfile, 'maximumStacks'),
    context.config.boons?.might
      ? Number(context.config.boons.might)
      : buffApplicationStacks(context.boons.get('might') ?? [], 'might', at, 25, {
          includes: (application) => application.resolvedAudience?.includesSelf !== false
        })
  );
  const flameExpulsionStrike = requireEffect(pyromancersPuissanceProfile, 'strike', 'Flame Expulsion');
  const flameExpulsionCondition = requireEffect(pyromancersPuissanceProfile, 'condition', 'Flame Expulsion');
  if (flameExpulsionStrike) {
    const baseCoefficient = effectNumber(pyromancersPuissanceProfile, flameExpulsionStrike, 'coefficient');
    const coefficientPerMight = balanceProfileNumber(pyromancersPuissanceProfile, 'damageIncreasePerStack');
    emitElementalistDamage(context, {
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
    const burningDurationPerMight = balanceProfileNumber(pyromancersPuissanceProfile, 'durationPerTier');

    emitElementalistCondition(context, {
      skill: elementalistEventSkill(context, 'Flame Expulsion', sourceId),
      at: impactAt,
      source: 'Flame Expulsion',
      sourceId,
      condition: String(flameExpulsionCondition.condition),
      stacks: Number(flameExpulsionCondition.stacks),
      duration: Math.min(
        baseBurningDuration + burningDurationPerMight * cappedMight,
        baseBurningDuration +
          burningDurationPerMight * balanceProfileNumber(pyromancersPuissanceProfile, 'maximumStacks')
      ),
      skillName: 'Flame Expulsion'
    });
  }

  const pyromancersPuissanceFlameExpulsionMight = requireEffect(
    pyromancersPuissanceProfile,
    'boon',
    'Flame Expulsion Might'
  );
  if (cappedMight > 0) {
    if (pyromancersPuissanceFlameExpulsionMight) {
      emitElementalistBuff(context, {
        skill: elementalistEventSkill(context, 'Flame Expulsion', sourceId),
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
      sourceSkill: context.helpers.skillsById.get(sourceId)?.name,
      icon: FLAME_EXPULSION_ICON
    });
}

/** Grants Pyromancer's Puissance might after an in-combat Fire-attuned cast. */
export function applyPyromancersPuissance(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): void {
  const at = cast.effectiveEnd;
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
    ? duration *
        balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.smotheringAuras), 'durationMultiplier')
    : duration;
}

/** Extend authored weapon Fire fields without editing already queued packets. */
export function extendPersistingFlamesEffects(
  context: ElementalistRuntime,
  skill: Skill,
  effects: readonly SkillEffect[]
): readonly SkillEffect[] {
  if (
    !hasTrait(context, 'Persisting Flames') ||
    skill.type !== 'Weapon' ||
    !skill.comboFields?.some((field) => field.fieldType === 'Fire')
  )
    return effects;
  const strikes = effects
    .flatMap((effect) =>
      effect.type !== 'strike'
        ? []
        : (
            effect.ticks ?? [
              {
                atMs: 0,
                coefficient: Number(effect.coefficient),
                damageKind: effect.damageKind,
                metadata: effect.metadata
              }
            ]
          )
            .filter((tick) => (tick.damageKind ?? effect.damageKind) === 'field-tick')
            .map((tick) => ({ effect, tick, at: Number(effect.atMs ?? 0) + Number(tick.atMs) }))
    )
    .sort((a, b) => a.at - b.at);
  const last = strikes.at(-1),
    previous = strikes.at(-2);
  if (!last || !previous || last.at <= previous.at) return effects;
  const interval = last.at - previous.at;
  const count = Math.max(
    0,
    Math.trunc(balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.persistingFlames), 'summons'))
  );
  const extra: SkillEffect[] = [];
  for (let index = 1; index <= count; index++) {
    extra.push({
      ...last.effect,
      atMs: 0,
      ticks: [
        { ...last.tick, atMs: last.at + interval * index, metadata: { ...last.tick.metadata, largeHitboxOnly: false } }
      ]
    });
    for (const effect of effects) {
      if (effect.type !== 'condition') continue;
      for (const tick of effect.ticks ?? [
        {
          atMs: 0,
          condition: String(effect.condition),
          stacks: Number(effect.stacks),
          duration: Number(effect.duration),
          metadata: effect.metadata
        }
      ]) {
        if (Number(effect.atMs ?? 0) + Number(tick.atMs) === last.at)
          extra.push({
            ...effect,
            atMs: 0,
            ticks: [
              { ...tick, atMs: last.at + interval * index, metadata: { ...tick.metadata, largeHitboxOnly: false } }
            ]
          });
      }
    }
  }

  return [...effects, ...extra];
}

/** Field registration uses the same extension as the extra authored pulses. */
export function extendPersistingFlamesFields(
  context: ElementalistRuntime,
  cast: RuntimeCast,
  fields: Skill['comboFields']
): Skill['comboFields'] {
  if (!hasTrait(context, 'Persisting Flames') || cast.skill.type !== 'Weapon') return fields;
  const extension = balanceProfileNumber(
    requireBalanceProfileFromContext(context, PROFILE.persistingFlames),
    'durationPerTier'
  );
  return fields?.map((field) =>
    field.fieldType === 'Fire' ? { ...field, duration: Number(field.duration) + extension } : field
  );
}

/** Materializes Burning Precision after its registered critical-hit reaction succeeds. */
export function applyBurningPrecision(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
  const burningPrecisionProfile = requireBalanceProfileFromContext(context, PROFILE.burningPrecision);
  const burning = requireEffect(burningPrecisionProfile, 'condition', 'Burning Precision');
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
  const persistingFlamesProfile = requireBalanceProfileFromContext(context, PROFILE.persistingFlames);
  queueElementalistBuff(
    context,
    event,
    'Persisting Flames',
    1,
    balanceProfileNumber(persistingFlamesProfile, 'durationMultiplier'),
    resolverSourceSkill(event)
  );
}
