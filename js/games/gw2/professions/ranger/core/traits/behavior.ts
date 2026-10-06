import { boonActive, skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { claimActivation } from '#gw2/platform/combat/procs/activation-claims.js';
import { grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { Gw2NumericStatKey, Gw2ResolvedStats } from '#gw2/platform/combat/stats.js';

import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { gw2PrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import type { ResolvedCriticalHitOptions } from '#gw2/platform/profession-definition/critical-proc-handler.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { buildResolverBuff, buildResolverCondition } from '#gw2/platform/effects/packet-builders.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
import { buildRangerPacket } from '#gw2/professions/ranger/core/events.js';
import { rangerPetBaseAttributes } from '#gw2/professions/ranger/core/mechanics/pet-profiles.js';
import {
  isPetStrike,
  isPlayerStrike,
  buildRangerBleeding,
  buildRangerCondition,
  targetHealthFraction
} from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { rangerPetByName } from '#gw2/professions/ranger/core/state.js';
import {
  activePetFamily,
  positional,
  weaponSetIncludes
} from '#gw2/professions/ranger/core/traits/modifier-queries.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type {
  RangerModifierContext,
  RangerResolverContext,
  RangerRuntime,
  RangerSkill
} from '#gw2/professions/ranger/types.js';

/** Owns Core Ranger Marksmanship opening-strike and target-health trait behavior. */

// Spend the player or pet Opening Strike independently on its first qualifying
// hit and attach Vulnerability plus Alpha Focus when selected.
export function consumeOpeningStrike(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (!hasTrait(context, TRAIT.OPENING_STRIKE)) return;
  const state = professionCoreState(context);
  const player = isPlayerStrike(event);
  const pet = isPetStrike(event);
  if ((!player && !pet) || !(Number(event.coefficient) > 0)) return;
  const ready = player ? state.playerOpeningStrikeReady : state.petOpeningStrikeReady;
  if (!ready) return;
  const openingStrikeProfile = requireBalanceProfileFromContext(context, TRAIT.OPENING_STRIKE);
  const openingStrike = requireEffect(openingStrikeProfile, 'condition', 'Vulnerability');
  const alphaFocusProfile = hasTrait(context, TRAIT.ALPHA_FOCUS)
    ? requireBalanceProfileFromContext(context, TRAIT.ALPHA_FOCUS)
    : undefined;
  const alphaFocus = alphaFocusProfile && requireEffect(alphaFocusProfile, 'condition', 'Crippled');
  // Readiness is spent by a delivered opener; with every opener packet removed it stays armed.
  if (!openingStrike && !alphaFocus) return;
  if (player) state.playerOpeningStrikeReady = false;
  else state.petOpeningStrikeReady = false;
  if (openingStrike)
    context.effects.emit({
      kind: 'packet',
      event: buildResolverCondition({
        at: event.at,
        source: 'Trait',
        sourceId: TRAIT.OPENING_STRIKE,
        actorType: 'effect',
        skillId: TRAIT.OPENING_STRIKE,
        skillName: 'Opening Strike',
        name: 'Opening Strike - Vulnerability',
        condition: String(openingStrike.condition),
        duration: effectNumber(openingStrikeProfile, openingStrike, 'duration'),
        stacks: effectNumber(openingStrikeProfile, openingStrike, 'stacks'),
        triggeredBy: event.skillName
      })
    });
  if (alphaFocusProfile && alphaFocus) {
    context.effects.emit({
      kind: 'packet',
      event: buildRangerCondition(
        context,
        event,
        String(alphaFocus.condition),
        effectNumber(alphaFocusProfile, alphaFocus, 'duration'),
        effectNumber(alphaFocusProfile, alphaFocus, 'stacks'),
        TRAIT.ALPHA_FOCUS,
        'Alpha Focus'
      )
    });
  }
}

// Convert the target's current health tier into ICD-bound Might stacks on a
// qualifying player strike, using the resolver's cumulative damage state.
export function triggerHuntersGaze(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (!isPlayerStrike(event) || !hasTrait(context, TRAIT.HUNTERS_GAZE)) return;
  const health = targetHealthFraction(context);
  const profile = requireBalanceProfileFromContext(context, TRAIT.HUNTERS_GAZE);
  const might = requireEffect(profile, 'boon', 'might');
  // The cooldown and proc record exist only for the might packet.
  if (!might) return;
  const maximumStacks = balanceProfileNumber(profile, 'maximumStacks');
  const stacks =
    health < 0.25
      ? maximumStacks
      : health < 0.5
        ? Math.max(0, maximumStacks - 1)
        : health < 0.75
          ? Math.max(0, maximumStacks - 2)
          : 0;
  // Target health must yield actual Might stacks before this hit claims the interval.
  if (!stacks || !context.procs.claim(TRAIT.HUNTERS_GAZE, 'ranger.core.huntersGaze', event.at)) return;
  context.effects.emit({
    attribution: { source: 'Trait', sourceId: TRAIT.HUNTERS_GAZE, actorType: 'effect' },
    kind: 'announcement',
    announcement: {
      type: 'trait',
      name: "Hunter's Gaze",
      at: event.at,
      sourceSkill: event.skillName,
      detail: `${stacks} might`,
      icon: context.helpers.skillsById.get(TRAIT.HUNTERS_GAZE)?.icon || ''
    }
  });
  context.effects.emit({
    kind: 'packet',
    event: buildResolverBuff({
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.HUNTERS_GAZE,
      actorType: 'effect',
      skillId: TRAIT.HUNTERS_GAZE,
      skillName: "Hunter's Gaze",
      name: "Hunter's Gaze - Might",
      kind: String(might.boon),
      duration: effectNumber(profile, might, 'duration'),
      stacks,
      triggeredBy: event.skillName
    }),
    durationContext: event
  });
}

export function reactToRangerCoreBuff(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const kind = (event.kind || '').toLowerCase();
  if (kind === 'fury' && event.resolvedAudience?.includesSelf && hasTrait(context, TRAIT.REMORSELESS)) {
    const state = professionCoreState(context);
    state.playerOpeningStrikeReady = true;
    state.petOpeningStrikeReady = true;
  }
}

/** Applies the trait at the accepted Beast-skill boundary. */
export function applyWolfsong(context: RangerRuntime, skill: RangerSkill): void {
  if (
    hasTrait(context, TRAIT.WOLFSONG) &&
    rangerPetByName(professionCoreState(context).activePet).family === 'canine'
  ) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.WOLFSONG);
    const effect = requireEffect(profile, 'condition', 'Vulnerability');
    if (effect)
      context.effects.emit({
        kind: 'packet',
        event: buildRangerPacket(
          {
            at: context.time,
            source: 'Trait',
            actorType: 'effect',
            skillId: TRAIT.WOLFSONG,
            skillName: 'Wolfsong',
            name: 'Wolfsong - Vulnerability',
            condition: String(effect.condition),
            duration: effectNumber(profile, effect, 'duration'),
            stacks: effectNumber(profile, effect, 'stacks'),
            triggeredBy: skill.name
          },
          'condition'
        )
      });
  }
}

