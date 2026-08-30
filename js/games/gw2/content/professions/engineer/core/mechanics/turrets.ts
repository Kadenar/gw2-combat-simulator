import { emitSkillBuff, emitSkillCondition, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { emitStateSnapshot } from '#gw2/platform/engine/events/state-snapshots.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/content/professions/engineer/data/ids.js';
import { snapshotEngineerState } from '#gw2/content/professions/engineer/state.js';
import type { SchedulerRecord, Skill, SkillEffect, SkillId } from '#gw2/platform/engine/types.js';
import type {
  EngineerCastContext,
  EngineerScheduledTask,
  EngineerSchedulerContext,
  EngineerSkill
} from '#gw2/content/professions/engineer/types.js';

interface TurretAttackPayload extends SchedulerRecord {
  readonly skillId: number;
  readonly attackIndex: number;
}

export const ENGINEER_TURRET_ATTACK_SKILL_IDS = Object.freeze({
  rifle: 'engineer.turret.rifle.attack',
  flame: 'engineer.turret.flame.attack',
  thumper: 'engineer.turret.thumper.attack',
  rocket: 'engineer.turret.rocket.attack'
});

/** Defines the hidden autonomous attack skill used by a deployed turret. */
const turretAttack = (
  id: string,
  name: string,
  cooldown: number,
  coefficient: number,
  condition?: string,
  conditionDuration?: number
): Skill => ({
  id,
  name: `${name} Attack`,
  description: `Autonomous attack performed by ${name}.`,
  type: 'Profession',
  slot: 'Action',
  categories: ['Turret', 'Summon'],
  castTimeMs: 0,
  cooldown,
  ammo: 5,
  implemented: true,
  simulatorExcluded: true,
  slotSelectable: false,
  effects: [
    {
      type: 'strike',
      coefficient,
      hits: 1,
      name,
      actorType: 'summon'
    },
    ...(condition
      ? [
          {
            type: 'condition' as const,
            condition,
            stacks: 1,
            duration: Number(conditionDuration || 0),
            name: `${name} — ${condition}`,
            actorType: 'summon' as const
          }
        ]
      : [])
  ]
});

export const ENGINEER_TURRET_ATTACK_SKILLS: readonly Skill[] = Object.freeze([
  turretAttack(ENGINEER_TURRET_ATTACK_SKILL_IDS.rifle, 'Rifle Turret', 2, 0.75),
  turretAttack(ENGINEER_TURRET_ATTACK_SKILL_IDS.flame, 'Flame Turret', 3, 0.2, 'Burning', 2),
  turretAttack(ENGINEER_TURRET_ATTACK_SKILL_IDS.thumper, 'Thumper Turret', 3, 1, 'Crippled', 3),
  turretAttack(ENGINEER_TURRET_ATTACK_SKILL_IDS.rocket, 'Rocket Turret', 4, 2.25)
]);

const TURRET_ATTACK_SKILL_BY_DEPLOYMENT: Readonly<Record<number, SkillId>> = Object.freeze({
  [ID.RIFLE_TURRET]: ENGINEER_TURRET_ATTACK_SKILL_IDS.rifle,
  [ID.FLAME_TURRET]: ENGINEER_TURRET_ATTACK_SKILL_IDS.flame,
  [ID.THUMPER_TURRET]: ENGINEER_TURRET_ATTACK_SKILL_IDS.thumper,
  [ID.ROCKET_TURRET]: ENGINEER_TURRET_ATTACK_SKILL_IDS.rocket
});

function attackEffect(skill: Skill, type: SkillEffect['type']): SkillEffect | undefined {
  return skill.effects?.find((effect) => effect.type === type);
}

/** Returns the task owner shared by every autonomous attack from one deployed turret. */
export function turretOwnerId(skillId: SkillId): string {
  return `engineer.turret.${Number(skillId)}`;
}

/** Arms a turret's detonate flip, applies deploy effects, and starts its autonomous attack chain. */
export function deployEngineerTurret(context: EngineerCastContext, skill: EngineerSkill): void {
  const at = context.effectiveEnd;
  const flipSkillId = Number(skill.paletteFlipSkillId ?? skill.flipSkillId);
  if (Number.isFinite(flipSkillId)) {
    professionCoreState(context).availableFlips[flipSkillId] = true;
  }

  if (skill.id === ID.HEALING_TURRET) {
    emitSkillBuff(context, {
      at,
      source: 'engineer',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: skill.name,
      kind: 'regeneration',
      stacks: 1,
      duration: gw2SchedulerBoonDuration(context, skill, 'regeneration', 3)
    });
  }

  if (TURRET_ATTACK_SKILL_BY_DEPLOYMENT[Number(skill.id)]) {
    // schedule the first attack; each attack task schedules the next up to the 5-attack max
    context.tasks.schedule({
      type: 'engineer.turret-attack',
      at,
      ownerId: turretOwnerId(skill.id),
      payload: {
        skillId: skill.id,
        attackIndex: 1
      }
    });
  }

  emitStateSnapshot(context, 'engineer', at, 'deploy-turret', snapshotEngineerState(context.state.profession));
}

/** Emits one autonomous turret attack and schedules the next packet until its ammo limit is reached. */
export function handleEngineerTurretAttack(
  context: EngineerSchedulerContext,
  task: EngineerScheduledTask<TurretAttackPayload>
): void {
  if (!task.payload) return;
  const skillId = Number(task.payload.skillId);
  const attackSkillId = TURRET_ATTACK_SKILL_BY_DEPLOYMENT[skillId];
  const attackSkill = context.catalog.skillsById.get(attackSkillId);
  if (!attackSkill) return;
  const strike = attackEffect(attackSkill, 'strike');
  if (!strike) return;
  const attackIndex = Number(task.payload.attackIndex || 1);
  const maximumAttacks = Number(attackSkill.ammo || 1);
  const attackName = String(strike.name || attackSkill.name);
  emitSkillDamage(context, {
    at: task.at,
    source: 'engineer',
    sourceId: skillId,
    // summon actorType prevents player-only trait procs (e.g. Explosive Entrance) from firing
    actorType: 'summon',
    skillId,
    skillName: attackName,
    name: attackName,
    coefficient: Number(strike.coefficient || 0),
    hits: 1,
    hitIndex: attackIndex,
    totalHits: maximumAttacks,
    skillWeapon: 'Unequipped'
  });
  const condition = attackEffect(attackSkill, 'condition');
  const profile = { name: attackName, condition: condition?.condition };
  if (condition) {
    emitSkillCondition(context, {
      at: task.at,
      source: 'engineer',
      sourceId: skillId,
      actorType: 'summon',
      skillId,
      skillName: attackName,
      name: `${profile.name} — ${profile.condition}`,
      condition: String(condition.condition),
      stacks: Number(condition.stacks || 1),
      duration: Number(condition.duration || 0)
    });
  }

  // 5 attacks per deployment — stop scheduling after the last one
  if (attackIndex >= maximumAttacks) return;
  context.tasks.schedule({
    type: 'engineer.turret-attack',
    at: task.at + Number(attackSkill.cooldown || 0),
    ownerId: turretOwnerId(skillId),
    payload: {
      skillId,
      attackIndex: attackIndex + 1
    }
  });
}
