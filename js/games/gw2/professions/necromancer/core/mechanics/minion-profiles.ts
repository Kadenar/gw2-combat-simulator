import { balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import {
  NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE,
  NECROMANCER_MINION_PROFILE_BY_SKILL_ID
} from '#gw2/professions/necromancer/core/profiles.js';
import type { SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import type { SkillEffect, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { NecromancerCastContext, NecromancerSkill } from '#gw2/professions/necromancer/types.js';

export interface MinionAttack {
  readonly name: string;
  readonly coefficient?: number;
  readonly offset?: number;
  readonly skillId?: SkillId;
  readonly icon?: string;
  readonly weaponStrength?: number;
  readonly damagePerCoefficient?: number;
  readonly comboFinishers?: readonly SchedulerRecord[];
  readonly condition?: readonly (string | number)[];
  readonly controlKind?: string;
  readonly controlDuration?: number;
}

export interface MinionDefinition {
  readonly key: string;
  readonly count: number;
  readonly interval: number;
  readonly initialDelay?: number;
  readonly coefficient: number;
  readonly commandId?: SkillId;
  readonly rechargeOnMinionDeath?: boolean;
  readonly weaponStrength?: number;
  readonly basePower?: number;
  readonly damagePerCoefficient?: number;
  readonly criticalChance?: number;
  readonly criticalDamage?: number;
  readonly commandRecoveryDelay?: number;
  readonly attacks?: readonly MinionAttack[];
  readonly alternateEvery?: number;
  readonly alternateAttacks?: readonly MinionAttack[];
}

export interface MinionCommandDefinition {
  readonly minion: string;
  readonly coefficient?: number;
  readonly condition?: readonly (string | number)[];
  readonly conditions?: readonly (readonly (string | number)[])[];
  readonly control?: string;
  readonly controlDuration?: number;
  readonly controlWindow?: number;
  readonly blindDuration?: number;
  readonly impactDelay?: number;
  readonly consumes?: number;
  readonly lifeForceGain?: number;
  readonly attacks?: readonly MinionAttack[];
}

function minionAttackFromEffect(effect: SkillEffect, fallbackName: string): MinionAttack {
  return {
    name: String(effect.name || fallbackName),
    coefficient: Number(effect.coefficient || 0),
    offset: Number(effect.atMs || 0) / 1000,
    skillId: effect.sourceId,
    icon: effect.icon == null ? undefined : String(effect.icon),
    damagePerCoefficient: effect.damagePerCoefficient == null ? undefined : Number(effect.damagePerCoefficient),
    comboFinishers: effect.comboFinishers
  };
}

/** Compiles one summon balance profile into the attack model consumed by the scheduler. */
export function minionDefinitionForSkill(
  context: NecromancerCastContext,
  skillId: SkillId
): MinionDefinition | undefined {
  const profileId = NECROMANCER_MINION_PROFILE_BY_SKILL_ID[Number(skillId)];
  const profile = balanceProfileFromContext(context, profileId);
  if (!profile) return undefined;
  const strikes = (profile.effects || []).filter((effect) => effect.type === 'strike');
  const ordinary = strikes.filter((effect) => effect.packetLabel !== 'alternate');
  const alternate = strikes.filter((effect) => effect.packetLabel === 'alternate');
  const alternateCondition = (profile.effects || []).find(
    (effect) => effect.type === 'condition' && effect.packetLabel === 'alternate'
  );
  const toAttack = (effect: SkillEffect): MinionAttack => ({
    ...minionAttackFromEffect(effect, profile.name),
    ...(alternateCondition
      ? {
          condition: [
            String(alternateCondition.condition || ''),
            Number(alternateCondition.stacks ?? 1),
            Number(alternateCondition.duration || 0)
          ]
        }
      : {})
  });
  return {
    key: String(profile.minionKey || ''),
    count: Number(profile.minionCount ?? 1),
    interval: Number(profile.pulseInterval || 0),
    initialDelay: profile.initialDelay == null ? undefined : Number(profile.initialDelay),
    coefficient: Number(ordinary[0]?.coefficient || 0),
    commandId: profile.commandId as SkillId | undefined,
    weaponStrength: profile.weaponStrength == null ? undefined : Number(profile.weaponStrength),
    basePower: Number(profile.basePower || 0),
    damagePerCoefficient: Number(profile.damagePerCoefficient || 0),
    criticalChance: Number(profile.criticalChance || 0),
    criticalDamage: Number(profile.criticalDamage || 0),
    commandRecoveryDelay:
      profile.commandRecoveryDelayMs == null ? undefined : Number(profile.commandRecoveryDelayMs) / 1000,
    attacks: ordinary.map(toAttack),
    alternateEvery: Number(profile.alternateEvery || 0),
    alternateAttacks: alternate.map(toAttack)
  };
}

export function minionDefinitionFor(context: NecromancerCastContext, key: string): MinionDefinition | undefined {
  for (const skillId of Object.keys(NECROMANCER_MINION_PROFILE_BY_SKILL_ID)) {
    const definition = minionDefinitionForSkill(context, Number(skillId));
    if (definition?.key === key) return definition;
  }

  return undefined;
}

export function summonWeaponStrength(context: NecromancerCastContext): number {
  return Number(balanceProfileFromContext(context, PROFILE.summonAttributes)?.weaponStrength ?? 1048);
}

/** Compiles a command skill's declarative packets into its compact scheduler input. */
export function commandDefinitionFor(skill: NecromancerSkill): MinionCommandDefinition {
  const effects = skill.effects || [];
  const strike = effects.find((effect) => effect.type === 'strike' && !Array.isArray(effect.ticks));
  const tickStrike = effects.find((effect) => effect.type === 'strike' && Array.isArray(effect.ticks));
  const ticks = Array.isArray(tickStrike?.ticks) ? tickStrike.ticks : [];
  const attacks: MinionAttack[] = ticks.map((tick) => ({
    name: String(tick.name || skill.name),
    coefficient: Number(tick.coefficient || 0),
    offset: Number(tick.atMs || 0) / 1000,
    skillId: tick.sourceId as SkillId | undefined,
    comboFinishers: Array.isArray(tick.comboFinishers) ? tick.comboFinishers : undefined,
    controlKind: String(tick.controlKind || ''),
    controlDuration: Number(tick.controlDuration || 0)
  }));
  const conditions = effects
    .filter((effect) => effect.type === 'condition')
    .map(
      (effect) => [String(effect.condition || ''), Number(effect.stacks ?? 1), Number(effect.duration || 0)] as const
    );
  const controlEffect = effects.find((effect) => effect.type === 'control' || effect.type === 'blind');
  return {
    minion: String(skill.minionKey || ''),
    coefficient: Number(strike?.coefficient || 0),
    conditions,
    control: String(
      controlEffect?.type === 'blind' ? 'blind' : controlEffect?.controlKind || attacks[0]?.controlKind || ''
    ),
    controlDuration: Number(controlEffect?.duration ?? attacks[0]?.controlDuration ?? 0),
    controlWindow: Number(skill.controlWindow || 0),
    blindDuration: Number(controlEffect?.duration || 0),
    impactDelay: Number(skill.impactDelay || 0),
    consumes: Number(skill.consumes || 0),
    lifeForceGain: Number(skill.lifeForceOnHit || 0),
    attacks
  };
}
