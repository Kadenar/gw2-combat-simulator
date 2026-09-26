import { canonicalTime } from '#kernel/core/clock.js';
import { criticalOpportunity } from '#gw2/platform/combat/critical-procs.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { consumeSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { castWasInterrupted } from '#gw2/platform/skills/timing.js';
import { boundedNumber } from '#kernel/core/numeric.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import {
  armThiefFlip,
  deferThiefCompletion,
  emitThiefBuff,
  emitThiefCondition,
  takeThiefCompletion,
  thiefCastCommitted
} from '#gw2/professions/thief/core/events.js';
import { grantThiefEndurance, grantThiefInitiative } from '#gw2/professions/thief/core/mechanics/resources.js';
import { grantThiefStealth } from '#gw2/professions/thief/core/mechanics/stealth.js';
import {
  completeThiefSteal,
  consumeThiefStolenSkill,
  emitThiefStealTraits,
  storeThiefStolenSkillChoices
} from '#gw2/professions/thief/core/mechanics/steal.js';
import { deadeyeCastAvailability } from '#gw2/professions/thief/specializations/deadeye/mechanics/availability.js';
import { deadeyeState } from '#gw2/professions/thief/specializations/deadeye/state.js';
import { DEADEYE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/deadeye/profiles.js';
import type { SkillEffect, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { Gw2HitResolutionContext } from '#gw2/platform/resolver/hit-resolution.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { DEADEYE_STOLEN_SKILL_IDS } from '#gw2/professions/thief/specializations/deadeye/mechanics/stolen-skills.js';

const DEADEYE_COMPLETE = 'thief.deadeye-complete';
const DEADEYE_MARK_EXPIRY = 'thief.deadeye-mark-expire';

const STOLEN_SKILLS = new Set<SkillId>(DEADEYE_STOLEN_SKILL_IDS);

/** Acceptance facts: malice before consumption and whether a stolen skill will grant stealth. */
interface DeadeyeCastFacts {
  readonly malice: number;
  readonly markedMalice: number;
  readonly grantsStealth: boolean;
}

const castFacts = new WeakMap<RuntimeCast, DeadeyeCastFacts>();
// A malicious attack's damage bonus uses the malice it was cast with, even after its first hit spends it.
const maliceSnapshots = new WeakMap<object, Map<string, number>>();

function marked(runtime: ThiefRuntime, at = runtime.time): boolean {
  const state = deadeyeState.from(runtime);
  return Boolean(state.markedTargetId) && state.markExpiresAt > at;
}

/** Fire for Effect replaces Deadeye's stolen-skill choice pool with Steal Time. */
function stolenSkillGrant(runtime: ThiefRuntime): { skillIds: readonly SkillId[]; forcedSkillId: SkillId | null } {
  return hasTrait(runtime, TRAIT.FIRE_FOR_EFFECT)
    ? { skillIds: [ID.STEAL_TIME], forcedSkillId: ID.STEAL_TIME }
    : { skillIds: DEADEYE_STOLEN_SKILL_IDS, forcedSkillId: null };
}

/** Emits a Deadeye trait boon package attributed to its trait source and triggering skill. */
function traitBoons(
  runtime: ThiefRuntime,
  cast: RuntimeCast | null,
  source: string,
  profileId: SkillId,
  party: boolean
): void {
  const profile = requireBalanceProfileFromContext(runtime, profileId);
  for (const effect of (profile.effects || []).filter((entry) => entry.type === 'boon')) {
    const boon = String(effect.boon);
    emitThiefBuff(runtime, null, {
      at: runtime.time,
      source: 'Trait',
      sourceId: `thief.deadeye.${source.toLowerCase().replaceAll(' ', '-')}`,
      skillId: cast?.skill.id ?? null,
      skillName: cast?.skill.name ?? null,
      ...(cast ? { activationId: cast.id } : {}),
      name: `${source} — ${boon}`,
      kind: boon.toLowerCase(),
      boon,
      duration: effectNumber(profile, effect, 'duration'),
      stacks: effectNumber(profile, effect, 'stacks'),
      ...(party ? { audience: { recipients: 'party' as const, maximumRecipients: 5 } } : {})
    });
  }
}

/** Reaching maximum malice grants Maleficent Seven's initiative and boons once per malice cycle. */
function maleficentSeven(runtime: ThiefRuntime, cast: RuntimeCast | null): void {
  const state = deadeyeState.from(runtime);
  if (
    state.malice !== state.maximumMalice ||
    state.maleficentSevenTriggered ||
    !hasTrait(runtime, TRAIT.MALEFICENT_SEVEN)
  )
    return;
  state.maleficentSevenTriggered = true;
  grantThiefInitiative(
    runtime,
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.maleficentSeven), 'resourceGain')
  );
  traitBoons(runtime, cast, 'Maleficent Seven', PROFILE.maleficentSeven, false);
}

