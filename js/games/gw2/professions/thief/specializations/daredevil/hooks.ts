import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { consumeSkillFlip, skillFlipReady } from '#gw2/platform/engine/skills/skill-flips.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import { castWasInterrupted } from '#gw2/platform/skills/timing.js';
import { emitEffects } from '#gw2/platform/simulation/procedural-emission.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { deferThiefCompletion, emitThiefBuff } from '#gw2/professions/thief/core/events.js';
import { grantThiefEndurance, thiefEndurance } from '#gw2/professions/thief/core/mechanics/resources.js';
import { daredevilState } from '#gw2/professions/thief/specializations/daredevil/state.js';
import { DAREDEVIL_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/daredevil/profiles.js';
import type { BalanceProfile, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { ThiefDodge, ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';

const DAREDEVIL_COMPLETE = 'thief.daredevil-complete';

// The dodge choice retains trait attribution while its balance profile owns every emitted packet.
const DODGE_PROFILES: Readonly<Partial<Record<ThiefDodge, SkillId>>> = Object.freeze({
  'Bounding Dodger': PROFILE.boundingDodger,
  'Lotus Training': PROFILE.lotusTraining,
  'Unhindered Combatant': PROFILE.unhinderedCombatant
});

function selectedDodgeProfile(runtime: ThiefRuntime): BalanceProfile | undefined {
  const profileId = DODGE_PROFILES[daredevilState.from(runtime).selectedDodge];
  return profileId == null ? undefined : requireBalanceProfileFromContext(runtime, profileId);
}

/** Dodge packets use the in-game skill name of the selected dodge. */
function dodgeSkillName(runtime: ThiefRuntime): string {
  const selected = daredevilState.from(runtime).selectedDodge;
  return selected === 'Bounding Dodger' ? 'Bound' : selected === 'Lotus Training' ? 'Impaling Lotus' : selected;
}

/**
 * A committed dodge queues its selected profile's packets at acceptance, at their authored offsets or at completion,
 * so a strike before the dodge finishes still lands at its own instant.
 */
function queueDodgePackets(runtime: ThiefRuntime, cast: RuntimeCast): void {
  const profile = selectedDodgeProfile(runtime);
  if (!profile) return;
  const skill = cast.skill as ThiefSkill;
  const name = dodgeSkillName(runtime);
  emitEffects(runtime, {
    owner: profile,
    // Dodge offsets default to acceptance; effects without offsets still land at completion.
    effects: profile.effects?.map((effect) => ({ timingAnchor: 'castStart', ...effect })),
    at: cast.start,
    fullEnd: cast.effectiveEnd,
    skillWeaponFallback: 'Unequipped',
    baseEvent: (effect) => ({
      source: effect.type === 'strike' ? 'thief' : 'Trait',
      sourceId: profile.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: name,
      activationId: cast.id
    }),
    transform: (event, effect) => ({
      ...event,
      icon: runtime.helpers.skillsByName.get(name)?.icon,
      name:
        effect.type === 'condition'
          ? `${name} — ${effect.condition}`
          : effect.type === 'boon'
            ? `${name} — ${effect.boon}`
            : name
    })
  });
}

/**
 * A committed dodge opens its damage window after the dodge's own same-instant packets, so its landing strike (Bound)
 * resolves before the window it grants.
 */
function openDodgeWindow(runtime: ThiefRuntime, cast: RuntimeCast): void {
  const state = daredevilState.from(runtime);
  const profile = selectedDodgeProfile(runtime);
  if (profile && state.selectedDodge === 'Bounding Dodger')
    state.boundingDamageUntil = runtime.time + balanceProfileNumber(profile, 'durationMultiplier');
  if (profile && state.selectedDodge === 'Lotus Training') {
    const duration = balanceProfileNumber(profile, 'durationMultiplier');
    state.lotusConditionDamageUntil = runtime.time + duration;
    // Expose the same timed window used by damage modifiers as a visible buff.
    emitThiefBuff(runtime, cast.skill, {
      at: runtime.time,
      source: 'Trait',
      sourceId: TRAIT.LOTUS_TRAINING,
      activationId: cast.id,
      kind: 'lotus-training',
      duration
    });
  }
}

/** After the dodge's own packets, the dodge opens its window and Weakening Strikes arms the next landed strike. */
function completeDaredevilDodge(runtime: ThiefRuntime, cast: RuntimeCast): void {
  const state = daredevilState.from(runtime);
  const skill = cast.skill as ThiefSkill;
  openDodgeWindow(runtime, cast);
  if (!hasTrait(runtime, TRAIT.WEAKENING_STRIKES)) return;
  const weakening = requireBalanceProfileFromContext(runtime, PROFILE.weakeningStrikes);
  // A removed Weakness cannot arm a pending grant.
  if (!requireEffect(weakening, 'condition', 'Weakness')) return;
  const duration = balanceProfileNumber(weakening, 'durationMultiplier');
  state.weakeningStrikeReady = true;
  state.weakeningStrikeExpiresAt = runtime.time + duration;
  emitThiefBuff(runtime, skill, {
    at: runtime.time,
    source: 'Trait',
    sourceId: TRAIT.WEAKENING_STRIKES,
    activationId: cast.id,
    kind: 'weakening-strikes',
    duration
  });
}

/** A completed, on-target Fist Flurry opens Palm Strike; Palm Strike closes its window. */
function updatePalmStrike(runtime: ThiefRuntime, cast: RuntimeCast): void {
  const flips = runtime.profession.core.availableFlips;
  if (cast.skill.id === ID.FIST_FLURRY) {
    if (cast.command.offTarget === true || castWasInterrupted(cast)) return;
    runtime.armFlip(ID.PALM_STRIKE, {
      availableAt: runtime.time,
      expiresAt:
        runtime.time +
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.palmStrike), 'durationMultiplier')
    });
  } else if (cast.skill.id === ID.PALM_STRIKE) consumeSkillFlip(flips, ID.PALM_STRIKE);
}

/** The armed grant is consumed by the next landed player strike, never by a cast or condition tick. */
function weakeningStrike(runtime: ThiefRuntime, event: Gw2ResolverEvent): void {
  const state = daredevilState.from(runtime);
  if (
    !state.weakeningStrikeReady ||
    state.weakeningStrikeExpiresAt <= event.at ||
    event.actorType !== 'player' ||
    !(Number(event.coefficient) > 0) ||
    event.skillId === SHARED_SKILL_IDS.DODGE
  )
    return;
  state.weakeningStrikeReady = false;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.weakeningStrikes);
  const weakness = requireEffect(profile, 'condition', 'Weakness');
  // Explicit removal suppresses this packet without restoring baseline tuning.
  if (!weakness) return;
  runtime.applyCondition(
    buildResolverCondition({
      at: event.at,
      source: 'Trait',
      actorType: 'player',
      skillId: TRAIT.WEAKENING_STRIKES,
      skillName: 'Weakening Strikes',
      activationId: event.activationId,
      triggeredBy: event.skillName,
      condition: String(weakness.condition),
      duration: effectNumber(profile, weakness, 'duration'),
      stacks: effectNumber(profile, weakness, 'stacks'),
      sourceId: TRAIT.WEAKENING_STRIKES,
      name: 'Weakening Strikes — Weakness'
    })
  );
}

