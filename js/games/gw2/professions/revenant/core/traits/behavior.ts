import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { buffMatchesAudience, sumActiveStacks } from '#gw2/platform/combat/boons.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { boonActive } from '#gw2/platform/combat/query/runtime-query.js';
import { addTimedStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { isDamagingCondition } from '#gw2/platform/combat/state/targets.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { Gw2Stats } from '#gw2/platform/combat/types.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import { buildResolverCondition, isFlatLifeStealPacket } from '#gw2/platform/resolver/packets.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { revenantBoonActive } from '#gw2/professions/revenant/core/events.js';
import { activeRevenantUpkeep } from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import { REVENANT_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/core/profiles.js';
import { REVENANT_CORE_CALL_BY_LEGEND } from '#gw2/professions/revenant/core/skills/legend-call-skills.js';
import {
  REVENANT_SKILL_IDS as ID,
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { REVENANT_ELITE_INVOCATIONS } from '#gw2/professions/revenant/family-state.js';
import type { RevenantResolverContext, RevenantSkill } from '#gw2/professions/revenant/types.js';
import { canonicalTime, EPSILON } from '#kernel/core/clock.js';
import { boundedNumber } from '#kernel/core/numeric.js';

/** Runs the trait at its original ordered mechanic boundary. */
export function reactAbyssalChill(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  if (event.condition === 'Chilled' && hasTrait(runtime, TRAIT.ABYSSAL_CHILL)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.ABYSSAL_CHILL);
    const condition = requireEffect(profile, 'condition', 'Torment');
    if (condition) {
      const name = String(condition.condition);
      runtime.effects.emit({
        kind: 'packet',
        cause: event,
        event: buildResolverCondition({
          at: runtime.time,
          source: 'revenant',
          sourceId: TRAIT.ABYSSAL_CHILL,
          actorType: 'player',
          skillId: TRAIT.ABYSSAL_CHILL,
          skillName: 'Abyssal Chill',
          name: `Abyssal Chill — ${name}`,
          condition: name,
          stacks: Math.max(0, effectNumber(profile, condition, 'stacks')) * Math.max(1, event.stacks ?? 1),
          duration: effectNumber(profile, condition, 'duration')
        })
      });
    }
  }
}

export const REVENANT_ASSASSINS_PRESENCE = 'revenant.assassins-presence';

export function revenantAssassinsPresencePulse(runtime: RevenantRuntime): void {
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.ASSASSINS_PRESENCE);
  const core = runtime.profession.core;
  runtime.schedule(
    REVENANT_ASSASSINS_PRESENCE,
    canonicalTime(runtime.time + Math.max(EPSILON, balanceProfileNumber(profile, 'cooldown'))),
    null,
    { id: REVENANT_ASSASSINS_PRESENCE, generation: core.assassinsPresenceGeneration }
  );
  if (!runtime.combatStartedAt()) return;
  const boon = requireEffect(profile, 'boon', 'fury');
  // The pulse cadence is trait-owned and continues; only the removed Fury packet is skipped.
  if (!boon) return;
  runtime.effects.emit({
    kind: 'profile',
    profile: profile,
    effects: [boon],
    attribution: {
      source: 'Trait',
      actorType: 'player',
      sourceId: TRAIT.ASSASSINS_PRESENCE,
      skillId: TRAIT.ASSASSINS_PRESENCE,
      skillName: profile.name
    },
    transform: (event) => ({
      ...event,
      sourceId: TRAIT.ASSASSINS_PRESENCE,
      skillId: TRAIT.ASSASSINS_PRESENCE,
      skillName: profile.name,
      audience: { recipients: 'party', maximumRecipients: 5 }
    })
  });
}

/** Assassin's Presence pulses on its own combat-anchored cadence; attacks neither trigger nor delay it. */
export function startRevenantAssassinsPresence(runtime: RevenantRuntime, anchor: number): void {
  if (!hasTrait(runtime, TRAIT.ASSASSINS_PRESENCE)) return;
  const core = runtime.profession.core;
  runtime.cancelOwner({ id: REVENANT_ASSASSINS_PRESENCE, generation: core.assassinsPresenceGeneration });
  core.assassinsPresenceGeneration++;
  runtime.schedule(REVENANT_ASSASSINS_PRESENCE, anchor, null, {
    id: REVENANT_ASSASSINS_PRESENCE,
    generation: core.assassinsPresenceGeneration
  });
}

/** Runs the trait at its original ordered mechanic boundary. */
export function completeBattleScarred(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const skill = cast.skill;
  if (skill.slot === 'Heal' && hasTrait(runtime, TRAIT.BATTLE_SCARRED)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.BATTLE_SCARRED);
    const buff = requireEffect(profile, 'buff', 'battle-scars');
    if (buff)
      grantBattleScars(runtime, {
        stacks: effectNumber(profile, buff, 'stacks'),
        sourceId: TRAIT.BATTLE_SCARRED,
        sourceName: 'Battle Scarred',
        duration: effectNumber(profile, buff, 'duration')
      });
  }
}

