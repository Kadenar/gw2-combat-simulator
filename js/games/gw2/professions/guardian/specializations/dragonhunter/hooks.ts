import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { armSkillFlip, consumeSkillFlip, expireSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2Runtime, RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import { projectCastRelativeEffectTimingMs } from '#gw2/platform/skills/timing.js';
import { guardianVirtueForSlot, refreshGuardianVirtues } from '#gw2/professions/guardian/core/mechanics/virtues.js';
import {
  applyGuardianVirtueActivationTraits,
  emitGuardianBoon,
  indomitableCourageInterval,
  triggerGuardianFuriousFocus
} from '#gw2/professions/guardian/core/traits/behavior.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { reactToDragonhunterJusticeHit } from '#gw2/professions/guardian/specializations/dragonhunter/mechanics/virtue-effects.js';
import { DRAGONHUNTER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/dragonhunter/profiles.js';
import { dragonhunterState } from '#gw2/professions/guardian/specializations/dragonhunter/state.js';
import {
  bigGameHunterTetherDuration,
  completeHuntersDetermination,
  reactToDragonhunterControl
} from '#gw2/professions/guardian/specializations/dragonhunter/traits/behavior.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

type Runtime = Gw2Runtime<GuardianRuntimeState, GuardianSkill>;
const readyVirtues = new WeakSet<RuntimeCast<GuardianSkill>>();
const COURAGE = 'guardian.dragonhunter.courage';
const FURIOUS = 'guardian.dragonhunter.furious-focus';
const TETHER = 'guardian.dragonhunter.tether';
const BURN = 'guardian.dragonhunter.tether-burn';
const EXPIRY = 'guardian.dragonhunter.tether-expiry';

/** One recurring wake preserves Courage's cadence while actual recharge suppresses individual pulses. */
function couragePulse(runtime: Runtime): void {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.passiveCourage);
  const interval = indomitableCourageInterval(runtime, profile);
  const effect = requireEffect(profile, 'boon', 'aegis');
  if (!(interval > 0) || !effect) return;
  refreshGuardianVirtues(runtime);
  if (runtime.profession.core.virtueReadyAt.courage <= runtime.time) {
    const skill = runtime.helpers.skillsById.get(ID.SHIELD_OF_COURAGE)!;
    emitGuardianBoon(runtime, {
      type: 'buff',
      at: runtime.time,
      source: 'guardian',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Shield of Courage — Passive Aegis',
      kind: 'aegis',
      duration: effectNumber(profile, effect, 'duration'),
      stacks: effectNumber(profile, effect, 'stacks')
    });
  }

  runtime.schedule(COURAGE, canonicalTime(runtime.time + interval), undefined, undefined, -200);
}

/** A landed spear attaches after commitment; failed hostile outcomes cannot arm the follow-up or create burning. */
function attachTether(runtime: Runtime, data: unknown): void {
  if (runtime.deathTime != null) return;
  const event = data as Gw2ResolverEvent;
  const state = dragonhunterState.from(runtime);
  if (state.tetherActivationId === event.activationId) return;
  const duration = bigGameHunterTetherDuration(runtime, 6);
  if (!(duration > 0)) return;
  state.tetherActivationId = event.activationId ?? null;
  state.tetherUntil = canonicalTime(runtime.time + duration);
  const window = armSkillFlip(
    runtime.profession.core.availableFlips,
    ID.HUNTERS_VERDICT,
    runtime.time,
    state.tetherUntil
  );
  runtime.schedule(EXPIRY, state.tetherUntil, { identity: window.identity }, undefined, -220);
  runtime.schedule(BURN, runtime.time, { event, activationId: state.tetherActivationId, deadline: state.tetherUntil });
}

/** Only the current tether schedules another pulse; replacing or breaking it invalidates already queued work. */
function tetherBurn(runtime: Runtime, data: unknown): void {
  const pulse = data as { event: Gw2ResolverEvent; activationId: string | null; deadline: number };
  const state = dragonhunterState.from(runtime);
  if (
    runtime.deathTime != null ||
    state.tetherActivationId !== pulse.activationId ||
    state.tetherUntil !== pulse.deadline ||
    runtime.time >= pulse.deadline
  )
    return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.tether);
  const effect = requireEffect(profile, 'condition', 'Burning');
  if (!effect) return;
  runtime.emitDerived(
    pulse.event,
    buildResolverCondition({
      at: runtime.time,
      source: 'guardian',
      sourceId: ID.SPEAR_OF_JUSTICE,
      actorType: 'player',
      skillId: ID.SPEAR_OF_JUSTICE,
      skillName: 'Spear of Justice',
      name: 'Spear of Justice — Active Burning',
      condition: String(effect.condition),
      stacks: effectNumber(profile, effect, 'stacks'),
      duration: effectNumber(profile, effect, 'duration')
    })
  );
  const interval = balanceProfileNumber(profile, 'pulseInterval');
  const next = canonicalTime(runtime.time + interval);
  if (interval > 0 && next < pulse.deadline) runtime.schedule(BURN, next, data);
}

