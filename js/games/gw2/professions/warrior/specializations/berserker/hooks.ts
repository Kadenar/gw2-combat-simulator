import { canonicalTime, isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { castCompleted, gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/professions/warrior/core/profiles.js';
import { BERSERKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/berserker/profiles.js';
import { berserkerState } from '#gw2/professions/warrior/specializations/berserker/state.js';
import type { Gw2Runtime, RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { Gw2HitResolutionContext } from '#gw2/platform/resolver/hit-resolution.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

type Runtime = Gw2Runtime<WarriorRuntimeState>;
const EXPIRE = 'warrior.berserk-expiry';
const DETONATE = 'warrior.king-of-fires-detonate';
const AURA_EXPIRE = 'warrior.berserker-aura-expiry';

function isBerserkerSkill(skill: WarriorSkill): boolean {
  return Boolean(skill.primalBurst || skill.categories?.includes('Rage') || skill.specialization === 'Berserker');
}

/** Selected entry and burst boons remain independent, with current duration modifiers and explicit recipients. */
function traitBoons(runtime: Runtime, cast: RuntimeCast, trait: number, party = false): void {
  const profile = requireBalanceProfileFromContext(runtime, trait);
  for (const effect of profile.effects ?? []) {
    if (effect.type !== 'boon') continue;
    const kind = String(effect.boon);
    const duration =
      trait === TRAIT.HEAT_THE_SOUL && kind === 'quickness' && cast.skill.id === ID.DECAPITATE
        ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.smashBrawler), 'resourceGain')
        : effectNumber(profile, effect, 'duration');
    const event = {
      type: 'buff' as const,
      at: runtime.time,
      source: 'Trait',
      sourceId: trait,
      actorType: 'effect' as const,
      activationId: cast.id,
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      name: profile.name,
      kind,
      stacks: effectNumber(profile, effect, 'stacks'),
      duration,
      audience: { recipients: party ? ('party' as const) : ('self' as const) }
    };
    runtime.emitProcedural(event);
  }
}

/** The status and expiry task share one deadline; older wakes cannot close a refreshed mode. */
function publishBerserk(runtime: Runtime, cast: RuntimeCast): void {
  const state = berserkerState.from(runtime);
  runtime.emit({
    type: 'buff',
    at: runtime.time,
    source: 'Berserker',
    sourceId: ID.BERSERK,
    actorType: 'effect',
    activationId: cast.id,
    skillId: cast.skill.id,
    skillName: cast.skill.name,
    name: 'Berserk',
    kind: 'berserk',
    stacks: 1,
    duration: state.berserkUntil - runtime.time
  });
  runtime.schedule(EXPIRE, state.berserkUntil, state.berserkUntil, undefined, -220);
}

/** Completed activation opens or extends the current mode; expiring during a cast cannot revive it. */
function completeBerserk(runtime: Runtime, cast: RuntimeCast): void {
  const state = berserkerState.from(runtime);
  const skill = cast.skill;
  if (skill.id === ID.BERSERK) {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.resources);
    const effect = requireEffect(profile, 'buff', 'berserk');
    if (effect && effectNumber(profile, effect, 'duration') > 0) {
      state.berserkActive = true;
      state.berserkUntil = gw2EffectExpiresAt(runtime.time, effectNumber(profile, effect, 'duration'));
      runtime.profession.core.maximumAdrenaline = balanceProfileNumber(profile, 'maximumStacks');
      runtime.profession.core.adrenaline = Math.min(
        runtime.profession.core.adrenaline,
        runtime.profession.core.maximumAdrenaline
      );
      publishBerserk(runtime, cast);
    }

    traitBoons(runtime, cast, TRAIT.BURST_OF_AGGRESSION);
    if (hasTrait(runtime, TRAIT.BLOODY_ROAR)) traitBoons(runtime, cast, TRAIT.BLOODY_ROAR);
    return;
  }

  if (!state.berserkActive) return;
  let extension = 0;
  if (skill.primalBurst && hasTrait(runtime, TRAIT.SMASH_BRAWLER))
    extension += balanceProfileNumber(
      requireBalanceProfileFromContext(runtime, PROFILE.smashBrawler),
      skill.id === ID.DECAPITATE ? 'minimumStacks' : 'resourceGain'
    );
  if (skill.categories?.includes('Rage')) {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.rageExtensions);
    extension += balanceProfileNumber(
      profile,
      skill.id === ID.WILD_BLOW
        ? 'maximumStacks'
        : [ID.OUTRAGE, ID.SUNDERING_LEAP, ID.SHATTERING_BLOW].some((id) => id === skill.id)
          ? 'threshold'
          : 'minimumStacks'
    );
    if (skill.id !== ID.OUTRAGE && hasTrait(runtime, TRAIT.LAST_BLAZE))
      extension += balanceProfileNumber(
        requireBalanceProfileFromContext(runtime, PROFILE.lastBlaze),
        'durationMultiplier'
      );
  }

  if (extension > 0) {
    state.berserkUntil = gw2EffectExpiresAt(state.berserkUntil, extension);
    publishBerserk(runtime, cast);
  }
}

