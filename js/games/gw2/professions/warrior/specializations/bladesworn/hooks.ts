import { warriorAmmunition } from '#gw2/professions/warrior/core/mechanics/ammunition.js';
import { emitEffects } from '#gw2/platform/simulation/procedural-emission.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { canonicalTime, EPSILON, isInternalCooldownReady, timeKey } from '#kernel/core/clock.js';
import { CAST_READY, denyCast, retryCast } from '#gw2/platform/engine/skills/availability.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { resetAutoattackChains } from '#gw2/platform/skills/autoattack-chain-controller.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { GW2_ACTION_TICK_MS, gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import { grantWarriorAdrenaline } from '#gw2/professions/warrior/core/mechanics/adrenaline.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import {
  resolveSharpAsTheWindSkillId,
  dragonSlashReleases,
  bladeswornSkillActions,
  bladeswornSkillTasks,
  cartridgeExplosion
} from '#gw2/professions/warrior/specializations/bladesworn/skills/index.js';
import { BLADESWORN_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/bladesworn/profiles.js';
import { bladeswornState } from '#gw2/professions/warrior/specializations/bladesworn/state.js';
import { dragonChargeTickOffsetSeconds } from '#gw2/professions/warrior/data/dragon-charges.js';
import { ENTER_DRAGON_TRIGGER_REASON } from '#gw2/professions/warrior/specializations/bladesworn/mechanics/dragon-trigger.js';
import {
  exitDragonTrigger,
  DRAGON_TRIGGER_ENTRY_RESOURCE_REASON,
  DRAGON_TRIGGER_TICK_RESOURCE_REASON,
  dragonChargesToAdrenalineSpent,
  dragonFlowPerInterval,
  maximumDragonCharges,
  requestedDragonCharges
} from '#gw2/professions/warrior/specializations/bladesworn/mechanics/dragon-trigger.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2Runtime, RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { WarriorRuntimeState } from '#gw2/professions/warrior/types.js';

type Runtime = Gw2Runtime<WarriorRuntimeState>;
const FLOW_TICK = 'warrior.flow-tick';
const CHARGE_TICK = 'warrior.dragon-charge';
const TRIGGER_EXPIRY = 'warrior.dragon-trigger-expiry';
/** Flow uses the absolute action grid; a grant at a tick cannot receive regeneration for that same tick. */
function scheduleFlowTick(runtime: Runtime): void {
  const tick = Math.floor(timeKey(runtime.time) / (GW2_ACTION_TICK_MS * 1000)) + 1;
  runtime.schedule(FLOW_TICK, (tick * GW2_ACTION_TICK_MS) / 1000, null, undefined, -250);
}

/** Credit the interval ending now before closing its windows; no future rate or event-history projection is needed. */
function flowTick(runtime: Runtime): void {
  const state = bladeswornState.from(runtime);
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.resources);
  const active = (start: number, end: number) => start < runtime.time && runtime.time <= end;
  const stabilizers = state.flowStabilizerWindows.filter((window) => active(window.startedAt, window.expiresAt));
  const rate =
    (runtime.combatActive ? balanceProfileNumber(profile, 'energyRegenerationPerSecond') : 0) +
    stabilizers.length * balanceProfileNumber(profile, 'resourceGain') +
    (active(state.traitPositiveFlowStartedAt, state.traitPositiveFlowUntil)
      ? state.traitPositiveFlowStacks * balanceProfileNumber(profile, 'attributePerStack')
      : 0);
  grantWarriorAdrenaline(runtime, rate * (GW2_ACTION_TICK_MS / 1000));
  state.flowStabilizerWindows = state.flowStabilizerWindows.filter((window) => window.expiresAt > runtime.time);
  if (state.traitPositiveFlowUntil <= runtime.time) {
    state.traitPositiveFlowStartedAt = 0;
    state.traitPositiveFlowUntil = 0;
    state.traitPositiveFlowStacks = 0;
  }

  scheduleFlowTick(runtime);
}