/** A committed weapon swap grants Brutality's Quickness once per its internal cooldown. */
export function completeRevenantBrutality(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  if (!hasTrait(runtime, TRAIT.BRUTALITY)) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.BRUTALITY);
  const boon = requireEffect(profile, 'boon', 'quickness');
  // The cooldown gates only quickness, so a removed boon leaves it ready.
  if (!boon) return;
  if (!runtime.procs.claimCooldown('brutality', runtime.time, balanceProfileNumber(profile, 'cooldown'))) return;
  runtime.effects.emit({
    kind: 'profile',
    profile: profile,
    effects: [boon],
    attribution: {
      source: 'Trait',
      actorType: 'player',
      sourceId: TRAIT.BRUTALITY,
      skillId: TRAIT.BRUTALITY,
      skillName: 'Brutality',
      activationId: cast.id
    },
    transform: (event) => ({
      ...event,
      sourceId: TRAIT.BRUTALITY,
      skillId: TRAIT.BRUTALITY,
      skillName: 'Brutality',
      name: 'Brutality — quickness',
      activationId: cast.id
    })
  });
}

/** Samples pre-swap Energy before the legend reset is applied. */
export function chargedMistsEnergy(
  runtime: RevenantRuntime,
  cast: RuntimeCast<RevenantSkill>,
  previous: number
): number {
  const chargedMists = hasTrait(runtime, TRAIT.CHARGED_MISTS)
    ? requireBalanceProfileFromContext(runtime, TRAIT.CHARGED_MISTS)
    : undefined;
  const energy = Math.min(
    100,
    chargedMists && Math.floor(previous) <= balanceProfileNumber(chargedMists, 'threshold')
      ? balanceProfileNumber(chargedMists, 'resourceGain')
      : cast.skill.resourceGain || 0
  );
  return energy;
}

/** Runs the trait at its original ordered mechanic boundary. */
export function reactDanceOfDeath(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  if (event.condition === 'Vulnerability' && hasTrait(runtime, TRAIT.DANCE_OF_DEATH))
    grantBattleScars(runtime, {
      stacks: event.stacks || 0,
      sourceId: TRAIT.DANCE_OF_DEATH,
      sourceName: 'Dance of Death',
      cause: event
    });
}

export function activeOffhand(context: Gw2ModifierContext): boolean {
  const set = context.runtime?.activeWeaponSet || 1;
  return Boolean(gw2ConfiguredWeaponSet(context.config, set)[1]);
}

/** Keeps the additional condition payload tied to the invocation's selected trait. */
export function diabolicInfernoSelected(runtime: RevenantRuntime): boolean {
  return hasTrait(runtime, TRAIT.DIABOLIC_INFERNO);
}

/** Supplies the additive Enduring Recovery rate before the shared cap. */
export function enduringRecoveryBonus(runtime: RevenantRuntime): number {
  const enduring = hasTrait(runtime, TRAIT.ENDURING_RECOVERY)
    ? balanceProfileNumber(
        requireBalanceProfileFromContext(runtime, TRAIT.ENDURING_RECOVERY),
        'enduranceRegenerationMultiplier'
      ) - 1
    : 0;
  return enduring;
}