/** Malicious Intent seeds a fresh mark (and each spent cycle) with its starting malice. */
function initialMalice(runtime: ThiefRuntime): number {
  return hasTrait(runtime, TRAIT.MALICIOUS_INTENT)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.maliciousIntent), 'resourceGain')
    : 0;
}

/**
 * Marking a target refreshes the mark; re-marking the same live target adds to its malice instead of resetting it.
 * The mark also grants Deadeye's stolen skills and schedules its own expiry.
 */
function completeDeadeyesMark(runtime: ThiefRuntime, cast: RuntimeCast): void {
  const state = deadeyeState.from(runtime);
  emitThiefStealTraits(runtime, cast);
  const remarking = state.markedTargetId === 'primary-target' && state.markExpiresAt > runtime.time;
  state.markedTargetId = 'primary-target';
  state.markExpiresAt = canonicalTime(
    runtime.time +
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'durationMultiplier')
  );
  state.markGeneration += 1;
  state.malice = remarking
    ? Math.min(state.maximumMalice, state.malice + initialMalice(runtime))
    : initialMalice(runtime);
  if (!remarking) state.maleficentSevenTriggered = false;
  maleficentSeven(runtime, cast);
  const grant = stolenSkillGrant(runtime);
  completeThiefSteal(runtime, grant.skillIds, grant.forcedSkillId);
  if (hasTrait(runtime, TRAIT.BE_QUICK_OR_BE_KILLED)) {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.beQuickOrBeKilled);
    const quickness = requireEffect(profile, 'boon', 'Quickness');
    if (quickness)
      emitThiefBuff(runtime, null, {
        at: runtime.time,
        source: 'Trait',
        sourceId: 'thief.deadeye.be-quick-or-be-killed',
        skillId: cast.skill.id,
        skillName: cast.skill.name,
        activationId: cast.id,
        name: `Be Quick or Be Killed — ${quickness.boon}`,
        kind: String(quickness.boon).toLowerCase(),
        boon: String(quickness.boon),
        duration: effectNumber(profile, quickness, 'duration'),
        stacks: effectNumber(profile, quickness, 'stacks')
      });
  }

  runtime.schedule(DEADEYE_MARK_EXPIRY, state.markExpiresAt, { generation: state.markGeneration });
}

/** Mark expiry resets malice; a stale expiry from an earlier mark is ignored. */
function expireDeadeyesMark(runtime: ThiefRuntime, data: unknown): void {
  const state = deadeyeState.from(runtime);
  if ((data as { generation: number }).generation !== state.markGeneration || runtime.time < state.markExpiresAt)
    return;
  state.markedTargetId = null;
  state.markExpiresAt = 0;
  state.malice = 0;
  state.maleficentSevenTriggered = false;
}