/** Aura acquisition extends one live window; expiry compares its deadline so an older wake cannot clear a refresh. */
function armAura(runtime: Runtime, until: number): void {
  const state = berserkerState.from(runtime);
  state.fireAuraUntil = Math.max(state.fireAuraUntil, until);
  if (state.fireAuraUntil > runtime.time)
    runtime.schedule(AURA_EXPIRE, state.fireAuraUntil, state.fireAuraUntil, undefined, -220);
}

/** Consume the actual aura once and emit independently selected damage components with player ownership. */
function detonate(runtime: Runtime, payload: { activationId: string; skillId: number | string }): void {
  const state = berserkerState.from(runtime);
  if (state.fireAuraUntil <= runtime.time) return;
  const skill = runtime.helpers.skillsById.get(payload.skillId);
  if (!skill) return;
  state.fireAuraUntil = 0;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.kingOfFires);
  const strike = requireEffect(profile, 'strike', 'Strike');
  const burning = requireEffect(profile, 'condition', 'Burning');
  const fields = {
    at: runtime.time,
    // The detonation and its condition packets share one trait activation, separate from the triggering cast.
    activationId: `${payload.activationId}:king-of-fires:${runtime.time}`,
    source: 'Trait',
    sourceId: TRAIT.KING_OF_FIRES,
    actorType: 'effect' as const,
    ownerActorType: 'player' as const,
    skillId: skill.id,
    skillName: skill.name
  };
  runtime.emit({
    ...fields,
    type: 'proc',
    procType: 'trait',
    name: 'King of Fires',
    sourceSkill: skill.name,
    detail: 'Fire Aura detonated'
  });
  if (strike)
    runtime.emit(
      buildResolverStrike({
        ...fields,
        name: 'King of Fires — Fire Aura Detonation',
        coefficient: effectNumber(profile, strike, 'coefficient'),
        canTriggerCriticalTraits: true,
        skillWeapon: ''
      })
    );
  if (burning) {
    const stacks = effectNumber(profile, burning, 'stacks');
    for (let index = 0; index < Math.ceil(stacks); index++)
      runtime.emit(
        buildResolverCondition({
          ...fields,
          name: 'King of Fires — Burning',
          condition: 'Burning',
          stacks: Math.min(1, stacks - index),
          duration: effectNumber(profile, burning, 'duration')
        })
      );
  }
}

