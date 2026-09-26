import { canonicalTime, EPSILON, isInternalCooldownReady } from '#kernel/core/clock.js';
import { tryConsumeProcCooldown } from '#gw2/platform/combat/procs.js';
import { consumeCharge, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { addTimedStacks, consumeNewestStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { gw2BoonApplicationRecipients } from '#gw2/platform/combat/state/allied-players.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { REVENANT_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/core/profiles.js';
import { emitRevenantProfile, revenantBoonActive } from '#gw2/professions/revenant/core/events.js';
import { activeRevenantUpkeep } from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import type { SkillEffect, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';

export const REVENANT_ASSASSINS_PRESENCE = 'revenant.assassins-presence';
const CORE_LEGENDS = new Set<string>([LEGEND.ASSASSIN, LEGEND.DEMON, LEGEND.DWARF, LEGEND.CENTAUR]);

interface TraitBuff {
  readonly sourceId: SkillId;
  readonly skillId: SkillId;
  readonly skillName: string;
  readonly name?: string;
  readonly kind: string;
  readonly duration: number;
  readonly stacks: number;
  readonly audience?: SkillEffect['audience'];
  readonly activationId?: string;
  readonly actorType?: 'player' | 'effect';
}

/** Trait boons apply at the current instant, retaining their trigger's attribution when one exists. */
function traitBuff(runtime: RevenantRuntime, fields: TraitBuff, cause?: Gw2ResolverEvent | null): void {
  const { actorType = 'player', ...rest } = fields;
  runtime.emitProcedural(
    {
      type: 'buff',
      at: runtime.time,
      source: 'revenant',
      actorType,
      ...rest
    },
    { cause }
  );
}

/** Invocation and legend packages share one profile materialization at the current instant. */
export function emitRevenantInvocationProfile(
  runtime: RevenantRuntime,
  profileId: SkillId,
  sourceId: SkillId,
  predicate: (effect: SkillEffect) => boolean = () => true
): void {
  emitRevenantProfile(runtime, requireBalanceProfileFromContext(runtime, profileId), {
    sourceId,
    activationId: `legend-invocation:${sourceId}:${runtime.time}`,
    predicate
  });
}

/** Song of the Mists materializes a declared legend proc skill with the trait as its source. */
export function emitRevenantInvocationSkill(runtime: RevenantRuntime, skillId: SkillId, sourceId: SkillId): void {
  const skill = runtime.helpers.skillsById.get(skillId);
  if (!skill) return;
  emitRevenantProfile(runtime, skill, { sourceId, activationId: `legend-invocation:${sourceId}:${runtime.time}` });
}

/** Adds expiring Battle Scars up to the shared cap and publishes only the stacks actually granted. */
function grantBattleScars(
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
  runtime.emitProcedural(
    {
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
    { cause }
  );
}

function isLegendaryStanceSkill(skill: RevenantSkill): boolean {
  if (['Heal', 'Utility', 'Elite'].includes(String(skill.slot || '')) && skill.legendId) return true;
  return skill.type === 'Profession';
}

/** Completed heals, stances, and Centaur toggles grant their selected trait rewards at completion. */
export function completeRevenantCastTraits(runtime: RevenantRuntime, cast: RuntimeCast, committed: boolean): void {
  const skill = cast.skill as RevenantSkill;
  if (skill.slot === 'Heal' && hasTrait(runtime, TRAIT.BATTLE_SCARRED)) {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.battleScarred);
    const buff = requireEffect(profile, 'buff', 'battle-scars');
    if (buff)
      grantBattleScars(runtime, {
        stacks: effectNumber(profile, buff, 'stacks'),
        sourceId: TRAIT.BATTLE_SCARRED,
        sourceName: 'Battle Scarred',
        duration: effectNumber(profile, buff, 'duration')
      });
  }

  if (runtime.combatStartedAt() && isLegendaryStanceSkill(skill) && hasTrait(runtime, TRAIT.NOTORIETY)) {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.notoriety);
    const boon = requireEffect(profile, 'boon', 'might');
    if (boon)
      traitBuff(runtime, {
        sourceId: TRAIT.NOTORIETY,
        skillId: skill.id,
        skillName: skill.name,
        name: 'Notoriety — might',
        kind: String(boon.boon),
        duration: effectNumber(profile, boon, 'duration'),
        stacks: effectNumber(profile, boon, 'stacks'),
        activationId: cast.id
      });
  }

  // Grant only the boon belonging to the committed Centaur skill; toggling off the shield grants nothing.
  if (!committed || !hasTrait(runtime, TRAIT.SERENE_REJUVENATION)) return;
  const skillId = skill.id === ID.PROTECTIVE_SOLACE_ID_29310 ? ID.PROTECTIVE_SOLACE : skill.id;
  if (skillId === ID.PROTECTIVE_SOLACE && !activeRevenantUpkeep(runtime, skill.id)) return;
  emitRevenantInvocationProfile(
    runtime,
    TRAIT.SERENE_REJUVENATION,
    TRAIT.SERENE_REJUVENATION,
    (effect) => effect.metadata?.trigger === String(skillId)
  );
}

/** Core invocation traits run after a completed in-combat legend swap reaches its destination. */
export function applyRevenantInvocationTraits(runtime: RevenantRuntime): void {
  if (!runtime.combatStartedAt()) return;
  const legendId = runtime.profession.core.activeLegendId;
  // Every in-combat invocation grants Fury; Invoker's Rage no longer has an internal cooldown.
  if (hasTrait(runtime, TRAIT.INVOKERS_RAGE))
    emitRevenantInvocationProfile(runtime, PROFILE.invokersRage, TRAIT.INVOKERS_RAGE);
  if (CORE_LEGENDS.has(legendId) && hasTrait(runtime, TRAIT.SPIRIT_BOON))
    emitRevenantInvocationProfile(
      runtime,
      PROFILE.spiritBoon,
      TRAIT.SPIRIT_BOON,
      (effect) => effect.metadata?.legendId === legendId
    );
  if (CORE_LEGENDS.has(legendId) && hasTrait(runtime, TRAIT.SONG_OF_THE_MISTS))
    emitRevenantInvocationProfile(
      runtime,
      PROFILE.songOfTheMists,
      TRAIT.SONG_OF_THE_MISTS,
      (effect) => effect.metadata?.legendId === legendId
    );
  if (hasTrait(runtime, TRAIT.INVOKING_TORMENT)) {
    const diabolicInferno = hasTrait(runtime, TRAIT.DIABOLIC_INFERNO);
    emitRevenantInvocationProfile(
      runtime,
      PROFILE.invokingTorment,
      TRAIT.INVOKING_TORMENT,
      (effect) => effect.metadata?.trigger !== 'diabolic-inferno' || diabolicInferno
    );
  }
}

/** A committed weapon swap grants Brutality's Quickness once per its internal cooldown. */
export function completeRevenantBrutality(runtime: RevenantRuntime, cast: RuntimeCast): void {
  if (!hasTrait(runtime, TRAIT.BRUTALITY)) return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.brutality);
  const boon = requireEffect(profile, 'boon', 'quickness');
  // The cooldown gates only quickness, so a removed boon leaves it ready.
  if (!boon) return;
  if (
    !tryConsumeProcCooldown(
      runtime.profession.core.traitProcReadyAt,
      'brutality',
      runtime.time,
      balanceProfileNumber(profile, 'cooldown')
    )
  )
    return;
  traitBuff(runtime, {
    sourceId: TRAIT.BRUTALITY,
    skillId: TRAIT.BRUTALITY,
    skillName: 'Brutality',
    name: 'Brutality — quickness',
    kind: String(boon.boon),
    duration: effectNumber(profile, boon, 'duration'),
    stacks: effectNumber(profile, boon, 'stacks'),
    activationId: cast.id
  });
}

/** Actual player-owned Fury on the player converts into Incensed Response's Might. */
export function reactRevenantIncensedResponse(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  if (
    event.kind !== 'fury' ||
    !runtime.combatStartedAt() ||
    !hasTrait(runtime, TRAIT.INCENSED_RESPONSE) ||
    !isGw2PlayerModifierOwnedEvent(event) ||
    !gw2BoonApplicationRecipients(runtime.config, event).includesSelf
  )
    return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.incensedResponse);
  const effect = requireEffect(profile, 'boon', 'might');
  if (!effect) return;
  traitBuff(
    runtime,
    {
      sourceId: profile.id,
      skillId: profile.id,
      skillName: profile.name,
      kind: String(effect.boon),
      duration: effectNumber(profile, effect, 'duration'),
      stacks: effectNumber(profile, effect, 'stacks')
    },
    event
  );
}