/** Scales a malice-dependent authored packet selected at acceptance. */
function maliciousEffects(runtime: ThiefRuntime, cast: RuntimeCast, effects: readonly SkillEffect[]) {
  const facts = castFacts.get(cast);
  const skill = cast.skill as ThiefSkill;
  if (!facts) return effects;
  if (STOLEN_SKILLS.has(skill.id))
    return effects.flatMap((effect): SkillEffect[] => {
      // Below three malice a stolen skill's own stealth grant is suppressed.
      if (effect.type === 'buff' && effect.kind === 'stealth' && !facts.grantsStealth) return [];
      // Stolen skill boons are shared with the party.
      if (effect.type === 'boon') return [{ ...effect, audience: { recipients: 'party', maximumRecipients: 5 } }];
      return [effect];
    });
  const malice = facts.markedMalice;
  return effects.flatMap((effect): SkillEffect[] => {
    // Malice lengthens the Poison whether it is authored on the effect or on its timed ticks.
    if (
      effect.type === 'condition' &&
      (skill.id === ID.MALICIOUS_CUNNING_SALVO || skill.id === ID.MALICIOUS_SHADOWSQUALL)
    ) {
      const scaled = (duration: unknown) =>
        skill.id === ID.MALICIOUS_CUNNING_SALVO
          ? Number(duration || 0) + malice
          : Number(duration || 0) * (1 + 0.2 * malice);
      if (effect.ticks?.length)
        return [
          {
            ...effect,
            ticks: effect.ticks.map((tick) =>
              tick.condition === 'Poisoned' ? { ...tick, duration: scaled(tick.duration) } : tick
            )
          }
        ];
      if (effect.condition === 'Poisoned') return [{ ...effect, duration: scaled(effect.duration) }];
    }

    const quickness =
      (effect.type === 'boon' && String(effect.boon).toLowerCase() === 'quickness') ||
      (effect.type === 'buff' && effect.kind === 'quickness');
    if (skill.id === ID.MALICIOUS_HOOK_STRIKE && quickness)
      return malice > 0 ? [{ ...effect, duration: Number(effect.duration || 0) * malice }] : [];
    if (
      skill.id === ID.MALICIOUS_ASHEN_ASSAULT &&
      effect.type === 'strike' &&
      effect.name === 'Malicious Ashen Assault — Final Strike'
    ) {
      const factor =
        1 +
        facts.malice *
          balanceProfileNumber(
            requireBalanceProfileFromContext(runtime, PROFILE.maliciousAshenAssault),
            'coefficientMultiplier'
          );
      return [
        effect.ticks?.length
          ? {
              ...effect,
              ticks: effect.ticks.map((tick) => ({ ...tick, coefficient: Number(tick.coefficient) * factor }))
            }
          : { ...effect, coefficient: Number(effect.coefficient || 0) * factor }
      ];
    }

    return [effect];
  });
}

/** Torment from a malicious finisher scales with the malice it was cast with. */
function maliceTorment(runtime: ThiefRuntime, cast: RuntimeCast, profileId: SkillId, malice: number, trait: boolean) {
  const profile = requireBalanceProfileFromContext(runtime, profileId);
  const torment = requireEffect(profile, 'condition', 'Torment');
  if (!torment) return;
  emitThiefCondition(runtime, cast.skill as ThiefSkill, {
    at: runtime.time,
    ...(trait ? { source: 'Trait', name: 'Malicious Ashen Assault — Torment' } : {}),
    activationId: cast.id,
    condition: String(torment.condition),
    duration: effectNumber(profile, torment, 'duration') + malice * balanceProfileNumber(profile, 'durationMultiplier'),
    stacks: effectNumber(profile, torment, 'stacks')
  });
}

