import { autonomousActionsAllowed } from '#gw2/platform/combat/engagement.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type {
  ThiefGuildSummonProfile,
  ThiefRuntimeState,
  ThiefSummonCondition,
  ThiefSummonStrike
} from '#gw2/professions/thief/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

import { buildThiefCondition, buildThiefStrikes } from '#gw2/professions/thief/core/events.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import type { ThiefSkill, ThiefSummonDefinition } from '#gw2/professions/thief/types.js';

export const THIEF_GUILD_ATTACK = 'thief.thieves-guild-attack';
export const THIEF_GUILD_EXPIRY = 'thief.thieves-guild-expire';

interface GuildAttackWork {
  readonly ownerId: string;
  readonly summonIndex: number;
  readonly attackIndex: number;
  readonly occurrence: number;
}

/** A family binding supplies elite identity and live condition policy, never baseline attack data. */
export interface ThiefGuildContribution {
  readonly profileId: SkillId;
  readonly conditions?: (runtime: ThiefRuntime, attack: ThiefSummonStrike) => readonly ThiefSummonCondition[];
}

/** Bind one guild policy per selected runtime while keeping lifetime and scheduling in Core. */
export function createThievesGuildHooks(
  contribution: ThiefGuildContribution | null
): RuntimeHooks<ThiefRuntimeState, ThiefSkill> {
  /** The two shared thieves plus the active specialization's third summon (Core Thief otherwise). */
  function thievesGuildSummons(runtime: ThiefRuntime): ThiefSummonDefinition[] {
    const skill: ThiefSkill | undefined = runtime.helpers.skillsById.get(ID.THIEVES_GUILD);
    const profile = skill?.summonAttack;
    if (!profile) return [];
    const third = contribution
      ? (requireBalanceProfileFromContext(runtime, contribution.profileId) as ThiefGuildSummonProfile)
      : profile.summons.find((summon) => summon.variant === 'Core Thief');
    return [...profile.summons.filter((summon) => summon.variant == null), ...(third ? [third] : [])];
  }

  /** A committed summon replaces any active guild; its streams start with combat. */
  function summonThievesGuild(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
    const profile = cast.skill.summonAttack;
    if (!profile) return;
    const core = runtime.profession.core;
    const expiresAt = canonicalTime(cast.start + (profile.duration || 0));
    core.activeThievesGuild = {
      ownerId: `${cast.id}:thieves-guild`,
      expiresAt,
      started: false
    };
    runtime.schedule(THIEF_GUILD_EXPIRY, expiresAt, { ownerId: core.activeThievesGuild.ownerId });
    startThievesGuild(runtime);
  }

  /** Starts every authored attack stream once, at the accepted combat boundary or the summon itself. */
  function startThievesGuild(runtime: ThiefRuntime): void {
    const active = runtime.profession.core.activeThievesGuild;
    if (!autonomousActionsAllowed(runtime) || !active || active.started || runtime.time >= active.expiresAt) return;
    active.started = true;
    for (const [summonIndex, summon] of thievesGuildSummons(runtime).entries())
      for (const [attackIndex, attack] of (summon.attacks || []).entries()) {
        const at = canonicalTime(runtime.time + (attack.initialDelay || 0));
        if (at < active.expiresAt)
          runtime.schedule(THIEF_GUILD_ATTACK, at, {
            ownerId: active.ownerId,
            summonIndex,
            attackIndex,
            occurrence: 0
          } satisfies GuildAttackWork);
      }
  }

  /** One summon attack: its packets share a fresh activation, then the stream schedules its next occurrence. */
  function thievesGuildAttack(runtime: ThiefRuntime, data: unknown): void {
    const work = data as GuildAttackWork;
    const active = runtime.profession.core.activeThievesGuild;
    if (
      !autonomousActionsAllowed(runtime) ||
      !active ||
      active.ownerId !== work.ownerId ||
      runtime.time >= active.expiresAt
    )
      return;
    const skill: ThiefSkill | undefined = runtime.helpers.skillsById.get(ID.THIEVES_GUILD);
    const profile = skill?.summonAttack;
    const summon = thievesGuildSummons(runtime)[work.summonIndex];
    const attack = summon?.attacks?.[work.attackIndex];
    if (!profile || !summon || !attack) return;
    const hits = Math.max(1, attack.hits ?? 1);
    const summonName = `Thieves Guild — ${summon.name}`;
    const attackName = `${summonName} — ${attack.name}`;
    const common = {
      at: runtime.time,
      sourceId: 'thief.thieves-guild',
      actorType: 'summon' as const,
      skillId: attack.skillId ?? ID.THIEVES_GUILD,
      skillName: summonName,
      parentSkillName: 'Thieves Guild',
      damageBreakdownName: `${summon.displayName || summon.name} — ${attack.name}`,
      summonIgnoresBoons: true,
      summonUsesEquipmentModifiers: false,
      activationId: `${work.ownerId}:${work.summonIndex}:${work.attackIndex}:${work.occurrence}`
    };
    buildThiefStrikes(null, {
      ...common,
      name: attackName,
      coefficient: (attack.coefficientPerHit || 0) * hits,
      hits,
      hitIndex: 1,
      totalHits: hits,
      skillWeapon: summon.weapon,
      weaponStrengthProfileId: summon.weaponStrengthProfileId,
      independentSummonStrike: true,
      summonBasePower: profile.basePower,
      summonCriticalChance: profile.criticalChance,
      summonCriticalDamage: profile.criticalDamage
    }).forEach((packet) => runtime.effects.emit({ kind: 'packet', event: packet }));
    // Only the selected elite's attacks use its policy; shared thieves retain their authored conditions.
    const conditions =
      summon.variant != null && contribution?.conditions
        ? contribution.conditions(runtime, attack)
        : attack.conditions || [];
    for (const condition of conditions)
      runtime.effects.emit({
        kind: 'packet',
        event: buildThiefCondition(null, {
          ...common,
          name: `${attackName} — ${condition.condition}`,
          condition: condition.condition,
          stacks: condition.stacks,
          duration: condition.duration || 0,
          summonInheritsAttributes: true
        })
      });
    const next = canonicalTime(runtime.time + (attack.interval || 0));
    if ((attack.interval || 0) > 0 && next < active.expiresAt)
      runtime.schedule(THIEF_GUILD_ATTACK, next, {
        ...work,
        occurrence: work.occurrence + 1
      } satisfies GuildAttackWork);
  }

  /** The guild's shared lifetime retires every stream at once. */
  function expireThievesGuild(runtime: ThiefRuntime, data: unknown): void {
    const core = runtime.profession.core;
    if (core.activeThievesGuild?.ownerId === (data as { ownerId: string }).ownerId) core.activeThievesGuild = null;
  }

  return {
    sideEffectHandlers: {
      'thief.summon-guild'(runtime, context) {
        if (context.kind === 'cast') summonThievesGuild(runtime, context.cast);
      }
    },
    onCombatStart: startThievesGuild,
    tasks: { [THIEF_GUILD_ATTACK]: thievesGuildAttack, [THIEF_GUILD_EXPIRY]: expireThievesGuild }
  };
}
