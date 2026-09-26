import {
  requireBalanceProfileFromContext,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import {
  NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE,
  NECROMANCER_MINION_PROFILE_BY_SKILL_ID
} from '#gw2/professions/necromancer/core/profiles.js';
import type { BalanceProfile, SkillEffect, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { NecromancerSkill } from '#gw2/professions/necromancer/types.js';

export interface MinionAttack {
  readonly name: string;
  readonly coefficient?: number;
  readonly offset?: number;
  /** Accelerable animation within the repeat interval; idle time remains fixed. */
  readonly castTimeMs?: number;
  readonly skillId?: SkillId;
  readonly icon?: string;
  readonly weaponStrength?: number;
  readonly damagePerCoefficient?: number;
  readonly comboFinishers?: SkillEffect['comboFinishers'];
  readonly condition?: readonly (string | number)[];
  readonly controlKind?: string;
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

  readonly controlWindow?: number;
  readonly blindDuration?: number;
  readonly impactDelay?: number;
  readonly consumes?: number;
  readonly lifeForceGain?: number;
  readonly attacks?: readonly MinionAttack[];
}

function minionAttackFromEffect(profile: BalanceProfile, effect: SkillEffect): MinionAttack {
  return {
    // Packet keys may differ while their summon attack attribution remains shared.
    name: String(effect.skillName || effect.name || profile.name),
    coefficient: effectNumber(profile, effect, 'coefficient'),
    offset: Number(effect.atMs || 0) / 1000,
    castTimeMs: Number(effect.castTimeMs || 0),
    skillId: effect.sourceId,
    icon: effect.icon == null ? undefined : String(effect.icon),
    damagePerCoefficient: effect.damagePerCoefficient == null ? undefined : Number(effect.damagePerCoefficient),
    comboFinishers: effect.comboFinishers
  };
}

/** Compiles one summon balance profile into the attack model used by its lifetime owner. */
export function minionDefinitionForSkill(context: unknown, skillId: SkillId): MinionDefinition | undefined {
  const profileId = NECROMANCER_MINION_PROFILE_BY_SKILL_ID[Number(skillId)];
  // Only minion skills compile a summon; every mapped skill must have its profile.
  if (profileId == null) return undefined;
  const profile = requireBalanceProfileFromContext(context, profileId);
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
    count: balanceProfileNumber(profile, 'minionCount'),
    interval: balanceProfileNumber(profile, 'pulseInterval'),
    initialDelay: profile.initialDelay == null ? undefined : balanceProfileNumber(profile, 'initialDelay'),
    // With every ordinary attack removed the minion has no autonomous strike.
    coefficient: ordinary[0] ? effectNumber(profile, ordinary[0], 'coefficient') : 0,
    commandId: profile.commandId as SkillId | undefined,
    weaponStrength: profile.weaponStrength == null ? undefined : balanceProfileNumber(profile, 'weaponStrength'),
    basePower: balanceProfileNumber(profile, 'basePower'),
    damagePerCoefficient: balanceProfileNumber(profile, 'damagePerCoefficient'),
    criticalChance: balanceProfileNumber(profile, 'criticalChance'),
    criticalDamage: balanceProfileNumber(profile, 'criticalDamage'),
    commandRecoveryDelay:
      profile.commandRecoveryDelayMs == null ? undefined : Number(profile.commandRecoveryDelayMs) / 1000,
    attacks: ordinary.map(toAttack),
    // Cadence applies only while alternate attacks survive.
    alternateEvery: alternate.length ? balanceProfileNumber(profile, 'alternateEvery') : 0,
    alternateAttacks: alternate.map(toAttack)
  };
}

export function minionDefinitionFor(context: unknown, key: string): MinionDefinition | undefined {
  for (const skillId of Object.keys(NECROMANCER_MINION_PROFILE_BY_SKILL_ID)) {
    const definition = minionDefinitionForSkill(context, Number(skillId));
    if (definition?.key === key) return definition;
  }

  return undefined;
}

export function summonWeaponStrength(context: unknown): number {
  return balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.summonAttributes), 'weaponStrength');
}

/** Compiles a command skill's declarative packets into its command payload. */
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
    controlKind: String(tick.controlKind || '')
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

    controlWindow: Number(skill.controlWindow || 0),
    blindDuration: Number(controlEffect?.duration || 0),
    impactDelay: Number(skill.impactDelay || 0),
    consumes: Number(skill.consumes || 0),
    lifeForceGain: Number(skill.lifeForceOnHit || 0),
    attacks
  };
}