/** The selected entry trait claims one actual cooldown; its damage/boon and Positive Flow components are independent. */
function gunsaberEntryTraits(runtime: Runtime, cast: RuntimeCast): void {
  if (runtime.hasExplicitCombatStart && !runtime.combatActive) return;
  const state = bladeswornState.from(runtime);
  if (!isInternalCooldownReady(runtime.time, runtime.procs.deadline('warrior.bladesworn.gunsaberSwapTrait'))) return;
  const trait = [TRAIT.UNSEEN_SWORD, TRAIT.SHARP_AS_THE_WIND, TRAIT.RIVERS_FLOW].find((id) => hasTrait(runtime, id));
  if (trait == null || (trait === TRAIT.UNSEEN_SWORD && !runtime.combatActive)) return;
  const profile = requireBalanceProfileFromContext(runtime, trait);
  const event = {
    at: runtime.time,
    source: 'Trait',
    sourceId: trait,
    actorType: 'effect' as const,
    activationId: cast.id,
    skillId: ID.UNSHEATHE_GUNSABER,
    skillName: 'Unsheathe Gunsaber'
  };
  if (trait === TRAIT.UNSEEN_SWORD) {
    const strike = requireEffect(profile, 'strike', 'Strike');
    if (strike)
      runtime.emit(
        buildResolverStrike({
          ...event,
          actorType: 'player',
          skillId: 62847,
          skillName: 'Unseen Sword',
          parentSkillName: cast.skill.name,
          weaponStrengthProfileId: 'nonweapon.unequipped',
          coefficient: effectNumber(profile, strike, 'coefficient')
        })
      );
    runtime.emit({ ...event, type: 'proc', name: 'Unseen Sword', procType: 'trait', sourceSkill: cast.skill.name });
  } else if (trait === TRAIT.SHARP_AS_THE_WIND) {
    const burning = requireEffect(profile, 'condition', 'Burning');
    if (burning)
      runtime.emit(
        buildResolverCondition({
          ...event,
          ownerActorType: 'player',
          name: 'Sharp as the Wind — Burning',
          condition: 'Burning',
          stacks: effectNumber(profile, burning, 'stacks'),
          duration: effectNumber(profile, burning, 'duration')
        })
      );
  } else {
    const might = requireEffect(profile, 'boon', 'might');
    if (might)
      runtime.emitProcedural({
        ...event,
        type: 'buff',
        name: "River's Flow — Might",
        kind: 'might',
        stacks: effectNumber(profile, might, 'stacks'),
        duration: effectNumber(profile, might, 'duration'),
        audience: { recipients: 'party' }
      });
  }

  runtime.procs.readyAt['warrior.bladesworn.gunsaberSwapTrait'] = canonicalTime(
    runtime.time + balanceProfileNumber(profile, 'internalCooldown')
  );
  const flow = requireEffect(profile, 'buff', 'positive-flow');
  if (!flow) return;
  if (state.traitPositiveFlowUntil <= runtime.time) state.traitPositiveFlowStartedAt = runtime.time;
  const duration = effectNumber(profile, flow, 'duration');
  state.traitPositiveFlowUntil = gw2EffectExpiresAt(runtime.time, duration);
  state.traitPositiveFlowStacks = effectNumber(profile, flow, 'stacks');
  runtime.emit({
    ...event,
    type: 'buff',
    name: 'Positive Flow',
    kind: 'positive-flow',
    stacks: state.traitPositiveFlowStacks,
    duration
  });
}

/** Both sides share the already committed recharge and notify equipment without changing the configured weapon set. */
function swapGunsaber(runtime: Runtime, cast: RuntimeCast, active: boolean): void {
  bladeswornState.from(runtime).gunsaberActive = active;
  resetAutoattackChains(runtime);
  if (hasTrait(runtime, TRAIT.MARTIAL_CADENCE)) runtime.procs.readyAt['warrior.core.soldierFocus'] = runtime.time;
  const swapId = cast.skill.id === ID.DRAGON_TRIGGER ? ID.UNSHEATHE_GUNSABER : cast.skill.id;
  if (cast.skill.id === ID.DRAGON_TRIGGER)
    runtime.cooldownController.startRecharge(runtime.helpers.skillsById.get(ID.UNSHEATHE_GUNSABER)!, runtime.time);
  runtime.cooldownController.copy(swapId, ID.UNSHEATHE_GUNSABER);
  runtime.cooldownController.copy(swapId, ID.SHEATHE_GUNSABER);
  runtime.emit({
    type: 'sigil_swap',
    at: runtime.time,
    source: 'warrior',
    sourceId: cast.skill.id,
    actorType: 'player',
    activationId: cast.id,
    skillId: cast.skill.id,
    skillName: cast.skill.name,
    weaponSet: runtime.activeWeaponSet
  });
  if (active) gunsaberEntryTraits(runtime, cast);
}