function completeDaredevilCast(runtime: ThiefRuntime, cast: RuntimeCast): void {
  if (cast.skill.id === SHARED_SKILL_IDS.DODGE) completeDaredevilDodge(runtime, cast);
  updatePalmStrike(runtime, cast);
  // Endurance Thief follows Core's steal resources.
  if (cast.skill.id === ID.STEAL && hasTrait(runtime, TRAIT.ENDURANCE_THIEF))
    grantThiefEndurance(
      runtime,
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.enduranceThief), 'resourceGain')
    );
}

/** Daredevil hooks: the larger endurance pool, selected dodges, trait refunds, and Palm Strike. */
export const daredevilHooks: Partial<RuntimeProfession<ThiefRuntimeState>> = {
  // Daredevil replaces only the capacity while retaining Core's pool and regeneration.
  endurance: {
    ...thiefEndurance,
    maximum: (runtime) =>
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'maximumStacks')
  },
  availability(runtime, skill) {
    if (
      skill.id !== ID.PALM_STRIKE ||
      skillFlipReady(runtime.profession.core.availableFlips[ID.PALM_STRIKE], runtime.time)
    )
      return { ready: true };
    // No timer can open the window; only a connecting Fist Flurry does.
    return {
      ready: false,
      retryAt: null,
      code: 'thief.palm-strike',
      reason: 'Palm Strike is unavailable — Fist Flurry must connect first.'
    };
  },
  onCastStart(runtime, cast) {
    const skill = cast.skill as ThiefSkill;
    const cost = skill.initiativeCost || 0;
    // Staff Master refunds endurance per initiative spent on staff skills.
    if (cost > 0 && skill.weapon === 'Staff' && hasTrait(runtime, TRAIT.STAFF_MASTER))
      grantThiefEndurance(
        runtime,
        cost * balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.staffMaster), 'resourceGain')
      );
    if (skill.id === SHARED_SKILL_IDS.DODGE && !cast.cancelled) queueDodgePackets(runtime, cast);
  },
  onCastCommit(runtime, cast) {
    deferThiefCompletion(runtime, DAREDEVIL_COMPLETE, cast);
  },
  reactions: {
    'damage.resolved': weakeningStrike
  },
  tasks: {
    [DAREDEVIL_COMPLETE](runtime, data) {
      const { cast } = data as { cast: RuntimeCast };
      completeDaredevilCast(runtime, cast);
    }
  }
};