/** Expose Defenses applies its opening Vulnerability on the first landed in-combat strike. */
export function exposeDefenses(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  const core = runtime.profession.core;
  if (core.exposeDefensesUsed || !runtime.combatStartedAt() || !hasTrait(runtime, TRAIT.EXPOSE_DEFENSES)) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.EXPOSE_DEFENSES);
  const condition = requireEffect(profile, 'condition', 'Vulnerability');
  // The one-use opener belongs to its packet, so a removed packet leaves it unspent.
  if (!condition) return;
  core.exposeDefensesUsed = true;
  const name = String(condition.condition);
  runtime.effects.emit({
    kind: 'packet',
    cause: event,
    event: buildResolverCondition({
      at: runtime.time,
      source: 'revenant',
      sourceId: TRAIT.EXPOSE_DEFENSES,
      actorType: 'player',
      skillId: TRAIT.EXPOSE_DEFENSES,
      skillName: 'Expose Defenses',
      name: `Expose Defenses — ${name}`,
      condition: name,
      stacks: effectNumber(profile, condition, 'stacks'),
      duration: effectNumber(profile, condition, 'duration')
    })
  });
}

/** Explicit life-steal packets bypass ordinary strike modifiers; labels never decide their Core bonus. */
export function revenantLifeSiphonBonus(context: RevenantResolverContext, event: Gw2ResolverEvent): number | null {
  if (!isFlatLifeStealPacket(event)) return null;
  return hasTrait(context.traits, TRAIT.FEROCIOUS_AGGRESSION) &&
    boonActive({ config: context.config, runtime: context, time: event.at, event }, 'fury')
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.FEROCIOUS_AGGRESSION), 'damageIncrease')
    : 0;
}

/** Runs the trait at its original ordered mechanic boundary. */
export function invokeInvokersRage(runtime: RevenantRuntime): void {
  if (hasTrait(runtime, TRAIT.INVOKERS_RAGE)) {
    const invocationProfile = requireBalanceProfileFromContext(runtime, TRAIT.INVOKERS_RAGE);
    runtime.effects.emit({
      kind: 'profile',
      profile: invocationProfile,
      effects: invocationProfile.effects,
      attribution: (effect) => ({
        activationId: `legend-invocation:${TRAIT.INVOKERS_RAGE}:${runtime.time}`,
        source: 'Trait',
        sourceId: TRAIT.INVOKERS_RAGE,
        actorType: effect.actorType || 'player',
        skillId: invocationProfile.id,
        skillName: invocationProfile.name
      }),
      skillWeaponFallback: 'Unequipped'
    });
  }
}

/** Runs the trait at its original ordered mechanic boundary. */
export function invokeTorment(runtime: RevenantRuntime): void {
  if (hasTrait(runtime, TRAIT.INVOKING_TORMENT)) {
    const diabolicInferno = diabolicInfernoSelected(runtime);
    {
      const invocationProfile = requireBalanceProfileFromContext(runtime, TRAIT.INVOKING_TORMENT);
      runtime.effects.emit({
        kind: 'profile',
        profile: invocationProfile,
        effects: invocationProfile.effects?.filter(
          (effect) => effect.metadata?.trigger !== 'diabolic-inferno' || diabolicInferno
        ),
        attribution: (effect) => ({
          activationId: `legend-invocation:${TRAIT.INVOKING_TORMENT}:${runtime.time}`,
          source: 'Trait',
          sourceId: TRAIT.INVOKING_TORMENT,
          actorType: effect.actorType || 'player',
          skillId: invocationProfile.id,
          skillName: invocationProfile.name
        }),
        skillWeaponFallback: 'Unequipped'
      });
    }
  }
}

// Reconcile build-time Revenant attributes with live legend, upkeep, and trait
// state without double-applying static bonuses.
export function modifyCoreAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const modified = { ...attributes } as Record<string, number>;
  if (hasTrait(context, TRAIT.NOTORIETY)) {
    const baseMight = boundedNumber(context.config?.boons?.might || 0, 0, 0, 25);
    // Notoriety converts only the player's Might; retain explicit zero stacks and the remaining configured cap.
    const dynamicMight = sumActiveStacks(
      context.runtime?.boons?.get('might') || [],
      (application) =>
        buffMatchesAudience(application, 'all') &&
        application.at <= context.time &&
        application.expiresAt > context.time,
      (application) => application.stacks,
      25 - baseMight
    );
    const might = baseMight + dynamicMight;
    const notorietyProfile = requireBalanceProfileFromContext(context, TRAIT.NOTORIETY);
    modified.power = (modified.power || 0) + might * balanceProfileNumber(notorietyProfile, 'attributePerStack');
    modified.conditionDamage =
      (modified.conditionDamage || 0) - might * balanceProfileNumber(notorietyProfile, 'attributePerStack');
  }

  return modified;
}

