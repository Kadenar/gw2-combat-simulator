import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { effectNumber, requireSkillFromContext, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import { NECROMANCER_MINION_SUMMON_IDS } from '#gw2/professions/necromancer/core/skills/minion-attacks.js';
import type { NecromancerSkill } from '#gw2/professions/necromancer/types.js';

export interface MinionAttack {
  readonly effect?: SkillEffect;
  readonly name: string;
  readonly coefficient?: number;
  readonly offset?: number;
  /** Accelerable animation within the repeat interval; idle time remains fixed. */
  readonly castTimeMs?: number;
  readonly skillId?: SkillId;
  readonly icon?: string;
  readonly damagePerCoefficient?: number;
  readonly comboFinishers?: SkillEffect['comboFinishers'];
  readonly condition?: readonly (string | number)[];
  readonly controlKind?: string;
}

export interface MinionDefinition {
  readonly key: string;
  readonly count: number;
  readonly interval: number;
  /** Time from engaging an in-range target to the first impact, independent of repeat cadence. */
  readonly openingAttackWindupMs: number;
  readonly commandId?: SkillId;
  readonly weaponStrength: number;
  readonly basePower?: number;
  readonly damagePerCoefficient?: number;
  readonly criticalChance?: number;
  readonly criticalDamage?: number;
  readonly commandRecoveryDelay?: number;
  readonly attacks?: readonly MinionAttack[];
  readonly alternateEvery?: number;
  readonly alternateAttacks?: readonly MinionAttack[];
}

interface MinionCommandDefinition {
  readonly strike?: SkillEffect;
  readonly coefficient?: number;
  readonly conditions?: readonly (readonly (string | number)[])[];
  readonly control?: string;

  readonly impactDelay?: number;
  readonly consumes?: number;
  readonly attacks?: readonly MinionAttack[];
}

function minionAttackFromEffect(profile: Skill, effect: SkillEffect): MinionAttack {
  return {
    // Packet keys may differ while their summon attack attribution remains shared.
    name: effect.skillName || effect.name || profile.name,
    coefficient: effectNumber(profile, effect, 'coefficient'),
    offset: (effect.atMs || 0) / 1000,
    castTimeMs: Number(effect.castTimeMs || 0),
    skillId: effect.sourceId,
    icon: effect.icon == null ? undefined : effect.icon,
    damagePerCoefficient: effect.damagePerCoefficient == null ? undefined : Number(effect.damagePerCoefficient),
    comboFinishers: effect.comboFinishers
  };
}

/** Compiles the selected summon and attack skills into the attack model used by its lifetime owner. */
export function minionDefinitionForSkill(context: unknown, skillId: SkillId): MinionDefinition | undefined {
  if (!NECROMANCER_MINION_SUMMON_IDS.some((id) => id === skillId)) return undefined;

  const summon = requireSkillFromContext(context, skillId);

  if (!summon.summonAttackId) return undefined;

  // Both explicit and configured summons compile selected canonical skill owners.
  const profile = requireSkillFromContext(context, summon.summonAttackId as SkillId);
  // Attack lists are iterated, so removing any packet leaves the surviving ones in their declared roles.
  const strikes = (profile.effects || []).filter((effect) => effect.type === 'strike');
  const ordinary = strikes.filter((effect) => effect.packetLabel !== 'alternate');
  const alternate = strikes.filter((effect) => effect.packetLabel === 'alternate');
  const alternateCondition = (profile.effects || []).find(
    (effect) => effect.type === 'condition' && effect.packetLabel === 'alternate'
  );
  const toAttack = (effect: SkillEffect): MinionAttack => ({
    ...minionAttackFromEffect(profile, effect),
    // Alternate conditions belong only to their alternate attack cycle.
    ...(alternateCondition && effect.packetLabel === 'alternate'
      ? {
          condition: [
            String(alternateCondition.condition),
            effectNumber(profile, alternateCondition, 'stacks'),
            effectNumber(profile, alternateCondition, 'duration')
          ]
        }
      : {})
  });
  return {
    key: String(profile.minionKey || ''),
    count: skillNumber(summon, 'minionCount'),
    interval: skillNumber(profile, 'pulseInterval'),
    openingAttackWindupMs: skillNumber(profile, 'openingAttackWindupMs'),
    commandId: profile.commandId as SkillId | undefined,
    weaponStrength: skillNumber(profile, 'weaponStrength'),
    basePower: skillNumber(profile, 'basePower'),
    damagePerCoefficient: skillNumber(profile, 'damagePerCoefficient'),
    criticalChance: skillNumber(profile, 'criticalChance'),
    criticalDamage: skillNumber(profile, 'criticalDamage'),
    commandRecoveryDelay:
      profile.commandRecoveryDelayMs == null ? undefined : Number(profile.commandRecoveryDelayMs) / 1000,
    attacks: ordinary.map(toAttack),
    // Cadence applies only while alternate attacks survive.
    alternateEvery: alternate.length ? skillNumber(profile, 'alternateEvery') : 0,
    alternateAttacks: alternate.map(toAttack)
  };
}

export function minionDefinitionFor(context: unknown, key: string): MinionDefinition | undefined {
  for (const skillId of NECROMANCER_MINION_SUMMON_IDS) {
    const definition = minionDefinitionForSkill(context, skillId);

    if (definition?.key === key) return definition;
  }

  return undefined;
}

/** Compiles a command skill's declarative packets into its command payload. */
export function commandDefinitionFor(skill: NecromancerSkill): MinionCommandDefinition {
  const effects = skill.effects || [];
  const strike = effects.find((effect) => effect.type === 'strike' && !Array.isArray(effect.ticks));
  const tickStrike = effects.find((effect) => effect.type === 'strike' && Array.isArray(effect.ticks));
  const ticks = Array.isArray(tickStrike?.ticks) ? tickStrike.ticks : [];
  const conditions = effects
    .filter((effect) => effect.type === 'condition')
    .map((effect) => [effect.condition || '', effect.stacks ?? 1, effect.duration || 0] as const);
  // A command's condition accompanies each projectile rather than becoming a generic disable.
  const attacks: MinionAttack[] = ticks.map((tick) => ({
    name: String(tick.name || skill.name),
    coefficient: Number(tick.coefficient || 0),
    offset: Number(tick.atMs || 0) / 1000,
    skillId: tick.sourceId as SkillId | undefined,
    comboFinishers: Array.isArray(tick.comboFinishers) ? tick.comboFinishers : undefined,
    controlKind: String(tick.controlKind || ''),
    condition: conditions[0]
  }));

  const controlEffect = effects.find((effect) => effect.type === 'control');
  return {
    strike,
    coefficient: Number(strike?.coefficient || 0),
    conditions,
    control: controlEffect?.controlKind || attacks[0]?.controlKind || '',
    impactDelay: skill.impactDelay || 0,
    consumes: skill.consumes || 0,
    attacks
  };
}