/** Deadeye completion transitions in their established order after Core's. */
function completeDeadeyeCast(runtime: ThiefRuntime, cast: RuntimeCast): void {
  const skill = cast.skill as ThiefSkill;
  const state = deadeyeState.from(runtime);
  const facts = castFacts.get(cast);
  castFacts.delete(cast);
  const committed = thiefCastCommitted(cast);
  if (committed) {
    if (skill.id === ID.DEADEYES_MARK) completeDeadeyesMark(runtime, cast);
    else if (skill.id === ID.MALICIOUS_SNEAK_ATTACK && !castWasInterrupted(cast))
      maliceTorment(runtime, cast, PROFILE.maliciousSneakAttack, facts?.malice ?? 0, false);
    else if (skill.id === ID.MALICIOUS_ASHEN_ASSAULT) {
      grantThiefInitiative(
        runtime,
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.maliciousAshenAssault), 'resourceGain')
      );
      if ((facts?.malice ?? 0) > 0)
        maliceTorment(runtime, cast, PROFILE.maliciousAshenAssault, facts?.malice ?? 0, true);
    } else if (STOLEN_SKILLS.has(skill.id)) {
      if (facts?.grantsStealth) grantThiefStealth(runtime, skill, 3);
      consumeThiefStolenSkill(runtime, skill);
      if (hasTrait(runtime, TRAIT.FIRE_FOR_EFFECT))
        traitBoons(runtime, cast, 'Fire for Effect', PROFILE.fireForEffect, true);
    } else if (skill.id === ID.MERCY) {
      const malice = Math.max(0, Number(state.malice || 0));
      state.malice = 0;
      state.maleficentSevenTriggered = false;
      // Mercy resets Deadeye's Mark and refunds initiative per malice spent.
      runtime.cooldownController.clear(ID.DEADEYES_MARK);
      const mercy = requireBalanceProfileFromContext(runtime, PROFILE.mercy);
      grantThiefInitiative(
        runtime,
        balanceProfileNumber(mercy, 'resourceGain') + malice * balanceProfileNumber(mercy, 'attributePerStack')
      );
    } else if (skill.id === ID.SHADOW_FLARE)
      armThiefFlip(
        runtime,
        ID.SHADOW_SWAP,
        runtime.time,
        runtime.time +
          balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.shadowFlare), 'durationMultiplier')
      );
    else if (skill.id === ID.SHADOW_SWAP) consumeSkillFlip(runtime.profession.core.availableFlips, ID.SHADOW_SWAP);
  }

  // Silent Scope: a dodge above the malice threshold grants one out-of-stealth stealth attack.
  if (skill.id === ID.DODGE && hasTrait(runtime, TRAIT.SILENT_SCOPE)) {
    const silentScope = requireBalanceProfileFromContext(runtime, PROFILE.silentScope);
    if (state.malice > balanceProfileNumber(silentScope, 'threshold')) {
      state.stealthAttackCharges = 1;
      state.stealthAttackExpiresAt = runtime.time + balanceProfileNumber(silentScope, 'durationMultiplier');
    }
  }

  if (!(skill.categories || []).includes('Cantrip')) return;
  if (runtime.config.relic === 'Deadeye') {
    state.deadeyeRelicUntil = runtime.time + 8;
    runtime.emit({
      type: 'proc',
      procType: 'relic',
      at: runtime.time,
      source: 'Relic',
      sourceId: 'relic.deadeye',
      actorType: 'effect',
      name: 'Relic of the Deadeye',
      sourceSkill: skill.name,
      duration: 8,
      detail: 'activated'
    });
  }

  // One in the Chamber refreshes the stolen skill on every cantrip, replacing any stored choice.
  if (hasTrait(runtime, TRAIT.ONE_IN_THE_CHAMBER)) {
    const grant = stolenSkillGrant(runtime);
    storeThiefStolenSkillChoices(runtime, grant.skillIds, grant.forcedSkillId);
  }
}

/**
 * The first landed strike of a marked activation resolves malice once: a malicious attack spends it (Tactical Strike
 * refunds endurance first), while an initiative attack gains malice plus a bonus for each critical hit.
 */