/** Runs the trait at its original ordered mechanic boundary. */
export function completeNotoriety(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const skill = cast.skill;
  if (runtime.combatStartedAt() && isLegendaryStanceSkill(skill) && hasTrait(runtime, TRAIT.NOTORIETY)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.NOTORIETY);
    const boon = requireEffect(profile, 'boon', 'might');
    if (boon)
      runtime.effects.emit({
        kind: 'profile',
        profile: profile,
        effects: [boon],
        attribution: {
          source: 'Trait',
          actorType: 'player',
          sourceId: TRAIT.NOTORIETY,
          skillId: skill.id,
          skillName: skill.name,
          activationId: cast.id
        },
        transform: (event) => ({
          ...event,
          sourceId: TRAIT.NOTORIETY,
          skillId: skill.id,
          skillName: skill.name,
          name: 'Notoriety — might',
          activationId: cast.id
        })
      });
  }
}

export function isLegendaryStanceSkill(skill: RevenantSkill): boolean {
  if (['Heal', 'Utility', 'Elite'].includes(String(skill.slot || '')) && skill.legendId) return true;
  return skill.type === 'Profession';
}

/** Adds the trait duration only when static build rules have not supplied it. */
export function pactOfPainDuration(context: Gw2ModifierContext, duration: number): number {
  let modified = duration;
  if (hasTrait(context, TRAIT.PACT_OF_PAIN) && !professionStaticRulesApplied(context.config)) {
    const pactOfPainProfile = requireBalanceProfileFromContext(context, TRAIT.PACT_OF_PAIN);
    modified += balanceProfileNumber(pactOfPainProfile, 'conditionDurationBonus');
  }

  return modified;
}

export function modifyCoreCriticalChance(context: Gw2ModifierContext, chance: number): number {
  return hasTrait(context, TRAIT.ROILING_MISTS) && boonActive(context, 'fury')
    ? chance + balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.ROILING_MISTS), 'criticalChance')
    : chance;
}

/** Runs the trait at its original ordered mechanic boundary. */
export function completeSereneRejuvenation(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const skill = cast.skill;
  if (!hasTrait(runtime, TRAIT.SERENE_REJUVENATION)) return;
  const skillId = skill.id === ID.PROTECTIVE_SOLACE_ID_29310 ? ID.PROTECTIVE_SOLACE : skill.id;
  if (skillId === ID.PROTECTIVE_SOLACE && !activeRevenantUpkeep(runtime, skill.id)) return;
  {
    const invocationProfile = requireBalanceProfileFromContext(runtime, TRAIT.SERENE_REJUVENATION);
    runtime.effects.emit({
      kind: 'profile',
      profile: invocationProfile,
      effects: invocationProfile.effects?.filter((effect) => effect.metadata?.trigger === String(skillId)),
      attribution: (effect) => ({
        activationId: `legend-invocation:${TRAIT.SERENE_REJUVENATION}:${runtime.time}`,
        source: 'Trait',
        sourceId: TRAIT.SERENE_REJUVENATION,
        actorType: effect.actorType || 'player',
        skillId: invocationProfile.id,
        skillName: invocationProfile.name
      }),
      skillWeaponFallback: 'Unequipped'
    });
  }
}

/** Adds expiring Battle Scars up to the shared cap and publishes only the stacks actually granted. */
export function grantBattleScars(
  runtime: RevenantRuntime,
  {
    stacks,
    sourceId,
    sourceName,
    duration: authored,
    cause = null
  }: {
    readonly stacks: number;
    readonly sourceId: SkillId;
    readonly sourceName: string;
    readonly duration?: number;
    readonly cause?: Gw2ResolverEvent | null;
  }
): void {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.battleScars);
  let duration = authored;
  // Grants without their own duration inherit the core buff's; removing that buff leaves them nothing to grant.
  if (duration === undefined) {
    const buff = requireEffect(profile, 'buff', 'battle-scars');
    if (!buff) return;
    duration = effectNumber(profile, buff, 'duration');
  }

  duration = Math.max(0, duration);
  const core = runtime.profession.core;
  const { expiries, added } = addTimedStacks(
    core.battleScars,
    stacks,
    runtime.time,
    duration,
    balanceProfileNumber(profile, 'maximumStacks')
  );
  core.battleScars = expiries;
  if (!added) return;
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'buff',
      at: runtime.time,
      source: 'revenant',
      sourceId,
      actorType: 'player',
      skillId: sourceId,
      skillName: sourceName,
      name: `${sourceName} — Battle Scars`,
      kind: 'battle-scars',
      duration,
      stacks: added
    },
    cause
  });
}