/** Accepted Chilled and Vulnerability applications drive Abyssal Chill and Dance of Death. */
export function reactRevenantConditionTraits(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  if (event.condition === 'Chilled' && hasTrait(runtime, TRAIT.ABYSSAL_CHILL)) {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.abyssalChill);
    const condition = requireEffect(profile, 'condition', 'Torment');
    if (condition) {
      const name = String(condition.condition);
      runtime.emitDerived(
        event,
        buildResolverCondition({
          at: runtime.time,
          source: 'revenant',
          sourceId: TRAIT.ABYSSAL_CHILL,
          actorType: 'player',
          skillId: TRAIT.ABYSSAL_CHILL,
          skillName: 'Abyssal Chill',
          name: `Abyssal Chill — ${name}`,
          condition: name,
          stacks: Math.max(0, effectNumber(profile, condition, 'stacks')) * Math.max(1, Number(event.stacks ?? 1)),
          duration: effectNumber(profile, condition, 'duration')
        })
      );
    }
  }

  if (event.condition === 'Vulnerability' && hasTrait(runtime, TRAIT.DANCE_OF_DEATH))
    grantBattleScars(runtime, {
      stacks: Number(event.stacks || 0),
      sourceId: TRAIT.DANCE_OF_DEATH,
      sourceName: 'Dance of Death',
      cause: event
    });
}