/** Completes the lesser warhorn package after the pet swap. */
export function applyClarionBond(context: RangerRuntime, skill: RangerSkill): void {
  const at = context.time;
  if (
    hasTrait(context, TRAIT.CLARION_BOND) &&
    context.procs.claim(TRAIT.CLARION_BOND, 'ranger.core.clarionBond', context.time)
  ) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.CLARION_BOND);
    // The blast finisher is part of the lesser warhorn package, so the cooldown survives removed boons.
    context.effects.emit({
      kind: 'profile',
      profile: profile,
      effects: profile.effects?.filter((effect) => effect.type === 'boon'),
      at,
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.CLARION_BOND,
        actorType: 'effect',
        skillId: TRAIT.CLARION_BOND,
        skillName: 'Clarion Bond',
        triggeredBy: skill.name
      },
      transform: (event) => ({
        ...event,
        name: 'Clarion Bond - ' + event.kind,
        boon: event.kind,
        audience: { recipients: 'party', maximumRecipients: 5 }
      })
    });

    const weakness = requireEffect(profile, 'condition', 'Weakness');
    if (weakness)
      context.effects.emit({
        kind: 'packet',
        event: buildRangerPacket(
          {
            at,
            source: 'Trait',
            actorType: 'effect',
            skillId: TRAIT.CLARION_BOND,
            skillName: 'Clarion Bond',
            name: 'Lesser Call of the Wild - Weakness',
            condition: String(weakness.condition),
            duration: effectNumber(profile, weakness, 'duration'),
            stacks: effectNumber(profile, weakness, 'stacks'),
            triggeredBy: skill.name
          },
          'condition'
        )
      });
    context.effects.emit({
      kind: 'packet',
      event: {
        type: 'proc',
        at,
        source: 'Trait',
        sourceId: TRAIT.CLARION_BOND,
        actorType: 'effect',
        skillId: TRAIT.CLARION_BOND,
        skillName: 'Clarion Bond',
        name: 'Lesser Call of the Wild - Blast Finisher',
        triggeredBy: skill.name,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      }
    });
  }
}

