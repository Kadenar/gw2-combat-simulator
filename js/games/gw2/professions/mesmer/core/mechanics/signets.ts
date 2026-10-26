import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import { definePeriodicTask } from '#gw2/platform/simulation/periodic-task.js';
import { applySideEffect } from '#gw2/platform/effects/action-dispatch.js';
import { type ActionContext } from '#gw2/platform/effects/actions.js';
import { skillNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { buildMesmerPacket, mesmerPacketOwner } from '#gw2/professions/mesmer/core/mechanics/packets.js';
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

/** A full interval follows the later activation/combat anchor or current signet recharge. */
function nextSignetIllusionsPulse(context: MesmerRuntime, activeAt: number): number {
  const skill = equippedSignetOfIllusions(context);

  if (!skill) return Infinity;

  const interval = skillNumberFromContext(context, ID.SIGNET_OF_ILLUSIONS, 'pulseInterval');

  if (!(interval > 0)) return Infinity;

  return Math.max(context.time, Math.max(activeAt, context.cooldownController.readyAt(skill.id) ?? 0) + interval);
}

/** Only a live ready pulse creates resources; explicit precombat pauses the loop until its combat restart. */
export const signetIllusionsPassive = definePeriodicTask<MesmerRuntime>({
  name: SIGNET_ILLUSIONS_OWNER,
  background: true,
  priority: -20,
  state: (context) => context.profession.core.signetIllusionsPassive,
  nextAt: (context) =>
    context.engagement.boundaryPending ? Infinity : nextSignetIllusionsPulse(context, context.time),
  run(context) {
    const skill = equippedSignetOfIllusions(context);

    if (
      !skill ||
      context.engagement.boundaryPending ||
      (context.cooldownController.readyAt(skill.id) ?? 0) > context.time
    )
      return;

    createMesmerIllusionRewards(context).gainResources(
      context.time,
      skillNumberFromContext(context, ID.SIGNET_OF_ILLUSIONS, 'resourceGain'),
      mesmerActivePrimaryWeapon(context),
      skill.name,
      { sourceSkillId: skill.id }
    );
  }
});

/** Cast and combat boundaries retain their own anchors while shared ownership replaces the old occurrence. */
export function restartSignetIllusionsPassive(context: MesmerRuntime, activeAt: number): void {
  signetIllusionsPassive.restart(context, nextSignetIllusionsPulse(context, activeAt));
}
