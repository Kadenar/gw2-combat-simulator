import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import { applySideEffect } from '#gw2/platform/effects/action-dispatch.js';
import { type ActionContext } from '#gw2/platform/effects/actions.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { buildMesmerPacket, mesmerPacketOwner } from '#gw2/professions/mesmer/core/mechanics/packets.js';
import { MESMER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/mesmer/core/profiles.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { mesmerShatterDefinition } from '#gw2/professions/mesmer/family-mechanics.js';
import { createMesmerIllusionRewards, mesmerActivePrimaryWeapon } from '#gw2/professions/mesmer/family-resources.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

const SIGNET_ILLUSIONS_OWNER = 'mesmer.signet-illusions-passive';

/** Applies active signet resets to the cooldown and ammo state shared by later casts. */
export function applyMesmerSignetReset(state: MesmerRuntime, context: ActionContext<MesmerSkill>): void {
  const phantasms = context.skill.id === ID.SIGNET_OF_THE_ETHER;
  const targets = state.helpers.skills.filter((candidate) => {
    const shatter = mesmerShatterDefinition(state, candidate.id);
    return phantasms
      ? candidate.phantasm
      : (state.profession.specialization.kind === 'Troubadour' && Boolean(candidate.instrument)) ||
          (shatter && shatter.resetBySignetOfIllusions !== false);
  });
  // Catalog selection stays local; the shared actions own recharge and existing ammo restoration.
  if (!phantasms)
    applySideEffect(state, context, {
      type: 'ammoRestore',
      skillIds: targets.filter((target) => state.cooldownController.hasAmmo(target.id)).map((target) => target.id),
      count: 1
    });
  applySideEffect(state, context, { type: 'rechargeReset', skillIds: targets.map((target) => target.id) });
  {
    const packet = buildMesmerPacket({
      type: 'marker',
      at: state.time,
      name: context.skill.name,
      detail: phantasms ? 'Phantasm skill cooldowns reset' : 'Eligible shatter and instrument cooldowns reset'
    });
    state.effects.emit({
      kind: 'packet',
      event: packet,
      owner: mesmerPacketOwner(packet),
      priority: Number(packet.priority ?? 0)
    });
  }
}

/**
 * Resolves Signet of Illusions when it is present in the configured utility
 * loadout.
 *
 * Catalog skill when equipped, otherwise null.
 */
function equippedSignetOfIllusions(context: MesmerRuntime): MesmerSkill | null {
  const skill = context.helpers.skillsById.get(ID.SIGNET_OF_ILLUSIONS);
  if (!skill) return null;
  const equipped = selectedSkillIdSet(context.config.selectedSkillIds).has(skill.id);
  return equipped ? skill : null;
}

/** Replace the passive deadline when a cast or explicit combat boundary restarts its interval. */
export function restartSignetIllusionsPassive(context: MesmerRuntime, activeAt: number): void {
  const skill = equippedSignetOfIllusions(context);
  if (!skill) return;
  const interval = balanceProfileNumber(
    requireBalanceProfileFromContext(context, PROFILE.signetOfIllusions),
    'pulseInterval'
  );
  if (!(interval > 0)) return;
  const at = Math.max(context.time, Math.max(activeAt, context.cooldownController.readyAt(skill.id) ?? 0) + interval);
  context.profession.core.signetIllusionsAt = at;
  context.schedule(SIGNET_ILLUSIONS_OWNER, at, at, undefined, -20);
}

/** A due pulse reads current cooldown and resources; it never grants a predicted future clone. */
export function signetIllusionsPulse(context: MesmerRuntime, data: unknown): void {
  if (context.profession.core.signetIllusionsAt !== data) return;
  const skill = equippedSignetOfIllusions(context);
  if (!skill || context.combatStartPending) return;
  const ready = context.cooldownController.readyAt(skill.id) ?? 0;
  if (ready > context.time) {
    restartSignetIllusionsPassive(context, ready);
    return;
  }

  createMesmerIllusionRewards(context).gainResources(
    context.time,
    balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.signetOfIllusions), 'resourceGain'),
    mesmerActivePrimaryWeapon(context),
    skill.name,
    { sourceSkillId: skill.id }
  );
  restartSignetIllusionsPassive(context, context.time);
}