/** Applies the trait at the accepted Beast-skill boundary. */
export function applyRejuvenation(context: RangerRuntime, skill: RangerSkill): void {
  if (hasTrait(context, TRAIT.REJUVENATION)) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.REJUVENATION);
    const effect = requireEffect(profile, 'boon', 'regeneration');
    // The cooldown gates only regeneration, so a removed boon leaves the trait ready.
    if (effect && context.procs.claim(TRAIT.REJUVENATION, 'ranger.core.rejuvenation', context.time)) {
      const kind = String(effect.boon);
      context.effects.emit({
        kind: 'packet',
        event: buildRangerPacket(
          {
            at: context.time,
            source: 'Trait',
            sourceId: TRAIT.REJUVENATION,
            actorType: 'effect',
            skillId: TRAIT.REJUVENATION,
            skillName: 'Rejuvenation',
            name: `Rejuvenation - ${kind}`,
            kind,
            boon: kind,
            duration: effectNumber(profile, effect, 'duration'),
            stacks: effectNumber(profile, effect, 'stacks'),
            audience: { recipients: 'party' as const, maximumRecipients: 5 },
            triggeredBy: skill.name
          },
          'buff'
        )
      });
    }
  }
}

/** Grants combat-only arrival boons before Clarion Bond. */
export function applySpiritedArrival(context: RangerRuntime, skill: RangerSkill): void {
  const at = context.time;
  const inCombat = context.combatStartTime != null && context.time >= context.combatStartTime;
  if (inCombat && hasTrait(context, TRAIT.SPIRITED_ARRIVAL)) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.SPIRITED_ARRIVAL);
    context.effects.emit({
      kind: 'profile',
      profile: profile,
      effects: profile.effects?.filter((effect) => effect.type === 'boon'),
      at,
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.SPIRITED_ARRIVAL,
        actorType: 'effect',
        skillId: TRAIT.SPIRITED_ARRIVAL,
        skillName: 'Spirited Arrival',
        triggeredBy: skill.name
      },
      transform: (event) => ({
        ...event,
        name: 'Spirited Arrival - ' + event.kind,
        boon: event.kind,
        audience: { recipients: 'party', maximumRecipients: 5 }
      })
    });
  }
}

/** Applies the trait contribution at the shared attribute reconciliation boundary. */
export function applyWellspringPlayerAttributes(
  context: Gw2ModifierContext,
  adjust: (attribute: Gw2NumericStatKey, amount: number) => void
): void {
  if (hasTrait(context, TRAIT.WELLSPRING))
    adjust(
      'healingPower',
      (context.config?.stats?.power || 0) *
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.WELLSPRING), 'attributeConversion')
    );
}

/** Applies the trait contribution at the shared attribute reconciliation boundary. */
export function applyLingeringMagicAttributes(
  context: Gw2ModifierContext,
  adjust: (attribute: Gw2NumericStatKey, amount: number) => void
): void {
  if (hasTrait(context, TRAIT.LINGERING_MAGIC))
    adjust(
      'concentration',
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.LINGERING_MAGIC), 'attributeBonus')
    );
}

/** Replaces the player's calculated Wellspring conversion with the pet's actual power. */
export function applyWellspringPetAttributes(
  context: RangerModifierContext,
  result: Gw2ResolvedStats,
  adjust: (attribute: Gw2NumericStatKey, amount: number) => void,
  staticRulesApplied: boolean
): void {
  if (!hasTrait(context, TRAIT.WELLSPRING)) return;
  const wellspringProfile = requireBalanceProfileFromContext(context, TRAIT.WELLSPRING);
  const conversion = balanceProfileNumber(wellspringProfile, 'attributeConversion');
  if (staticRulesApplied) adjust('healingPower', -(context.config?.stats?.power || 0) * conversion);
  const summonBasePower = Number(context.event?.summonBasePower);
  const petPower =
    Number.isFinite(summonBasePower) && summonBasePower > 0
      ? summonBasePower +
        (context.query?.mightStacksAt(context.time, context.runtime || undefined, context.event || undefined) || 0) * 30
      : result.power || 0;
  adjust('healingPower', petPower * conversion);
}

/** Owns Core Ranger Skirmishing dodge, weapon-swap, and critical-hit trait behavior. */

type RangerCriticalHitDefinition = ResolvedCriticalHitOptions<
  RangerResolverContext,
  Gw2ResolverEvent,
  NativeResolvedDamageDetails
>;