/** Selected completion/entry buffs keep their own components and current duration modifiers. */
function triggerTraitBuffs(runtime: Runtime, cast: RuntimeCast, trait: number, stacks?: number): void {
  if (!hasTrait(runtime, trait)) return;
  const profile = requireBalanceProfileFromContext(runtime, trait);
  emitEffects(runtime, {
    owner: profile,
    effects: profile.effects?.filter((effect) => effect.type === 'boon' || effect.type === 'buff'),
    baseEvent: {
      source: 'Trait',
      sourceId: trait,
      actorType: 'effect',
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id
    },
    transform: (event) => ({
      ...event,
      name: profile.name,
      stacks: stacks ?? event.stacks,
      priority: trait === TRAIT.BURST_MASTERY || trait === TRAIT.BERSERKERS_POWER ? 5 : 0
    })
  });
}

function scheduleCharge(runtime: Runtime): void {
  const state = bladeswornState.from(runtime);
  state.nextDragonChargeAt = canonicalTime(
    state.dragonTriggerStartedAt + dragonChargeTickOffsetSeconds(state.dragonChargeTickCount + 1)
  );
  if (
    state.nextDragonChargeAt <= state.dragonTriggerChargeDeadline &&
    state.dragonCharges < maximumDragonCharges(runtime)
  )
    runtime.schedule(CHARGE_TICK, state.nextDragonChargeAt, state.dragonTriggerEventActivationId, undefined, -200);
}

/** Entry spends once; the first interval is prepaid, and every subsequent interval checks then spends current Flow. */
function enterDragonTrigger(runtime: Runtime, cast: RuntimeCast): void {
  const state = bladeswornState.from(runtime);
  if (!state.gunsaberActive) swapGunsaber(runtime, cast, true);
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.dragonTrigger);
  const cost = balanceProfileNumber(profile, 'threshold');
  state.flow = Math.max(0, state.flow - cost);
  state.dragonTriggerActive = true;
  state.dragonTriggerStartedAt = runtime.time;
  state.dragonTriggerChargeDeadline = canonicalTime(runtime.time + balanceProfileNumber(profile, 'cooldown'));
  state.dragonCharges = 0;
  state.dragonChargesPerInterval = state.tacticalReloadUntil > 0 && runtime.time < state.tacticalReloadUntil ? 2 : 1;
  if (state.dragonChargesPerInterval > 1) state.tacticalReloadUntil = 0;
  state.dragonChargeTickCount = 0;
  state.dragonTriggerFlowSpent = 0;
  state.dragonTriggerEventActivationId = cast.id;
  scheduleCharge(runtime);
  // The deadline admits both its last charge and a command at that instant; close at the next canonical microsecond.
  runtime.schedule(
    TRIGGER_EXPIRY,
    (timeKey(state.dragonTriggerChargeDeadline) + 1) / 1_000_000,
    cast.id,
    undefined,
    -220
  );
  runtime.emit({
    type: 'resource',
    at: runtime.time,
    source: 'Warrior',
    sourceId: ID.DRAGON_TRIGGER,
    actorType: 'player',
    skillId: ID.DRAGON_TRIGGER,
    skillName: 'Dragon Trigger',
    activationId: cast.id,
    resource: 'flow',
    reason: DRAGON_TRIGGER_ENTRY_RESOURCE_REASON,
    amount: -cost,
    value: state.flow,
    maximumFlow: state.maximumFlow,
    maximumCharges: maximumDragonCharges(runtime),
    chargesPerInterval: state.dragonChargesPerInterval,
    nextChargeAt: state.nextDragonChargeAt,
    deadline: state.dragonTriggerChargeDeadline
  });
}