/** Berserker composes with Core's resource and packet owners; only this slice owns mode and aura lifetimes. */
export const berserkerHooks: Partial<RuntimeProfession<WarriorRuntimeState>> = {
  availability(runtime, skill) {
    const state = berserkerState.from(runtime);
    if (skill.primalBurst && !state.berserkActive)
      return { ready: false, retryAt: null, code: 'warrior.berserk', reason: 'Primal bursts require berserk mode.' };
    if (skill.id === ID.BERSERK && state.berserkActive)
      return {
        ready: false,
        retryAt: state.berserkUntil,
        code: 'warrior.berserk-active',
        reason: 'Already in berserk mode.'
      };
    return { ready: true };
  },
  onCastStart(runtime, cast) {
    if (cast.skill.id === ID.BERSERK) runtime.profession.core.adrenaline -= Number(cast.skill.adrenalineCost ?? 0);
  },
  onCastComplete(runtime, cast) {
    if (!castCompleted(cast)) return;
    completeBerserk(runtime, cast);
    if (cast.skill.id === ID.BLOOD_RECKONING)
      for (const skill of runtime.helpers.skills) if (skill.primalBurst) runtime.cooldownController.clear(skill.id);
    if (cast.skill.categories?.includes('Rage') && hasTrait(runtime, TRAIT.LAST_BLAZE)) {
      const profile = requireBalanceProfileFromContext(runtime, PROFILE.lastBlaze);
      const burning = requireEffect(profile, 'condition', 'Burning');
      if (burning)
        runtime.emit(
          buildResolverCondition({
            at: runtime.time,
            activationId: cast.id,
            source: 'Trait',
            sourceId: TRAIT.LAST_BLAZE,
            actorType: 'effect',
            ownerActorType: 'player',
            skillId: cast.skill.id,
            skillName: cast.skill.name,
            name: 'Last Blaze — Burning',
            condition: 'Burning',
            stacks: effectNumber(profile, burning, 'stacks'),
            duration: effectNumber(profile, burning, 'duration')
          })
        );
    }

    if (cast.skill.primalBurst && hasTrait(runtime, TRAIT.HEAT_THE_SOUL))
      traitBoons(runtime, cast, TRAIT.HEAT_THE_SOUL, true);
    if (isBerserkerSkill(cast.skill) && hasTrait(runtime, TRAIT.KING_OF_FIRES)) {
      berserkerState.from(runtime).completedActivations[cast.id] = runtime.time;
      runtime.schedule(DETONATE, runtime.time, { activationId: cast.id, skillId: cast.skill.id }, undefined, 5);
    }
  },
  tasks: {
    [EXPIRE](runtime, deadline) {
      const state = berserkerState.from(runtime);
      if (state.berserkUntil !== deadline) return;
      state.berserkActive = false;
      state.berserkUntil = 0;
      runtime.profession.core.maximumAdrenaline = balanceProfileNumber(
        requireBalanceProfileFromContext(runtime, CORE_PROFILE.resources),
        'maximumStacks'
      );
      runtime.profession.core.adrenaline = Math.min(
        runtime.profession.core.adrenaline,
        runtime.profession.core.maximumAdrenaline
      );
    },
    [AURA_EXPIRE](runtime, deadline) {
      const state = berserkerState.from(runtime);
      if (state.fireAuraUntil === deadline) state.fireAuraUntil = 0;
    },
    [DETONATE](runtime, payload) {
      detonate(runtime, payload as { activationId: string; skillId: number | string });
    }
  },
  reactions: {
    'aura.applied'(runtime, event) {
      if (event.aura === 'Fire Aura') armAura(runtime, gw2EffectExpiresAt(runtime.time, Number(event.duration ?? 0)));
    },
    'damage.resolved'(runtime, event, details) {
      if (event.actorType !== 'player' || !(Number(event.coefficient) > 0) || !hasTrait(runtime, TRAIT.KING_OF_FIRES))
        return;
      const hit = details?.hitContext as Gw2HitResolutionContext;
      const state = berserkerState.from(runtime);
      if (
        !hit.critEligible ||
        !hit.critical.didCrit ||
        !isInternalCooldownReady(runtime.time, state.kingOfFiresReadyAt)
      )
        return;
      const profile = requireBalanceProfileFromContext(runtime, PROFILE.kingOfFires);
      state.kingOfFiresReadyAt = canonicalTime(runtime.time + balanceProfileNumber(profile, 'internalCooldown'));
      const aura = requireEffect(profile, 'buff', 'fire-aura');
      if (!aura) return;
      const duration = effectNumber(profile, aura, 'duration');
      armAura(runtime, gw2EffectExpiresAt(runtime.time, duration));
      runtime.emitDerived(event, {
        type: 'buff',
        at: runtime.time,
        source: 'Trait',
        sourceId: TRAIT.KING_OF_FIRES,
        actorType: 'effect',
        skillId: event.skillId,
        skillName: event.skillName,
        name: 'King of Fires — Fire Aura',
        kind: 'fire-aura',
        stacks: effectNumber(profile, aura, 'stacks'),
        duration
      });
      runtime.recordProc(
        'trait',
        'Fire Aura',
        runtime.time,
        event.skillName,
        'Granted by King of Fires',
        'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Fire_Aura.png'
      );
      if (event.activationId != null && state.completedActivations[event.activationId] != null)
        runtime.schedule(
          DETONATE,
          runtime.time,
          { activationId: event.activationId, skillId: event.skillId },
          undefined,
          5
        );
    }
  }
};