export function applyRangerDodgeTraits(context: RangerRuntime, at = context.time): void {
  if (!hasTrait(context, TRAIT.LIGHT_ON_YOUR_FEET)) return;
  const profile = requireBalanceProfileFromContext(context, TRAIT.LIGHT_ON_YOUR_FEET);
  const effect = requireEffect(profile, 'buff', 'light-on-your-feet');
  if (!effect) return;
  const kind = String(effect.kind);
  const baseDuration = effectNumber(profile, effect, 'duration');
  // Reapplications stack duration in game, so preserve the live remainder
  // instead of replacing it with another six-second overlapping window.
  const activeUntil = context.facts
    .read()
    .filter((event) => event.type === 'buff' && event.kind === kind && event.at <= at)
    .reduce((maximum, event) => Math.max(maximum, gw2EffectExpiresAt(event.at, event.duration || 0)), at);
  context.effects.emit({
    kind: 'packet',
    event: buildRangerPacket(
      {
        at,
        source: 'Trait',
        sourceId: TRAIT.LIGHT_ON_YOUR_FEET,
        actorType: 'effect',
        skillId: TRAIT.LIGHT_ON_YOUR_FEET,
        skillName: 'Light on your Feet',
        kind,
        duration: baseDuration + Math.max(0, activeUntil - at),
        stacks: effectNumber(profile, effect, 'stacks')
      },
      'buff'
    )
  });
}

// Apply combat-only weapon-swap traits on independent ICDs and arm Quick Draw's
// one-use window for the next qualifying weapon skill.
export function applyRangerWeaponSwapTraits(context: RangerRuntime, skill: RangerSkill, at = context.time): void {
  const state = professionCoreState(context);
  const inCombat = context.combatStartTime != null && at >= context.combatStartTime;
  if (inCombat && hasTrait(context.traits, TRAIT.TAIL_WIND)) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.TAIL_WIND);
    const effect = requireEffect(profile, 'boon', 'swiftness');
    // The cooldown gates only swiftness, so a removed boon leaves it ready.
    if (effect && context.procs.claim(TRAIT.TAIL_WIND, 'ranger.core.tailWind', at)) {
      context.effects.emit({
        kind: 'packet',
        event: buildRangerPacket(
          {
            at,
            source: 'Trait',
            sourceId: TRAIT.TAIL_WIND,
            actorType: 'effect',
            skillId: skill.id,
            skillName: 'Tail Wind',
            kind: String(effect.boon),
            duration: effectNumber(profile, effect, 'duration'),
            stacks: effectNumber(profile, effect, 'stacks')
          },
          'buff'
        )
      });
    }
  }

  if (
    inCombat &&
    hasTrait(context.traits, TRAIT.QUICK_DRAW) &&
    context.procs.claim(TRAIT.QUICK_DRAW, 'ranger.core.quickDraw', at)
  ) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.QUICK_DRAW);
    const effect = requireEffect(profile, 'boon', 'quickness');
    // The recharge window is trait-owned, so it and its cooldown survive a removed quickness packet.
    state.quickDraw = grantCharges(1, at + balanceProfileNumber(profile, 'durationMultiplier'));
    if (effect)
      context.effects.emit({
        kind: 'packet',
        event: buildRangerPacket(
          {
            at,
            source: 'Trait',
            sourceId: TRAIT.QUICK_DRAW,
            actorType: 'effect',
            skillId: skill.id,
            skillName: 'Quick Draw',
            kind: String(effect.boon),
            duration: effectNumber(profile, effect, 'duration'),
            stacks: effectNumber(profile, effect, 'stacks')
          },
          'buff'
        )
      });
  }

  if (inCombat && hasTrait(context.traits, TRAIT.FURIOUS_GRIP)) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.FURIOUS_GRIP);
    const effect = requireEffect(profile, 'boon', 'fury');
    // The cooldown gates only fury, so a removed boon leaves it ready.
    if (effect && context.procs.claim(TRAIT.FURIOUS_GRIP, 'ranger.core.furiousGrip', at)) {
      context.effects.emit({
        kind: 'packet',
        event: buildRangerPacket(
          {
            at,
            source: 'Trait',
            sourceId: TRAIT.FURIOUS_GRIP,
            actorType: 'effect',
            skillId: skill.id,
            skillName: 'Furious Grip',
            kind: String(effect.boon),
            duration: effectNumber(profile, effect, 'duration'),
            stacks: effectNumber(profile, effect, 'stacks')
          },
          'buff'
        )
      });
    }
  }
}

