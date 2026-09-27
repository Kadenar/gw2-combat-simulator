/** Owns shroud and Lich transitions, their trait effects, and automatic exits on the live runtime. */
import { canonicalTime, isTimeInWindow } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { activeStackCount } from '#gw2/platform/combat/resources/timed-stacks.js';
import { armSkillFlip, consumeSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { resetAutoattackChains } from '#gw2/platform/skills/autoattack-chain-controller.js';
import { lockTransitionInput } from '#gw2/platform/skills/transition-delays.js';
import { emitEffects } from '#gw2/platform/simulation/procedural-emission.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/core/profiles.js';
import { grantNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import { addCarapace } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { DEPLETION } from '#gw2/professions/necromancer/core/mechanics/resources.js';
import {
  runNecromancerShroudEnter,
  runNecromancerShroudExit,
  runNecromancerLifeForceDepletion
} from '#gw2/professions/necromancer/core/mechanics/shroud-lifecycle.js';
import type { NecromancerRuntime, NecromancerSkill } from '#gw2/professions/necromancer/types.js';

const LICH_EXPIRY = 'necromancer.lich-expiry';

/** Entry and exit refresh Soul Barbs from the actual transition, including automatic depletion. */
function soulBarbs(runtime: NecromancerRuntime): void {
  if (!hasTrait(runtime, TRAIT.SOUL_BARBS)) return;
  runtime.emit({
    type: 'buff',
    at: runtime.time,
    source: 'Trait',
    sourceId: TRAIT.SOUL_BARBS,
    actorType: 'player',
    kind: 'necromancer-soul-barbs',
    stacks: 1,
    duration: balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.SOUL_BARBS), 'duration')
  });
}

/** Life force reads pre-entry Carapace; entry grants and successful removals then update the same stack collection. */
function prepareShroudEntry(runtime: NecromancerRuntime): void {
  const state = runtime.profession.core;
  if (hasTrait(runtime, TRAIT.SOUL_COMPREHENSION)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.SOUL_COMPREHENSION);
    const minionStacks = hasTrait(runtime, TRAIT.FLESH_OF_THE_MASTER)
      ? Object.values(state.activeMinions).reduce((sum, count) => sum + count * 2, 0)
      : 0;
    grantNecromancerLifeForce(
      runtime,
      Math.min(
        balanceProfileNumber(profile, 'maximumStacks'),
        activeStackCount(state.carapaceExpiries, runtime.time) + minionStacks
      ) * balanceProfileNumber(profile, 'lifeForcePerStack')
    );
  }

  if (hasTrait(runtime, TRAIT.ARMORED_SHROUD)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.ARMORED_SHROUD);
    addCarapace(
      state,
      balanceProfileNumber(profile, 'resourceGain'),
      runtime.time,
      balanceProfileNumber(profile, 'duration')
    );
  }

  state.selfConditions = state.selfConditions.filter((application) =>
    isTimeInWindow(runtime.time, application.appliedAt, application.expiresAt)
  );
  if (hasTrait(runtime, TRAIT.SHROUDED_REMOVAL)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.SHROUDED_REMOVAL);
    const removed = state.selfConditions.splice(0, balanceProfileNumber(profile, 'maximumConditions'));
    if (removed.length)
      addCarapace(
        state,
        removed.length * balanceProfileNumber(profile, 'resourceGain'),
        runtime.time,
        balanceProfileNumber(profile, 'duration')
      );
  }

  state.plagueSendingArmed = hasTrait(runtime, TRAIT.PLAGUE_SENDING) && state.selfConditions.length > 0;
}

/** Entry profiles emit after the form state and specialization callbacks are established. */
function shroudEntryEffects(runtime: NecromancerRuntime, cast: RuntimeCast): void {
  soulBarbs(runtime);
  for (const trait of [
    TRAIT.AWAKEN_THE_PAIN,
    TRAIT.FURIOUS_DEMISE,
    TRAIT.SPEED_OF_SHADOWS,
    TRAIT.ETERNAL_LIFE,
    TRAIT.WEAKENING_SHROUD,
    TRAIT.SPITEFUL_SPIRIT
  ]) {
    if (!hasTrait(runtime, trait)) continue;
    const profile = requireBalanceProfileFromContext(runtime, trait);
    emitEffects(runtime, {
      owner: profile,
      baseEvent: {
        source: 'Trait',
        sourceId: trait,
        actorType: 'effect',
        skillName: profile.name,
        activationId: cast.id,
        triggeredBy: cast.skill.name
      },
      skillWeaponFallback: 'Unequipped',
      // Target misses affect hostile packets only; entry boons still reach the player.
      transform: (event) => ({
        ...event,
        name: profile.name,
        ...(event.type === 'buff' ? {} : { offTarget: cast.command.offTarget })
      })
    });
  }
}