function chargeTick(runtime: Runtime, identity: unknown): void {
  const state = bladeswornState.from(runtime);
  if (!state.dragonTriggerActive || state.dragonTriggerEventActivationId !== identity) return;
  const cost = state.dragonChargeTickCount === 0 ? 0 : dragonFlowPerInterval(runtime);
  const granted = state.flow + EPSILON >= cost;
  const before = state.dragonCharges;
  if (granted) {
    state.flow = Math.max(0, state.flow - cost);
    state.dragonTriggerFlowSpent += cost;
    state.dragonCharges = Math.min(maximumDragonCharges(runtime), state.dragonCharges + state.dragonChargesPerInterval);
  }

  state.dragonChargeTickCount++;
  runtime.emit({
    type: 'resource',
    at: runtime.time,
    source: 'Warrior',
    sourceId: ID.DRAGON_TRIGGER,
    actorType: 'player',
    skillId: ID.DRAGON_TRIGGER,
    skillName: 'Dragon Trigger',
    activationId: state.dragonTriggerEventActivationId,
    resource: 'dragon charges',
    reason: DRAGON_TRIGGER_TICK_RESOURCE_REASON,
    amount: state.dragonCharges - before,
    value: state.dragonCharges,
    flowAfter: state.flow,
    flowSpent: granted ? cost : 0,
    deadline: state.dragonTriggerChargeDeadline
  });
  scheduleCharge(runtime);
}

/** Lush Forest reduces each tracked action on the current bar once, retaining the documented normal Artillery exclusion. */
function ammoTraits(runtime: Runtime, cast: RuntimeCast): void {
  const spent = warriorAmmunition.get(cast);
  if (!spent) return;
  triggerTraitBuffs(runtime, cast, TRAIT.FIERCE_AS_FIRE, spent.rounds);
  if (!spent.startedFull || cast.skill.id === ID.ARTILLERY_SLASH || !hasTrait(runtime, TRAIT.LUSH_FOREST)) return;
  const state = bladeswornState.from(runtime);
  const weapons = new Set(
    gw2ConfiguredWeaponSet(runtime.config, runtime.activeWeaponSet === 2 ? 2 : 1).filter(Boolean)
  );
  const selected = selectedSkillNameSet(runtime.config.selectedSkills);
  const onBar = (skill: Skill) => {
    if (
      [ID.UNSHEATHE_GUNSABER, ID.SHEATHE_GUNSABER, ID.DRAGON_TRIGGER, ID.ARTILLERY_SLASH].some((id) => id === skill.id)
    )
      return false;
    if (skill.gunsaberSkill) return state.gunsaberActive || state.dragonTriggerActive;
    if (skill.type === 'Weapon' || skill.weapon)
      return !state.gunsaberActive && !state.dragonTriggerActive && (!weapons.size || weapons.has(skill.weapon ?? ''));
    return !['Heal', 'Utility', 'Elite'].includes(String(skill.type)) || !selected.size || selected.has(skill.name);
  };

  const reduction = balanceProfileNumber(
    requireBalanceProfileFromContext(runtime, PROFILE.lushForest),
    'rechargeReduction'
  );
  let reduced = 0;
  for (const id of new Set([...runtime.cooldowns.keys(), ...runtime.ammo.keys()])) {
    const skill = runtime.helpers.skillsById.get(id);
    if (skill && onBar(skill))
      reduced += runtime.cooldownController.reduceSkillRecharge(skill, reduction, runtime.time);
  }

  runtime.emit({
    type: 'proc',
    at: runtime.time,
    source: 'Trait',
    sourceId: TRAIT.LUSH_FOREST,
    actorType: 'effect',
    skillId: cast.skill.id,
    skillName: cast.skill.name,
    activationId: cast.id,
    name: 'Lush Forest',
    procType: 'trait',
    cooldownReduction: reduced
  });
}