export const rangerCoreCriticalReactions = Object.freeze({
  id: 'ranger.sharpened-edges',
  chanceOnCriticalHit: (context: RangerResolverContext) =>
    balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.SHARPENED_EDGES), 'criticalChance'),
  actorTypes: ['player', 'summon'] as const,
  when(context: RangerResolverContext, event: Gw2ResolverEvent): boolean {
    return hasTrait(context, TRAIT.SHARPENED_EDGES) && (event.actorType === 'player' || event.source === 'ranger-pet');
  },
  handler(context, event, _details, application): void {
    // Reuse this invocation's authored effect, emitting one bleeding application per threshold proc.
    const profile = requireBalanceProfileFromContext(context, TRAIT.SHARPENED_EDGES);
    const bleeding = requireEffect(profile, 'condition', 'Bleeding');
    if (!bleeding) return;
    const duration = effectNumber(profile, bleeding, 'duration');
    const stacks = effectNumber(profile, bleeding, 'stacks');
    for (let proc = 0; proc < application.quantity; proc += 1) {
      context.effects.emit({
        kind: 'packet',
        event: buildRangerBleeding(context, event, duration, TRAIT.SHARPENED_EDGES, 'Sharpened Edges', stacks)
      });
    }
  }
} satisfies RangerCriticalHitDefinition);

/** Apply Trapper's Expertise once per trap activation when its damage resolves. */
export function triggerTrappersExpertise(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = professionCoreState(context);
  const skill = skillForEvent(context.helpers, event);
  if (skill?.categories?.includes('Trap') && event.activationId && hasTrait(context, TRAIT.TRAPPERS_EXPERTISE)) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.TRAPPERS_EXPERTISE);
    const cripple = requireEffect(profile, 'condition', 'Crippled');
    if (!cripple) return;
    if (!claimActivation(state.activationClaims, 'ranger.trappers-expertise', event.activationId)) return;
    context.effects.emit({
      kind: 'packet',
      event: buildResolverCondition({
        at: event.at,
        source: 'Trait',
        sourceId: TRAIT.TRAPPERS_EXPERTISE,
        actorType: 'effect',
        skillId: TRAIT.TRAPPERS_EXPERTISE,
        skillName: "Trapper's Expertise",
        name: "Trapper's Expertise — Crippled",
        condition: String(cripple.condition),
        duration: effectNumber(profile, cripple, 'duration'),
        stacks: effectNumber(profile, cripple, 'stacks'),
        fixedDuration: true,
        triggeredBy: event.skillName
      })
    });
  }
}

/** Apply the trait-selected shortbow condition upgrades after base on-hit effects. */
export function triggerLightOnYourFeet(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const skill = skillForEvent(context.helpers, event);
  // Crossfire gains duration through the base-duration hook, never an additional bleed stack.
  if (skill?.id === ID.CONCUSSION_SHOT && hasTrait(context, TRAIT.LIGHT_ON_YOUR_FEET)) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.LIGHT_ON_YOUR_FEET);
    const vulnerability = requireEffect(profile, 'condition', 'Vulnerability');
    if (vulnerability)
      context.effects.emit({
        kind: 'packet',
        event: buildResolverCondition({
          at: event.at,
          source: 'Trait',
          sourceId: TRAIT.LIGHT_ON_YOUR_FEET,
          actorType: 'effect',
          skillId: TRAIT.LIGHT_ON_YOUR_FEET,
          skillName: 'Light on your Feet',
          name: 'Light on your Feet — Vulnerability',
          condition: String(vulnerability.condition),
          // The vulnerability upgrade is unconditional once the trait is selected.
          duration: effectNumber(profile, vulnerability, 'duration'),
          stacks: effectNumber(profile, vulnerability, 'stacks'),
          triggeredBy: event.skillName
        })
      });
  }
}

/** Reconciles the live weapon bonus against the calculated weapon baseline. */
export function stridersStrengthAttributeDelta(context: Gw2ModifierContext): number {
  if (!hasTrait(context, TRAIT.STRIDERS_STRENGTH)) return 0;
  const activeSet = Number(context.runtime?.activeWeaponSet) === 2 ? 2 : 1;
  const calculatedWeapon = context.config?.attributeProvenance?.calculatedPrimaryWeapon || '';
  const profile = requireBalanceProfileFromContext(context, TRAIT.STRIDERS_STRENGTH);
  return (
    balanceProfileNumber(
      profile,
      gw2PrimaryWeapon(context.config, activeSet) === 'Sword' ? 'weaponAttributeBonus' : 'attributeBonus'
    ) -
    (professionStaticRulesApplied(context.config)
      ? balanceProfileNumber(profile, calculatedWeapon === 'Sword' ? 'weaponAttributeBonus' : 'attributeBonus')
      : 0)
  );
}