/** Dragonhunter owns its landed tether, passive cadence, and committed trap/virtue effects without replay records. */
export const dragonhunterHooks: Partial<RuntimeProfession<GuardianRuntimeState, GuardianSkill>> = {
  sideEffectHandlers: {
    // Breaking a tether retires its follow-up without touching parent recharge.
    'guardian.break-tether'(runtime) {
      dragonhunterState.from(runtime).tetherUntil = 0;
      consumeSkillFlip(runtime.profession.core.availableFlips, ID.HUNTERS_VERDICT);
    },
    'guardian.attach-tether'(runtime, context) {
      if (context.kind !== 'effect') return;
      const event = context.trigger.event;
      const action = runtime.history.find(
        (candidate) => candidate.type === 'action' && candidate.activationId === event.activationId
      );
      if (!action) return;
      runtime.schedule(TETHER, Math.max(runtime.time, Number(action.endsAt)), event, undefined, -50);
    }
  },
  initialize(runtime) {
    runtime.schedule(COURAGE, runtime.time, undefined, undefined, -200);
  },
  onCastStart(runtime, cast) {
    if (!cast.skill.categories?.includes('Virtue')) return;
    const virtue = guardianVirtueForSlot(cast.skill.slot);
    if (!virtue) return;
    refreshGuardianVirtues(runtime);
    if (runtime.profession.core.virtueReadyAt[virtue] > runtime.time) return;
    readyVirtues.add(cast);
    if (cast.skill.id === ID.SPEAR_OF_JUSTICE && !cast.cancelled) {
      const at = canonicalTime(
        cast.start + projectCastRelativeEffectTimingMs(cast.skill, (cast.fullEnd - cast.start) * 1000, 480) / 1000
      );
      // Deferred attribution excludes the skill's executable reaction declarations.
      if (at <= cast.effectiveEnd)
        runtime.schedule(FURIOUS, at, { id: cast.id, skill: { id: cast.skill.id, name: cast.skill.name } });
    }
  },
  onCastCommit(runtime, cast) {
    const virtue = cast.skill.categories?.includes('Virtue') ? guardianVirtueForSlot(cast.skill.slot) : null;
    if (virtue) {
      refreshGuardianVirtues(runtime);
      if (readyVirtues.has(cast)) applyGuardianVirtueActivationTraits(runtime, cast, virtue);
    }

    completeHuntersDetermination(runtime, cast);
  },
  reactions: {
    'damage.resolved'(runtime, event, details) {
      refreshGuardianVirtues(runtime);
      const damage = details as NativeResolvedDamageDetails;
      if (!(Number(event.coefficient) > 0) || !(Number(damage.hitContext?.damage) > 0)) return;
      reactToDragonhunterJusticeHit(runtime, event, damage);
    },
    'control.resolved'(runtime, event) {
      if (event.actorType === 'player') reactToDragonhunterControl(runtime, event);
    }
  },
  tasks: {
    [COURAGE]: couragePulse,
    [FURIOUS]: (runtime, data) =>
      triggerGuardianFuriousFocus(runtime, data as Parameters<typeof triggerGuardianFuriousFocus>[1]),
    [TETHER]: attachTether,
    [BURN]: tetherBurn,
    [EXPIRY](runtime, data) {
      const { identity } = data as { identity: number | string };
      expireSkillFlip(runtime.profession.core.availableFlips, ID.HUNTERS_VERDICT, runtime.time, identity);
    }
  }
};
