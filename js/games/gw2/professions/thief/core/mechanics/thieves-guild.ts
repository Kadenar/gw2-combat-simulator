import { autonomousActionsAllowed } from '#gw2/platform/combat/engagement.js';
import { ACTOR } from '#gw2/platform/constants.js';
import { ConditionEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import {
  effectNumber,
  requireEffect,
  requireSkillFromContext,
  skillNumber
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { buildThiefCondition, buildThiefStrikes } from '#gw2/professions/thief/core/events.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { ThiefRuntimeState, ThiefSkill, ThiefSummonDefinition } from '#gw2/professions/thief/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

const THIEF_GUILD_ATTACK = 'thief.thieves-guild-attack';
const THIEF_GUILD_EXPIRY = 'thief.thieves-guild-expire';

interface GuildAttackWork {
  readonly ownerId: string;
  readonly summonIndex: number;
  readonly attackIndex: number;
  readonly occurrence: number;
}

/** A family binding supplies elite identity and live condition policy, never baseline attack data. */
export interface ThiefGuildContribution {
  readonly actor: ThiefSummonDefinition;
  readonly conditions?: (runtime: ThiefRuntime, skill: Skill) => readonly ConditionEffect[];
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

    const third = contribution ? contribution.actor : profile.summons.find((summon) => summon.variant === 'Core Thief');
    return [...profile.summons.filter((summon) => summon.variant == null), ...(third ? [third] : [])];
  }

  /** A committed summon replaces any active guild; its streams start with combat. */
  function summonThievesGuild(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
    const profile = cast.skill.summonAttack;

    if (!profile) return;

    const core = runtime.profession.core;
    const expiresAt = canonicalTime(cast.start + skillNumber(cast.skill, 'duration'));
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

    // Resolve both packets and repeat recharge from the selected actor skill at each occurrence.
    const actorSkill = requireSkillFromContext(runtime, attack.skillId);
    const strike = requireEffect(actorSkill, 'strike', 'Strike');
    const summonName = `Thieves Guild — ${summon.name}`;
    const attackName = `${summonName} — ${actorSkill.displayName}`;
    const common = {
      at: runtime.time,
      sourceId: 'thief.thieves-guild',
      actorType: ACTOR.SUMMON,
      skillName: summonName,
      parentSkillName: 'Thieves Guild',
      damageBreakdownName: `${summon.displayName || summon.name} — ${actorSkill.displayName}`,
      summonIgnoresBoons: true,
      summonUsesEquipmentModifiers: false,
      activationId: `${work.ownerId}:${work.summonIndex}:${work.attackIndex}:${work.occurrence}`
    };

    if (strike) {
      const hits = effectNumber(actorSkill, strike, 'hits');
      buildThiefStrikes({
        ...common,
        skillId: strike.sourceId ?? actorSkill.id,
        name: attackName,
        coefficient: effectNumber(actorSkill, strike, 'coefficient'),
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
    }

    // Removing a strike never suppresses independent conditions or changes the actor's next decision.
    const conditions =
      summon.variant != null && contribution?.conditions
        ? contribution.conditions(runtime, actorSkill)
        : (actorSkill.effects || []).filter((effect): effect is ConditionEffect => effect.type === 'condition');
    for (const condition of conditions)
      runtime.effects.emit({
        kind: 'packet',
        event: buildThiefCondition(null, {
          ...common,
          skillId: condition.sourceId ?? actorSkill.id,
          name: `${attackName} — ${condition.condition}`,
          condition: String(condition.condition),
          stacks: effectNumber(actorSkill, condition, 'stacks'),
          duration: effectNumber(actorSkill, condition, 'duration'),
          summonInheritsAttributes: true
        })
      });
    const interval = skillNumber(actorSkill, 'cooldown');
    const next = canonicalTime(runtime.time + interval);

    if (interval > 0 && next < active.expiresAt)
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