// Apply skill-specific multipliers and convert flat shortbow extensions into
// multipliers before general Expertise scaling.
export function modifyRangerConditionBaseDuration(context: Gw2ModifierContext, multiplier: number): number {
  let result = multiplier;
  const skill = skillForEvent(context.profession?.catalog, context.event, context.skillId);
  if (skill?.categories?.includes('Trap') && hasTrait(context, TRAIT.TRAPPERS_EXPERTISE)) {
    return (
      multiplier *
      balanceProfileNumber(
        requireBalanceProfileFromContext(context, TRAIT.TRAPPERS_EXPERTISE),
        skill.id === ID.FLAME_TRAP ? 'coefficientMultiplier' : 'durationMultiplier'
      )
    );
  }

  // Intrinsic positional bonuses apply without the trait; its extensions add to those base durations.
  let extension =
    skill?.id === ID.CROSSFIRE && context.condition === 'Bleeding' && !positional(context)
      ? -1
      : skill?.id === ID.POISON_VOLLEY && context.condition === 'Poisoned' && positional(context)
        ? 2
        : 0;
  if (hasTrait(context, TRAIT.LIGHT_ON_YOUR_FEET) && positional(context)) {
    if (skill?.id === ID.CROSSFIRE && context.condition === 'Bleeding') {
      extension += balanceProfileNumber(
        requireBalanceProfileFromContext(context, TRAIT.LIGHT_ON_YOUR_FEET),
        'durationPerTier'
      );
    } else if (skill?.id === ID.POISON_VOLLEY && context.condition === 'Poisoned') {
      extension += balanceProfileNumber(
        requireBalanceProfileFromContext(context, TRAIT.LIGHT_ON_YOUR_FEET),
        'durationPerTier'
      );
    } else if (skill?.id === ID.CRIPPLING_SHOT && context.condition === 'Immobilized') {
      extension += balanceProfileNumber(
        requireBalanceProfileFromContext(context, TRAIT.LIGHT_ON_YOUR_FEET),
        'minimumStacks'
      );
    }
  }

  const baseDuration = Number(
    skill?.effects?.find((effect) => effect.type === 'condition' && effect.condition === context.condition)?.duration ||
      0
  );
  if (extension !== 0 && baseDuration > 0) result *= Math.max(0, baseDuration + extension) / baseDuration;
  return result;
}

/** Applies the trait contribution at the shared attribute reconciliation boundary. */
export function applyViciousQuarryAttributes(
  context: Gw2ModifierContext,
  adjust: (attribute: Gw2NumericStatKey, amount: number) => void,
  staticRulesApplied: boolean
): void {
  if (hasTrait(context, TRAIT.VICIOUS_QUARRY)) {
    const viciousQuarryProfile = requireBalanceProfileFromContext(context, TRAIT.VICIOUS_QUARRY);
    adjust(
      'ferocity',
      (Number(boonActive(context, 'fury')) - Number(staticRulesApplied && Boolean(context.config?.boons?.fury))) *
        balanceProfileNumber(viciousQuarryProfile, 'attributeBonus')
    );
  }
}

/** Adds the trait's independent-pet attributes before packets snapshot them. */
export function applyStridersStrengthPet(
  context: RangerRuntime | RangerResolverContext,
  attributes: {
    -readonly [K in keyof ReturnType<typeof rangerPetBaseAttributes>]: ReturnType<typeof rangerPetBaseAttributes>[K];
  }
): void {
  if (hasTrait(context, TRAIT.STRIDERS_STRENGTH)) {
    const stridersStrengthProfile = requireBalanceProfileFromContext(context, TRAIT.STRIDERS_STRENGTH);
    attributes.power += balanceProfileNumber(stridersStrengthProfile, 'attributeBonus');
  }
}

/** Adds the trait's independent-pet attributes before packets snapshot them. */
export function applyFangAndClawPet(
  context: RangerRuntime | RangerResolverContext,
  attributes: {
    -readonly [K in keyof ReturnType<typeof rangerPetBaseAttributes>]: ReturnType<typeof rangerPetBaseAttributes>[K];
  },
  petName: string
): void {
  if (
    hasTrait(context, TRAIT.FANG_AND_CLAW) &&
    ['feline', 'avian', 'drake'].includes(rangerPetByName(petName).family)
  ) {
    const fangAndClawProfile = requireBalanceProfileFromContext(context, TRAIT.FANG_AND_CLAW);
    attributes.precision += balanceProfileNumber(fangAndClawProfile, 'attributeBonus');
    attributes.ferocity += balanceProfileNumber(fangAndClawProfile, 'weaponAttributeBonus');
  }
}

