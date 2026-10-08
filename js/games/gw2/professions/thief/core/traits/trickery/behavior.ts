import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { activeStackCount, grantTimedStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { isFlatLifeStealPacket } from '#gw2/platform/effects/packet-builders.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { readProfessionCoreState } from '#gw2/platform/profession-definition/state.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { buildThiefBuff } from '#gw2/professions/thief/core/events.js';
import { setThiefKneeling } from '#gw2/professions/thief/core/mechanics/resources.js';
import type { ThiefCoreState } from '#gw2/professions/thief/core/state.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import type { ThiefResolverContext, ThiefResolverEvent, ThiefSkill } from '#gw2/professions/thief/types.js';

/** Apply siphon-specific bonuses at impact because flat life steal bypasses ordinary strike modifiers. */
export function modifyThiefLifeSiphon(context: ThiefResolverContext, event: ThiefResolverEvent) {
  if (!isFlatLifeStealPacket(event) || !isGw2PlayerModifierOwnedEvent(event)) return;
  let multiplier = event.flatStrikeMultiplier ?? 1;
  // Vampiric Slash samples live Vulnerability for its siphon only, independently of the packet's label.
  if (
    event.metadata?.packetKind === 'thief.vampiric-slash-life-siphon' &&
    context.combat.targetHasCondition('Vulnerability', event.at)
  )
    multiplier *= 1.5;

  if (hasTrait(context.traits, TRAIT.LEAD_ATTACKS)) {
    const state = readProfessionCoreState<ThiefCoreState>(context.profession);
    const leadAttacksProfile = requireBalanceProfileFromContext(context, TRAIT.LEAD_ATTACKS);
    // Stacks expire individually, so the siphon counts those active at its own impact.
    const stacks = Math.min(
      balanceProfileNumber(leadAttacksProfile, 'maximumStacks'),
      activeStackCount(state.leadAttackExpirations || [], event.at)
    );
    multiplier *= 1 + stacks * balanceProfileNumber(leadAttacksProfile, 'damageIncreasePerStack');
  }

  return { flatStrikeMultiplier: multiplier };
}

/** Initiative spent grants Lead Attacks stacks at completion, replacing the oldest at the cap. */
export function applyLeadAttacks(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const skill = cast.skill;
  const cost = Math.max(0, skill.initiativeCost || 0);
  if (cost <= 0 || !hasTrait(runtime, TRAIT.LEAD_ATTACKS)) return;
  const core = runtime.profession.core;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.LEAD_ATTACKS);
  const maximumStacks = balanceProfileNumber(profile, 'maximumStacks');
  const duration = balanceProfileNumber(profile, 'durationMultiplier');
  // A patched fractional cost grants a whole stack for its remainder, so round up before the integer boundary.
  core.leadAttackExpirations = grantTimedStacks(core.leadAttackExpirations, {
    at: runtime.time,
    expiresAt: runtime.time + duration,
    count: Math.ceil(cost),
    maximumStacks,
    retain: 'newest-grant'
  });
  runtime.effects.emit({
    kind: 'packet',
    event: buildThiefBuff(skill, {
      at: runtime.time,
      source: 'Trait',
      sourceId: TRAIT.LEAD_ATTACKS,
      activationId: cast.id,
      kind: 'lead-attacks',
      duration,
      stacks: Math.min(cost, maximumStacks)
    })
  });
}

/** Swapping weapons stands up; Quick Pockets grants in-combat initiative once per its cooldown. */
export function completeThiefWeaponSwap(runtime: ThiefRuntime): void {
  setThiefKneeling(runtime, false);
  if (
    !runtime.combatStartedAt() ||
    !hasTrait(runtime, TRAIT.QUICK_POCKETS) ||
    !runtime.procs.claim(TRAIT.QUICK_POCKETS, 'thief.core.quickPockets', runtime.time)
  )
    return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.QUICK_POCKETS);
  const initiativeGain = balanceProfileNumber(profile, 'resourceGain');
  if (initiativeGain > 0) runtime.resourceController.grant('initiative', initiativeGain);
}

/** Uncatchable's caltrop pulses are queued from the dodge's takeoff; the runtime has already paid its endurance. */
export function startThiefDodge(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  if (!hasTrait(runtime, TRAIT.UNCATCHABLE)) return;
  // Each condition's authored timing is authoritative; removing one component leaves its sibling's pulses intact.
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.UNCATCHABLE);
  const caltrops = runtime.helpers.skillsById.get(ID.LESSER_CALTROPS);
  runtime.effects.emit({
    kind: 'profile',
    profile: profile,
    effects: profile.effects?.filter(
      (effect) => effect.type === 'condition' && ['Bleeding', 'Crippled'].includes(String(effect.name))
    ),
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.UNCATCHABLE,
      actorType: 'player',
      skillId: ID.LESSER_CALTROPS,
      skillName: 'Lesser Caltrops',
      triggeredBy: cast.skill.name,
      activationId: cast.id
    },
    transform: (event) => ({ ...event, icon: caltrops?.icon, name: 'Uncatchable \u2014 Lesser Caltrops' })
  });
}