/** Runs the trait at its original ordered mechanic boundary. */
export function invokeSongOfTheMists(runtime: RevenantRuntime): void {
  const core = runtime.profession.core;
  const legendId =
    core.activeLegendId === LEGEND.ENTITY
      ? core.selectedLegendIds.find((id) => id !== LEGEND.ENTITY)
      : core.activeLegendId;
  const elite = legendId ? REVENANT_ELITE_INVOCATIONS[legendId] : undefined;

  if (legendId && hasTrait(runtime, TRAIT.SONG_OF_THE_MISTS)) {
    // Calls share catalog mechanics while retaining the invocation trait as their triggering source.
    const song = runtime.helpers.skillsById.get(elite?.song ?? REVENANT_CORE_CALL_BY_LEGEND[legendId]);
    if (song)
      runtime.effects.emit({
        kind: 'profile',
        profile: song,
        effects: song.effects ?? [],
        attribution: (effect) => ({
          activationId: `legend-invocation:${TRAIT.SONG_OF_THE_MISTS}:${runtime.time}`,
          source: 'revenant',
          sourceId: TRAIT.SONG_OF_THE_MISTS,
          actorType: effect.actorType || 'player',
          skillId: song.id,
          skillName: song.name
        }),
        skillWeaponFallback: 'Unequipped',
        cause: null
      });
  }
}

/** Core emits the invocation packets; Kalla additionally grants two Fervor stacks for Song of the Mists. */
export function grantRenegadeInvocationFervor(
  runtime: RevenantRuntime,
  grantFervor: (runtime: RevenantRuntime, source: { sourceId: SkillId; sourceName: string }) => void
): void {
  if (runtime.profession.core.activeLegendId !== LEGEND.RENEGADE || !runtime.combatStartedAt()) return;
  const song = runtime.helpers.skillsById.get(ID.CALL_OF_THE_RENEGADE);
  if (!hasTrait(runtime, TRAIT.SONG_OF_THE_MISTS) || !song) return;
  for (let index = 0; index < 2; index += 1)
    grantFervor(runtime, { sourceId: TRAIT.SONG_OF_THE_MISTS, sourceName: song.name });
}

/** Core emits the invocation packets; Alliance additionally restores the Song skill's authored endurance. */
export function grantAllianceInvocationEndurance(runtime: RevenantRuntime): void {
  if (runtime.profession.core.activeLegendId !== LEGEND.ALLIANCE || !runtime.combatStartedAt()) return;
  const song = runtime.helpers.skillsById.get(ID.CALL_OF_THE_ALLIANCE);
  if (!hasTrait(runtime, TRAIT.SONG_OF_THE_MISTS) || !song) return;
  runtime.endurance.grant(song.resourceGain || 0);
}

/** Runs the trait at its original ordered mechanic boundary. */
export function invokeSpiritBoon(runtime: RevenantRuntime): void {
  const core = runtime.profession.core;
  const legendId =
    core.activeLegendId === LEGEND.ENTITY
      ? core.selectedLegendIds.find((id) => id !== LEGEND.ENTITY)
      : core.activeLegendId;
  const elite = legendId ? REVENANT_ELITE_INVOCATIONS[legendId] : undefined;
  const matchesLegend = (effect: SkillEffect) => elite != null || effect.metadata?.legendId === legendId;
  if (legendId && hasTrait(runtime, TRAIT.SPIRIT_BOON)) {
    const invocationProfile = requireBalanceProfileFromContext(runtime, elite?.spiritBoon ?? TRAIT.SPIRIT_BOON);
    runtime.effects.emit({
      kind: 'profile',
      profile: invocationProfile,
      effects: invocationProfile.effects?.filter(matchesLegend),
      attribution: (effect) => ({
        activationId: `legend-invocation:${TRAIT.SPIRIT_BOON}:${runtime.time}`,
        source: 'Trait',
        sourceId: TRAIT.SPIRIT_BOON,
        actorType: effect.actorType || 'player',
        skillId: invocationProfile.id,
        skillName: invocationProfile.name
      }),
      skillWeaponFallback: 'Unequipped'
    });
  }
}