/** Owns Core Ranger Wilderness Survival condition and control-triggered trait behavior. */

// On an eligible heal, consume Child of Earth's ICD and emit the initial
// immobilize followed by the profile-defined Muddy Terrain condition pulses.
export function emitChildOfEarth(context: RangerRuntime, skill: RangerSkill): void {
  if (!hasTrait(context, TRAIT.CHILD_OF_EARTH)) return;

  const profile = requireBalanceProfileFromContext(context, TRAIT.CHILD_OF_EARTH);
  const immobilized = requireEffect(profile, 'condition', 'Immobilized');
  // Pulse conditions keep their own identities, so removing one never rebinds another.
  const pulses = [requireEffect(profile, 'condition', 'Crippled'), requireEffect(profile, 'condition', 'Slow')].filter(
    (effect) => effect !== undefined
  );
  // The cooldown gates the lesser field; with every packet removed there is nothing to gate.
  if (!immobilized && !pulses.length) return;
  if (!context.procs.claim(TRAIT.CHILD_OF_EARTH, 'ranger.core.childOfEarth', context.time)) return;
  const at = context.time;
  if (immobilized)
    context.effects.emit({
      kind: 'packet',
      event: buildRangerPacket(
        {
          at,
          source: 'Trait',
          actorType: 'effect',
          skillId: TRAIT.CHILD_OF_EARTH,
          skillName: 'Child of Earth',
          name: 'Lesser Muddy Terrain - Immobilized',
          condition: String(immobilized.condition),
          duration: effectNumber(profile, immobilized, 'duration'),
          stacks: effectNumber(profile, immobilized, 'stacks'),
          triggeredBy: skill.name
        },
        'condition'
      )
    });
  const applications = balanceProfileNumber(profile, 'maximumStacks');
  const interval = balanceProfileNumber(profile, 'pulseInterval');
  for (let application = 0; application < applications; application += 1) {
    for (const effect of pulses) {
      const condition = String(effect.condition);
      context.effects.emit({
        kind: 'packet',
        event: buildRangerPacket(
          {
            at: at + application * interval,
            source: 'Trait',
            actorType: 'effect',
            skillId: TRAIT.CHILD_OF_EARTH,
            skillName: 'Child of Earth',
            name: `Lesser Muddy Terrain - ${condition}`,
            condition,
            duration: effectNumber(profile, effect, 'duration'),
            stacks: effectNumber(profile, effect, 'stacks'),
            triggeredBy: skill.name
          },
          'condition'
        )
      });
    }
  }
}

export function triggerPoisonMaster(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = professionCoreState(context);
  if (!state.poisonMasterPetAttackReady || !isPetStrike(event) || !(Number(event.coefficient) > 0)) {
    return;
  }

  const profile = requireBalanceProfileFromContext(context, TRAIT.POISON_MASTER);
  const poison = requireEffect(profile, 'condition', 'Poisoned');
  // The armed pet attack exists only to deliver poison, so a removed packet leaves it armed.
  if (!poison) return;
  state.poisonMasterPetAttackReady = false;
  context.effects.emit({
    kind: 'packet',
    event: buildResolverCondition({
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.POISON_MASTER,
      actorType: 'effect',
      ownerActorType: 'player',
      skillId: TRAIT.POISON_MASTER,
      skillName: 'Poison Master',
      name: 'Poison Master - Poisoned',
      condition: String(poison.condition),
      duration: effectNumber(profile, poison, 'duration'),
      stacks: effectNumber(profile, poison, 'stacks'),
      triggeredBy: event.skillName
    })
  });
}

export function triggerArachnophobia(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (
    !isPetStrike(event) ||
    !hasTrait(context, TRAIT.ARACHNOPHOBIA) ||
    (event.skillId !== ID.SPIT && event.skillId !== ID.TWIN_DARTS)
  ) {
    return;
  }

  const profile = requireBalanceProfileFromContext(context, TRAIT.ARACHNOPHOBIA);
  const torment = requireEffect(profile, 'condition', 'Torment');
  if (!torment) return;
  // Twin Darts splits the trait's per-attack Torment across its two projectiles;
  // single-hit spider Spit keeps the full duration.
  const duration =
    effectNumber(profile, torment, 'duration') / (event.skillId === ID.TWIN_DARTS ? Number(event.totalHits || 2) : 1);
  context.effects.emit({
    kind: 'packet',
    event: buildRangerCondition(
      context,
      event,
      String(torment.condition),
      duration,
      effectNumber(profile, torment, 'stacks'),
      TRAIT.ARACHNOPHOBIA,
      'Arachnophobia'
    )
  });
}

