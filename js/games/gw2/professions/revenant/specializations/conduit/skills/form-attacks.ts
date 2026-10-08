import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { activeRevenantUpkeep } from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { conduitState, revenantConduitFormIsActive } from '#gw2/professions/revenant/specializations/conduit/state.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

export const UPKEEP_DAGGERS = 'revenant.conduit-upkeep-daggers';

// A cast started in Dervish form keeps its scythe through form expiry or a concurrent legend swap.
export const dervishCasts = new WeakSet<RuntimeCast<RevenantSkill>>();

export function lesserDaggers(runtime: RevenantRuntime, source: Skill, cause?: Gw2ResolverEvent): void {
  if (!revenantConduitFormIsActive(conduitState.from(runtime), 'Assassin', runtime.time)) return;
  const skill = runtime.helpers.skillsById.get(ID.LESSER_ENCHANTED_DAGGERS);
  if (!skill) throw new Error('Missing Lesser Enchanted Daggers skill declaration.');
  const hit = requireEffect(skill, 'strike', 'Lesser Enchanted Daggers');
  if (!hit) return;
  // Form procs retain player modifiers without recursively triggering player on-hit attacks.
  runtime.effects.emit({
    kind: 'profile',
    profile: skill,
    effects: [hit],
    attribution: {
      source: 'revenant',
      sourceId: skill.id,
      actorType: 'effect',
      ownerActorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      triggeredBy: source.name
    },
    cause,
    transform: (event) => ({
      ...event,
      name: 'Lesser Enchanted Daggers',
      skillWeapon: 'Unequipped',
      icon: skill.icon || ''
    })
  });
}

export function dervishAttack(
  runtime: RevenantRuntime,
  cast: RuntimeCast<RevenantSkill>,
  at: number,
  elite = false
): void {
  const skillId = elite ? ID.FORM_OF_THE_DERVISH_ATTACK_ELITE : ID.FORM_OF_THE_DERVISH_ATTACK;
  const attack = runtime.helpers.skillsById.get(skillId);
  if (!attack) throw new Error('Missing Form of the Dervish attack skill ' + skillId + '.');
  const name = elite ? 'Form of the Dervish (Attack - Elite)' : 'Form of the Dervish (Attack)';
  const hit = requireEffect(attack, 'strike', name);
  if (!hit) return;
  // A removed scythe leaves no attack; surviving hits keep their authored sequence.
  runtime.effects.emit({
    kind: 'profile',
    profile: attack,
    effects: [hit],
    at,
    attribution: {
      source: 'revenant',
      sourceId: attack.id,
      actorType: 'effect',
      ownerActorType: 'player',
      skillId: attack.id,
      skillName: 'Form of the Dervish',
      activationId: cast.id,
      triggeredBy: cast.skill.name
    },
    transform: (event) => ({ ...event, name, skillWeapon: 'Unequipped', icon: attack.icon || '' })
  });
}

export function upkeepDaggers(runtime: RevenantRuntime, data: unknown): void {
  const { skillId, startsAt } = data as { skillId: SkillId; startsAt: number };
  const skill = runtime.helpers.skillsById.get(skillId);
  if (!activeRevenantUpkeep(runtime, skillId, startsAt) || !skill) return;
  lesserDaggers(runtime, skill);
  runtime.schedule(UPKEEP_DAGGERS, canonicalTime(runtime.time + 1), data, undefined, -190);
}