// Catch Thrill of Combat up to this hit, retaining only grants that can still be active under the shared cap.
export function thrillOfCombat(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  if (!hasTrait(runtime, TRAIT.THRILL_OF_COMBAT)) return;
  const core = runtime.profession.core;
  const battleScars = requireBalanceProfileFromContext(runtime, PROFILE.battleScars);
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.THRILL_OF_COMBAT);
  const buff = requireEffect(profile, 'buff', 'battle-scars');
  // The cadence exists only to grant this buff, so a removed buff neither grants nor advances it.
  if (!buff) return;
  const interval = Math.max(EPSILON, balanceProfileNumber(profile, 'cooldown'));
  const duration = Math.max(0, effectNumber(profile, buff, 'duration'));
  const maximum = balanceProfileNumber(battleScars, 'maximumStacks');
  if (core.nextThrillOfCombatAt == null) core.nextThrillOfCombatAt = (core.combatBeganAt ?? runtime.time) + interval;
  const next = core.nextThrillOfCombatAt;
  if (!Number.isFinite(next) || next > runtime.time + EPSILON) return;
  const elapsed = Math.floor((runtime.time - next + EPSILON) / interval) + 1;
  let granted = 0;
  for (let index = Math.max(0, elapsed - Math.ceil(duration / interval)); index < elapsed; index += 1) {
    const result = addTimedStacks(core.battleScars, 1, next + index * interval, duration, maximum);
    core.battleScars = result.expiries;
    granted += result.added;
  }

  core.nextThrillOfCombatAt = next + elapsed * interval;
  if (!granted) return;
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'buff',
      at: runtime.time,
      source: 'revenant',
      actorType: 'player',
      sourceId: TRAIT.THRILL_OF_COMBAT,
      skillId: TRAIT.THRILL_OF_COMBAT,
      skillName: 'Thrill of Combat',
      name: 'Thrill of Combat — Battle Scars',
      kind: 'battle-scars',
      duration,
      stacks: granted
    },
    cause: event
  });
}

/** Vicious Reprisal grants Might from landed strikes while Resolution is active, once per its cooldown. */
export function viciousReprisal(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  if (!hasTrait(runtime, TRAIT.VICIOUS_REPRISAL) || !revenantBoonActive(runtime, 'resolution')) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.VICIOUS_REPRISAL);
  const boon = requireEffect(profile, 'boon', 'might');
  // The cooldown gates only might, so a removed boon leaves it ready.
  if (!boon) return;
  if (!runtime.procs.claimCooldown('viciousReprisal', runtime.time, balanceProfileNumber(profile, 'cooldown'))) return;
  // Keep its position among resolved-hit traits while sharing profile expansion and causal placement.
  runtime.effects.emit({
    kind: 'profile',
    profile: profile,
    effects: [{ ...boon, name: 'Vicious Reprisal — might' }],
    attribution: (effect) => ({
      source: 'revenant',
      sourceId: TRAIT.VICIOUS_REPRISAL,
      actorType: effect.actorType || 'player',
      skillId: profile.id,
      skillName: profile.name
    }),
    skillWeaponFallback: 'Unequipped',
    cause: event
  });
}

/** Adds the trait duration only when static build rules have not supplied it. */
export function yearningEmpowermentDuration(context: Gw2ModifierContext, duration: number): number {
  let modified = duration;
  if (
    isDamagingCondition(context.condition) &&
    hasTrait(context, TRAIT.YEARNING_EMPOWERMENT) &&
    !professionStaticRulesApplied(context.config)
  ) {
    const yearningEmpowermentProfile = requireBalanceProfileFromContext(context, TRAIT.YEARNING_EMPOWERMENT);
    modified += balanceProfileNumber(yearningEmpowermentProfile, 'conditionDurationBonus');
  }

  return modified;
}