/** Applies the trait at the accepted Beast-skill boundary. */
export function applyPoisonMasterBeastSkill(context: RangerRuntime, skill: RangerSkill): void {
  const notBeforeCombat =
    !context.hasExplicitCombatStart || (context.combatStartTime != null && context.time >= context.combatStartTime);
  if (hasTrait(context, TRAIT.POISON_MASTER) && notBeforeCombat) {
    context.effects.emit({
      kind: 'packet',
      event: {
        type: 'ranger.beast-skill-used',
        at: context.time,
        source: 'Trait',
        sourceId: TRAIT.POISON_MASTER,
        actorType: 'effect',
        skillId: skill.id,
        skillName: skill.name
      }
    });
  }
}

/** Reconciles the live weapon bonus against the calculated weapon baseline. */
export function ambidexterityAttributeDelta(context: Gw2ModifierContext): number {
  if (!hasTrait(context, TRAIT.AMBIDEXTERITY)) return 0;
  const activeSet = Number(context.runtime?.activeWeaponSet) === 2 ? 2 : 1;
  const calculatedWeaponSet = Number(context.config?.attributeProvenance?.calculatedWeaponSet) === 2 ? 2 : 1;
  const profile = requireBalanceProfileFromContext(context, TRAIT.AMBIDEXTERITY);
  return (
    balanceProfileNumber(
      profile,
      weaponSetIncludes(context, activeSet, ['Dagger', 'Mace', 'Torch']) ? 'weaponAttributeBonus' : 'attributeBonus'
    ) -
    (professionStaticRulesApplied(context.config)
      ? balanceProfileNumber(
          profile,
          weaponSetIncludes(context, calculatedWeaponSet, ['Dagger', 'Mace', 'Torch'])
            ? 'weaponAttributeBonus'
            : 'attributeBonus'
        )
      : 0)
  );
}

/** Applies the trait contribution at the shared attribute reconciliation boundary. */
export function applyArachnophobiaAttributes(
  context: Gw2ModifierContext,
  adjust: (attribute: Gw2NumericStatKey, amount: number) => void
): void {
  if (hasTrait(context, TRAIT.ARACHNOPHOBIA))
    adjust(
      'expertise',
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.ARACHNOPHOBIA), 'attributeBonus')
    );
}

/** Adds Arachnophobia's family bonus to independent pet queries. */
export function applyArachnophobiaPetAttributes(
  context: RangerModifierContext,
  adjust: (attribute: Gw2NumericStatKey, amount: number) => void
): void {
  const family = activePetFamily(context);
  if (hasTrait(context, TRAIT.ARACHNOPHOBIA) && ['spider', 'devourer'].includes(family)) {
    const arachnophobiaProfile = requireBalanceProfileFromContext(context, TRAIT.ARACHNOPHOBIA);
    adjust('expertise', balanceProfileNumber(arachnophobiaProfile, 'weaponAttributeBonus'));
  }
}

/** Adds the trait's independent-pet attributes before packets snapshot them. */
export function applyArachnophobiaPet(
  context: RangerRuntime | RangerResolverContext,
  attributes: {
    -readonly [K in keyof ReturnType<typeof rangerPetBaseAttributes>]: ReturnType<typeof rangerPetBaseAttributes>[K];
  },
  petName: string
): void {
  if (hasTrait(context, TRAIT.ARACHNOPHOBIA)) {
    const arachnophobiaProfile = requireBalanceProfileFromContext(context, TRAIT.ARACHNOPHOBIA);
    attributes.expertise += balanceProfileNumber(arachnophobiaProfile, 'attributeBonus');
    if (['spider', 'devourer'].includes(rangerPetByName(petName).family)) {
      attributes.expertise += balanceProfileNumber(arachnophobiaProfile, 'weaponAttributeBonus');
    }
  }
}

/** Adds Natural Vigor to both baseline and Vigor-enhanced endurance recovery. */
export function naturalVigorBonus(context: RangerRuntime): number {
  return hasTrait(context.traits, TRAIT.NATURAL_VIGOR)
    ? balanceProfileNumber(
        requireBalanceProfileFromContext(context, TRAIT.NATURAL_VIGOR),
        'vigorRegenerationMultiplier'
      )
    : 0;
}

export function handleRangerBeastSkillUsed(context: RangerResolverContext, _event: Gw2ResolverEvent): void {
  if (hasTrait(context, TRAIT.POISON_MASTER)) {
    professionCoreState(context).poisonMasterPetAttackReady = true;
  }
}