/** Only actual player explosions extend Glory or create cartridge Burning; neither derived condition can recurse. */
function explosion(runtime: Runtime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'player' || event.damageKind !== 'explosion' || !(Number(event.coefficient) > 0)) return;
  const state = bladeswornState.from(runtime);
  if (hasTrait(runtime, TRAIT.GUNS_AND_GLORY)) {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.gunsAndGlory);
    const duration = Math.min(
      balanceProfileNumber(profile, 'maximumStacks'),
      Math.max(0, state.gunsAndGloryUntil - runtime.time) + balanceProfileNumber(profile, 'resourceGain')
    );
    if (duration > 0) {
      state.gunsAndGloryUntil = gw2EffectExpiresAt(runtime.time, duration);
      runtime.emitDerived(event, {
        type: 'buff',
        at: runtime.time,
        source: 'Trait',
        sourceId: TRAIT.GUNS_AND_GLORY,
        actorType: 'effect',
        skillId: event.skillId,
        skillName: event.skillName,
        name: 'Guns and Glory',
        kind: 'guns-and-glory',
        stacks: 1,
        duration
      });
    }
  }

  cartridgeExplosion(runtime, event);
}

/** Native declarations own actual resources, bar transitions, completed ammunition rewards, and accepted explosions. */
export const bladeswornHooks: Partial<RuntimeProfession<WarriorRuntimeState>> = {
  sideEffectHandlers: {
    ...bladeswornSkillActions,
    // Bar declarations invoke the shared transition, including recharge and entry trait observers.
    'warrior.gunsaber-enter'(runtime, context) {
      if (context.kind === 'cast') swapGunsaber(runtime, context.cast, true);
    },
    'warrior.gunsaber-exit'(runtime, context) {
      if (context.kind === 'cast') {
        exitDragonTrigger(runtime);
        swapGunsaber(runtime, context.cast, false);
      }
    },
    'warrior.dragon-trigger-enter'(runtime, context) {
      if (context.kind === 'cast') enterDragonTrigger(runtime, context.cast);
    }
  },
  // Entry rewards use the committed skill; slash rewards require the release captured at cast start.
  traitTriggers: [
    {
      trait: TRAIT.DRAGONSCALE_DEFENSE,
      emit: TRAIT.DRAGONSCALE_DEFENSE,
      on: 'castCommit',
      when: (_runtime, cast) => cast.skill.id === ID.DRAGON_TRIGGER,
      effects: (effect) => effect.type === 'boon' || effect.type === 'buff',
      attribution: { priority: 0 }
    },
    {
      trait: TRAIT.DARING_DRAGON,
      emit: TRAIT.DARING_DRAGON,
      on: 'castCommit',
      when: (_runtime, cast) => dragonSlashReleases.has(cast),
      effects: (effect) => effect.type === 'boon' || effect.type === 'buff',
      attribution: { priority: 0, audience: { recipients: 'party' } }
    }
  ],
  modifySkillId: resolveSharpAsTheWindSkillId,
  reserveRecharge: (_runtime, skill, work) => (skill.id === ID.DRAGON_TRIGGER ? 0 : work),
  // Like weapon swaps, Gunsaber transitions recharge instantly until combat begins.
  rechargeWork: (runtime, skill, work) =>
    (skill.id === ID.UNSHEATHE_GUNSABER || skill.id === ID.SHEATHE_GUNSABER) && !runtime.combatActive ? 0 : work,
  // Only the trait adds control; the selected release owns all intrinsic packets.
  modifyEffects(runtime, cast, effects) {
    if (!cast.skill.dragonSlash || !hasTrait(runtime, TRAIT.UNYIELDING_DRAGON)) return effects;
    const strike = effects.find((effect) => effect.type === 'strike');
    return [
      ...effects,
      {
        type: 'control',
        source: 'Trait',
        sourceId: TRAIT.UNYIELDING_DRAGON,
        controlKind: 'stun',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        atMs: strike?.atMs
      }
    ];
  },
  availability(runtime, skill, command) {
    const state = bladeswornState.from(runtime);
    if (skill.burst && !skill.dragonSlash)
      return denyCast('warrior.flow', 'Bladesworn replaces weapon bursts with Dragon Slash.');
    if (skill.id === SHARED_SKILL_IDS.SWAP_WEAPONS)
      return denyCast('warrior.gunsaber', 'Bladesworn cannot swap normal weapon sets in combat.');
    if (skill.id === ID.UNSHEATHE_GUNSABER && state.gunsaberActive)
      return denyCast('warrior.gunsaber', 'Gunsaber is already active.');
    if (skill.id === ID.SHEATHE_GUNSABER && !state.gunsaberActive)
      return denyCast('warrior.gunsaber', 'Gunsaber is not active.');
    if ((state.gunsaberActive || state.dragonTriggerActive) && skill.type === 'Weapon' && skill.weapon)
      return denyCast('warrior.gunsaber', 'Sheathe the gunsaber before using standard weapon skills.');
    if ((skill.dragonSlash || skill.dragonTriggerSkill) && !state.dragonTriggerActive)
      return denyCast('warrior.dragon-trigger', ENTER_DRAGON_TRIGGER_REASON);
    if (skill.id === ID.DRAGON_TRIGGER) {
      if (state.dragonTriggerActive) return denyCast('warrior.dragon-trigger', 'Dragon Trigger is already active.');
      const cost = balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.dragonTrigger), 'threshold');
      if (state.flow + EPSILON < cost)
        return denyCast('warrior.flow', `Dragon Trigger requires at least ${cost} flow.`);
    }

    if (skill.dragonSlash) {
      const requested = requestedDragonCharges({ command }, maximumDragonCharges(runtime));
      if (state.dragonCharges < requested) {
        if (state.nextDragonChargeAt > state.dragonTriggerChargeDeadline)
          return denyCast(
            'warrior.flow',
            `Dragon Slash could not reach ${requested} charges before Dragon Trigger ended; it reached ${state.dragonCharges}.`
          );
        return retryCast(
          state.nextDragonChargeAt,
          'warrior.dragon-trigger-charging',
          `Dragon Trigger is charging to ${requested} charges.`
        );
      }
    }

    if (skill.gunsaberSkill && !skill.dragonSlash && !skill.dragonTriggerSkill) {
      if (state.dragonTriggerActive)
        return denyCast('warrior.dragon-trigger', 'Finish Dragon Trigger before using gunsaber attacks.');
      if (!state.gunsaberActive) return denyCast('warrior.gunsaber', 'Unsheathe the gunsaber first.');
    }

    return CAST_READY;
  },
  initialize(runtime) {
    const state = bladeswornState.from(runtime);
    state.maximumFlow = balanceProfileNumber(
      requireBalanceProfileFromContext(runtime, PROFILE.resources),
      'maximumStacks'
    );
    state.flow = Math.min(state.flow, state.maximumFlow);
    runtime.profession.core.adrenaline = 0;
    runtime.profession.core.maximumAdrenaline = 0;
    scheduleFlowTick(runtime);
  },
  onCastStart(runtime, cast) {
    if (cast.ammo) {
      const ammo = runtime.ammo.get(cast.skill.id)!;
      warriorAmmunition.set(cast, { rounds: 1, startedFull: ammo.charges >= ammo.maximum });
    }

    if (!cast.skill.dragonSlash && cast.fullEnd > cast.start) exitDragonTrigger(runtime);
  },
  onCastCommit(runtime, cast) {
    // Successful ammunition commitment earns its reward even when the remaining animation is interrupted.
    ammoTraits(runtime, cast);
    grantWarriorAdrenaline(runtime, Number(cast.skill.flowGain ?? 0));
    const release = dragonSlashReleases.get(cast);
    if (release) {
      if (hasTrait(runtime, TRAIT.BURST_MASTERY)) {
        grantWarriorAdrenaline(
          runtime,
          release.flowSpent *
            balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.burstMastery), 'resourceGain')
        );
        triggerTraitBuffs(runtime, cast, TRAIT.BURST_MASTERY);
      }

      triggerTraitBuffs(
        runtime,
        cast,
        TRAIT.BERSERKERS_POWER,
        dragonChargesToAdrenalineSpent(release.charges) / 10 + 1
      );
    }

    if (cast.skill.gunsaberSkill && !runtime.helpers.autoattackChainPositions.has(Number(cast.skill.id)))
      resetAutoattackChains(runtime);
  },
  tasks: {
    ...bladeswornSkillTasks,
    [FLOW_TICK]: flowTick,
    [CHARGE_TICK]: chargeTick,
    [TRIGGER_EXPIRY](runtime, identity) {
      const state = bladeswornState.from(runtime);
      if (state.dragonTriggerActive && state.dragonTriggerEventActivationId === identity)
        exitDragonTrigger(runtime, state.dragonTriggerChargeDeadline);
    }
  },
  reactions: { 'damage.resolved': explosion }
};