/** Manual exit cancels the owned deadline so it cannot grant twice or end a replacement Lich Form. */
function exitLich(runtime: NecromancerRuntime): void {
  const state = runtime.profession.core;
  if (state.activeShroud !== 'lich') return;
  runtime.cancelOwner({ id: LICH_EXPIRY, generation: state.lichGeneration });
  state.activeShroud = '';
  state.lichEndsAt = 0;
  consumeSkillFlip(state.availableFlips, ID.EXIT_LICH_FORM);
  runtime.resourceController.refresh('lifeForce');
  grantNecromancerLifeForce(runtime, 15);
}

function transition(runtime: NecromancerRuntime, entering: boolean, skill?: NecromancerSkill): void {
  const kind = entering ? 'shroudEntryMs' : 'shroudExitMs';
  lockTransitionInput(runtime, kind, skill);
  runtime.emit({
    type: 'weapon_set',
    at: runtime.time,
    source: 'necromancer',
    sourceId: entering ? 'necromancer.shroud-enter' : 'necromancer.shroud-exit',
    actorType: 'player',
    weaponSet: runtime.activeWeaponSet,
    shroudSwap: true
  });
}

/** Exit mutates the same state seen by attacks and starts entry recharge only after the form ends. */
function exitNecromancerShroud(runtime: NecromancerRuntime): void {
  const state = runtime.profession.core;
  if (!state.activeShroud || state.activeShroud === 'lich') return;
  // Depletion has no cast completion; the actual form exit still invalidates its pending attack chain.
  resetAutoattackChains(runtime);
  const entry =
    state.activeShroudEntryId == null ? undefined : runtime.helpers.skillsById.get(state.activeShroudEntryId);
  if (state.activeShroudExitId != null) consumeSkillFlip(state.availableFlips, state.activeShroudExitId);
  state.activeShroud = '';
  state.activeShroudEntryId = null;
  state.activeShroudExitId = null;
  state.activeShroudProfileId = '';
  runNecromancerShroudExit(runtime);
  runtime.resourceController.refresh('lifeForce');
  runtime.cooldownController.clear(ID.ISOLATE);
  if (entry) {
    // A known marker timestamp admits hostile packets but does not move an earlier authored exit into combat.
    if (
      runtime.combatStartPending ||
      runtime.cursor.command?.type === 'combat-start' ||
      (runtime.combatStartTime != null && runtime.time < runtime.combatStartTime)
    )
      runtime.cooldownController.clear(entry.id);
    else runtime.cooldownController.startRecharge(entry, runtime.time, 10);
  }

  transition(runtime, false);
  soulBarbs(runtime);
}

/** Completed form casts coordinate state, recharge, callbacks, and entry effects in that order. */
export function completeNecromancerForm(runtime: NecromancerRuntime, cast: RuntimeCast): void {
  const skill = cast.skill as NecromancerSkill;
  const state = runtime.profession.core;
  if (skill.id === ID.LICH_FORM) {
    state.activeShroud = 'lich';
    state.lichEndsAt = canonicalTime(runtime.time + 20);
    state.lichGeneration++;
    armSkillFlip(state.availableFlips, ID.EXIT_LICH_FORM, runtime.time, state.lichEndsAt);
    runtime.resourceController.refresh('lifeForce');
    runtime.schedule(LICH_EXPIRY, state.lichEndsAt, null, { id: LICH_EXPIRY, generation: state.lichGeneration }, -20);
  } else if (skill.id === ID.EXIT_LICH_FORM) exitLich(runtime);
  else if (skill.shroudEntry) {
    prepareShroudEntry(runtime);
    state.activeShroud = skill.shroudEntry;
    state.activeShroudEntryId = skill.id;
    state.activeShroudProfileId = skill.shroudProfileId || PROFILE.shroud;
    const exit = [...runtime.helpers.skillsById.values()].find(
      (candidate) => candidate.shroudExit === skill.shroudEntry
    );
    state.activeShroudExitId = exit?.id ?? null;
    if (exit) armSkillFlip(state.availableFlips, exit.id, runtime.time);
    runtime.cooldownController.setReadyAt(skill.id, Infinity);
    runNecromancerShroudEnter(runtime, skill);
    runtime.resourceController.refresh('lifeForce');
    shroudEntryEffects(runtime, cast);
    transition(runtime, true, skill);
  } else if (skill.shroudExit) exitNecromancerShroud(runtime);
}

export const necromancerFormTasks = {
  [DEPLETION](runtime: NecromancerRuntime) {
    exitNecromancerShroud(runtime);
    runNecromancerLifeForceDepletion(runtime);
  },
  [LICH_EXPIRY]: exitLich
};
