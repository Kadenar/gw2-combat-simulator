import { resetAutoattackChains } from '#gw2/platform/execution/autoattack-chains.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { armSkillFlip, consumeSkillFlip } from '#gw2/platform/execution/skill-flips.js';
import { lockTransitionInput } from '#gw2/platform/execution/transition-lockouts.js';
import { grantNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import { DEPLETION } from '#gw2/professions/necromancer/core/mechanics/resources.js';
import {
  runNecromancerLifeForceDepletion,
  runNecromancerShroudEnter,
  runNecromancerShroudExit
} from '#gw2/professions/necromancer/core/mechanics/shroud-lifecycle.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/core/profiles.js';
import { prepareShroudEntry, shroudEntryEffects } from '#gw2/professions/necromancer/core/traits/shroud-entry.js';
import { applySoulBarbs } from '#gw2/professions/necromancer/core/traits/soul-reaping/shroud.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerRuntime, NecromancerSkill } from '#gw2/professions/necromancer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Owns shroud and Lich transitions, their trait effects, and automatic exits on the live runtime. */

const LICH_EXPIRY = 'necromancer.lich-expiry';

/** Manual exit cancels the owned deadline so it cannot grant twice or end a replacement Lich Form. */
export function exitLich(runtime: NecromancerRuntime): void {
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
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'weapon_set',
      at: runtime.time,
      source: 'necromancer',
      sourceId: entering ? 'necromancer.shroud-enter' : 'necromancer.shroud-exit',
      actorType: 'player',
      weaponSet: runtime.activeWeaponSet
    }
  });
}

/** Exit mutates the same state seen by attacks and starts entry recharge only after the form ends. */
export function exitNecromancerShroud(runtime: NecromancerRuntime): void {
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
      runtime.castController.pendingCombatStart() ||
      (runtime.combatStartTime != null && runtime.time < runtime.combatStartTime)
    )
      runtime.cooldownController.clear(entry.id);
    else runtime.cooldownController.startRecharge(entry, runtime.time, 10);
  }

  transition(runtime, false);
  applySoulBarbs(runtime);
}

/** Lich entry arms one generation-owned expiry shared with manual exit. */
export function enterLich(runtime: NecromancerRuntime): void {
  const state = runtime.profession.core;
  state.activeShroud = 'lich';
  state.lichEndsAt = canonicalTime(runtime.time + 20);
  state.lichGeneration++;
  armSkillFlip(state.availableFlips, ID.EXIT_LICH_FORM, runtime.time, state.lichEndsAt);
  runtime.resourceController.refresh('lifeForce');
  runtime.schedule(LICH_EXPIRY, state.lichEndsAt, null, { id: LICH_EXPIRY, generation: state.lichGeneration }, -20);
}

/** Shroud entry preserves preparation, recharge, callbacks, resource refresh, and trait ordering. */
export function enterNecromancerShroud(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  const skill = cast.skill;
  const state = runtime.profession.core;
  prepareShroudEntry(runtime);
  state.activeShroud = skill.shroudEntry!;
  state.activeShroudEntryId = skill.id;
  state.activeShroudProfileId = skill.shroudProfileId || PROFILE.shroud;
  const exit = [...runtime.helpers.skillsById.values()].find((candidate) => candidate.shroudExit === skill.shroudEntry);
  state.activeShroudExitId = exit?.id ?? null;
  if (exit) armSkillFlip(state.availableFlips, exit.id, runtime.time);
  runtime.cooldownController.setReadyAt(skill.id, Infinity);
  runNecromancerShroudEnter(runtime, skill);
  runtime.resourceController.refresh('lifeForce');
  shroudEntryEffects(runtime, cast);
  transition(runtime, true, skill);
}

export const necromancerFormTasks = {
  [DEPLETION](runtime: NecromancerRuntime) {
    exitNecromancerShroud(runtime);
    runNecromancerLifeForceDepletion(runtime);
  },
  [LICH_EXPIRY]: exitLich
};