/** Accepted controls apply Dwarven Battle Training's Weakness. */
export function reactRevenantControlTraits(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  if (!hasTrait(runtime, TRAIT.DWARVEN_BATTLE_TRAINING)) return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.dwarvenBattleTraining);
  const condition = requireEffect(profile, 'condition', 'Weakness');
  if (!condition) return;
  const name = String(condition.condition);
  runtime.emitDerived(
    event,
    buildResolverCondition({
      at: runtime.time,
      source: 'revenant',
      sourceId: TRAIT.DWARVEN_BATTLE_TRAINING,
      actorType: 'player',
      skillId: TRAIT.DWARVEN_BATTLE_TRAINING,
      skillName: 'Dwarven Battle Training',
      name: `Dwarven Battle Training — ${name}`,
      condition: name,
      stacks: effectNumber(profile, condition, 'stacks'),
      duration: effectNumber(profile, condition, 'duration')
    })
  );
}

// Catch Thrill of Combat up to this hit, retaining only grants that can still be active under the shared cap.
function thrillOfCombat(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  if (!hasTrait(runtime, TRAIT.THRILL_OF_COMBAT)) return;
  const core = runtime.profession.core;
  const battleScars = requireBalanceProfileFromContext(runtime, PROFILE.battleScars);
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.thrillOfCombat);
  const buff = requireEffect(profile, 'buff', 'battle-scars');
  // The cadence exists only to grant this buff, so a removed buff neither grants nor advances it.
  if (!buff) return;
  const interval = Math.max(EPSILON, balanceProfileNumber(profile, 'cooldown'));
  const duration = Math.max(0, effectNumber(profile, buff, 'duration'));
  const maximum = balanceProfileNumber(battleScars, 'maximumStacks');
  if (core.nextThrillOfCombatAt == null)
    core.nextThrillOfCombatAt = Number(core.combatBeganAt ?? runtime.time) + interval;
  const next = Number(core.nextThrillOfCombatAt);
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
  traitBuff(
    runtime,
    {
      sourceId: TRAIT.THRILL_OF_COMBAT,
      skillId: TRAIT.THRILL_OF_COMBAT,
      skillName: 'Thrill of Combat',
      name: 'Thrill of Combat — Battle Scars',
      kind: 'battle-scars',
      duration,
      stacks: granted
    },
    event
  );
}