function reactDeadeyeMalice(runtime: ThiefRuntime, event: Gw2ResolverEvent, hit?: Gw2HitResolutionContext): void {
  if (event.actorType !== 'player' || !(Number(event.coefficient) > 0) || typeof event.activationId !== 'string')
    return;
  if (event.offTarget === true || !marked(runtime)) return;
  const skill = runtime.helpers.skillsById.get(Number(event.skillId ?? event.sourceId)) as ThiefSkill | undefined;
  if (!skill) return;
  const initiativeAttack = skill.type === 'Weapon' && Number(skill.initiativeCost || 0) > 0 && !skill.stealthAttack;
  if (!skill.malicious && !initiativeAttack) return;
  const state = deadeyeState.from(runtime);
  if (state.maliceResolvedActivations[event.activationId]) return;
  state.maliceResolvedActivations[event.activationId] = true;
  if (skill.malicious) {
    if (skill.id === ID.MALICIOUS_TACTICAL_STRIKE)
      grantThiefEndurance(runtime, Number(event.deadeyeMaliceSnapshot || 0) * 10);
    state.malice = 0;
    state.maleficentSevenTriggered = false;
    if (hasTrait(runtime, TRAIT.MALICIOUS_INTENT)) {
      state.malice = Math.min(
        state.maximumMalice,
        state.malice +
          balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.maliciousIntent), 'resourceGain')
      );
      maleficentSeven(runtime, null);
    }

    return;
  }

  const criticals = hit
    ? criticalOpportunity(hit.critEligible ? hit.critical.chance : 0, hit.critical.didCrit).sampledCriticals
    : 0;
  const resources = requireBalanceProfileFromContext(runtime, PROFILE.resources);
  state.malice = Math.min(
    state.maximumMalice,
    state.malice +
      balanceProfileNumber(resources, 'resourceGain') +
      criticals * balanceProfileNumber(resources, 'playerStacks')
  );
  maleficentSeven(runtime, null);
}

/** Deadeye hooks: the mark and malice, malicious attacks, stolen skills, Mercy, Shadow Flare, and cantrip traits. */
export const deadeyeHooks: Partial<RuntimeProfession<ThiefRuntimeState>> = {
  initialize(runtime) {
    const state = deadeyeState.from(runtime);
    const resources = requireBalanceProfileFromContext(runtime, PROFILE.resources);
    state.maximumMalice = balanceProfileNumber(
      resources,
      hasTrait(runtime, TRAIT.MALEFICENT_SEVEN) ? 'minimumStacks' : 'maximumStacks'
    );
    state.malice = Math.min(state.malice, state.maximumMalice);
  },
  availability: (runtime, skill) =>
    deadeyeCastAvailability(runtime.profession.core.availableFlips, skill as ThiefSkill, runtime.time),
  onCastStart(runtime, cast) {
    const skill = cast.skill as ThiefSkill;
    const state = deadeyeState.from(runtime);
    const core = runtime.profession.core;
    // Shadow Meld ends Revealed at its start so stealth can apply immediately.
    if (skill.id === ID.SHADOW_MELD) core.revealedUntil = Math.min(core.revealedUntil, runtime.time);
    if (!skill.malicious && !STOLEN_SKILLS.has(skill.id)) return;
    const malice = boundedNumber(state.malice, 0, 0, state.maximumMalice);
    castFacts.set(cast, {
      malice,
      // Poison, quickness, and duration scaling apply only against a live mark and a hit target.
      markedMalice: cast.command.offTarget !== true && marked(runtime) ? malice : 0,
      grantsStealth: state.malice >= 3
    });
    if (skill.malicious) {
      let snapshots = maliceSnapshots.get(runtime);
      if (!snapshots) maliceSnapshots.set(runtime, (snapshots = new Map()));
      snapshots.set(cast.id, malice);
    }
  },
  modifyEffects: maliciousEffects,
  onCastComplete(runtime, cast) {
    deferThiefCompletion(runtime, DEADEYE_COMPLETE, cast);
  },
  reactions: {
    'damage.resolving'(runtime, event) {
      const snapshot = maliceSnapshots.get(runtime)?.get(String(event.activationId));
      return snapshot == null ? undefined : { deadeyeMaliceSnapshot: snapshot };
    },
    'damage.resolved'(runtime, event, details) {
      reactDeadeyeMalice(runtime, event, (details as { hitContext?: Gw2HitResolutionContext }).hitContext);
    }
  },
  tasks: {
    [DEADEYE_COMPLETE](runtime, data) {
      const cast = takeThiefCompletion(runtime, DEADEYE_COMPLETE, data);
      if (cast) completeDeadeyeCast(runtime, cast);
    },
    [DEADEYE_MARK_EXPIRY]: expireDeadeyesMark
  }
};