/** One active Battle Scar becomes a life siphon on a landed player strike. */
function consumeBattleScar(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.battleScars);
  const strike = requireEffect(profile, 'strike', 'Battle Scars — Life Siphon');
  // Scars are spent only to deliver the siphon, so a removed strike leaves them in place.
  if (!strike) return;
  const core = runtime.profession.core;
  const { expiries, consumed } = consumeNewestStacks(core.battleScars, 1, runtime.time);
  core.battleScars = expiries;
  if (!consumed) return;
  runtime.emitDerived(
    event,
    buildResolverStrike({
      at: runtime.time,
      source: 'revenant',
      sourceId: 'revenant.battle-scars',
      actorType: 'effect',
      skillId: 'revenant.battle-scars',
      skillName: 'Battle Scars',
      name: 'Battle Scars — Life Siphon',
      coefficient: 0,
      flatStrikeBase: effectNumber(profile, strike, 'flatStrikeBase'),
      flatStrikePowerCoeff: effectNumber(profile, strike, 'flatStrikePowerCoeff'),
      noCrit: true,
      skillWeapon: 'Unequipped'
    })
  );
}

/** Vicious Reprisal grants Might from landed strikes while Resolution is active, once per its cooldown. */
function viciousReprisal(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  if (!hasTrait(runtime, TRAIT.VICIOUS_REPRISAL) || !revenantBoonActive(runtime, 'resolution')) return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.viciousReprisal);
  const boon = requireEffect(profile, 'boon', 'might');
  // The cooldown gates only might, so a removed boon leaves it ready.
  if (!boon) return;
  if (
    !tryConsumeProcCooldown(
      runtime.profession.core.traitProcReadyAt,
      'viciousReprisal',
      runtime.time,
      balanceProfileNumber(profile, 'cooldown')
    )
  )
    return;
  traitBuff(
    runtime,
    {
      sourceId: TRAIT.VICIOUS_REPRISAL,
      skillId: TRAIT.VICIOUS_REPRISAL,
      skillName: 'Vicious Reprisal',
      name: 'Vicious Reprisal — might',
      kind: String(boon.boon),
      duration: effectNumber(profile, boon, 'duration'),
      stacks: effectNumber(profile, boon, 'stacks')
    },
    event
  );
}

/** Expose Defenses applies its opening Vulnerability on the first landed in-combat strike. */
function exposeDefenses(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  const core = runtime.profession.core;
  if (core.exposeDefensesUsed || !runtime.combatStartedAt() || !hasTrait(runtime, TRAIT.EXPOSE_DEFENSES)) return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.exposeDefenses);
  const condition = requireEffect(profile, 'condition', 'Vulnerability');
  // The one-use opener belongs to its packet, so a removed packet leaves it unspent.
  if (!condition) return;
  core.exposeDefensesUsed = true;
  const name = String(condition.condition);
  runtime.emitDerived(
    event,
    buildResolverCondition({
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
  );
}

/** A ready, unexpired Enchanted Daggers charge becomes a delayed siphon after a landed player strike. */
function enchantedDaggers(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  const daggers = runtime.profession.core.enchantedDaggers;
  if (
    event.skillId === ID.ENCHANTED_DAGGERS ||
    !(Number(daggers?.charges || 0) > 0) ||
    !isInternalCooldownReady(runtime.time, Number(daggers.readyAt || 0))
  )
    return;
  const skill = runtime.helpers.skillsById.get(ID.ENCHANTED_DAGGERS);
  if (!skill) throw new Error('Missing Enchanted Daggers skill declaration.');
  const strike = requireEffect(skill, 'strike', 'Enchanted Daggers — Siphon Damage');
  const buff = requireEffect(skill, 'buff', 'enchanted-daggers');
  // Charges exist only to deliver the siphon, so a removed strike leaves them unspent.
  if (!strike || !buff) return;
  const totalHits = effectNumber(skill, buff, 'stacks');
  const delay = Number(strike.atMs || 0) / 1000;
  if (!consumeCharge(daggers, runtime.time, delay)) return;
  // Preserve strict same-timestamp gating even when a patched strike has no delay.
  if (delay === 0) daggers.readyAt = runtime.time;
  runtime.emitDerived(
    event,
    buildResolverStrike({
      at: canonicalTime(runtime.time + delay),
      source: 'revenant',
      sourceId: ID.ENCHANTED_DAGGERS,
      actorType: 'effect',
      ownerActorType: 'player',
      skillId: ID.ENCHANTED_DAGGERS,
      skillName: 'Enchanted Daggers',
      name: 'Enchanted Daggers — Siphon Damage',
      coefficient: 0,
      flatStrikeBase: effectNumber(skill, strike, 'flatStrikeBase'),
      flatStrikePowerCoeff: effectNumber(skill, strike, 'flatStrikePowerCoeff'),
      noCrit: true,
      hitIndex: totalHits - daggers.charges,
      totalHits
    })
  );
}

/** Landed player strikes drive Core on-hit traits in their established order. */
export function reactRevenantPlayerStrike(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'player' || !(Number(event.coefficient || 0) > 0)) return;
  thrillOfCombat(runtime, event);
  consumeBattleScar(runtime, event);
  viciousReprisal(runtime, event);
  exposeDefenses(runtime, event);
  enchantedDaggers(runtime, event);
}

/** A committed Enchanted Daggers arms its finite charge window at completion. */
export function completeRevenantEnchantedDaggers(runtime: RevenantRuntime, cast: RuntimeCast): void {
  const buff = requireEffect(cast.skill, 'buff', 'enchanted-daggers');
  // Charges are the buff's stacks, so a removed buff arms nothing.
  if (!buff) return;
  const charges = Math.max(0, effectNumber(cast.skill, buff, 'stacks'));
  const duration = Math.max(0, effectNumber(cast.skill, buff, 'duration'));
  runtime.profession.core.enchantedDaggers = {
    ...grantCharges(charges, runtime.time + duration),
    readyAt: runtime.time
  };
  runtime.emitProcedural(
    {
      type: 'buff',
      at: runtime.time,
      source: 'revenant',
      sourceId: cast.skill.id,
      actorType: 'player',
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id,
      name: 'Enchanted Daggers',
      kind: 'enchanted-daggers',
      duration,
      stacks: charges
    },
    { fixedDuration: true }
  );
}

/** A committed Ancient Echo selects the active legend's self package and refunds Energy. */
export function completeRevenantAncientEcho(runtime: RevenantRuntime, cast: RuntimeCast): void {
  const legendId = runtime.profession.core.activeLegendId;
  for (const effect of cast.skill.effects ?? []) {
    if (effect.metadata?.legendId !== legendId || (effect.type !== 'boon' && effect.type !== 'buff')) continue;
    traitBuff(runtime, {
      sourceId: cast.skill.id,
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      kind: String(effect.boon || effect.kind),
      duration: Number(effect.duration),
      stacks: Number(effect.stacks ?? 1),
      activationId: cast.id
    });
  }

  runtime.resourceController.grant('energy', Number(cast.skill.resourceGain || 0));
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

export function revenantAssassinsPresencePulse(runtime: RevenantRuntime): void {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.assassinsPresence);
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
  traitBuff(runtime, {
    sourceId: TRAIT.ASSASSINS_PRESENCE,
    skillId: TRAIT.ASSASSINS_PRESENCE,
    skillName: profile.name,
    kind: String(boon.boon),
    duration: effectNumber(profile, boon, 'duration'),
    stacks: effectNumber(profile, boon, 'stacks'),
    audience: { recipients: 'party', maximumRecipients: 5 }
  });
}
