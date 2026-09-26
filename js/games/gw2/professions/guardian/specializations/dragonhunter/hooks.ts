import { canonicalTime } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { armSkillFlip, consumeSkillFlip, expireSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { cancelledBeforeInterruptCommit } from '#gw2/platform/execution/effect-adapter.js';
import { gw2ActivePrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import { projectCastRelativeEffectTimingMs } from '#gw2/platform/skills/timing.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { guardianVirtueForSlot } from '#gw2/professions/guardian/core/mechanics/virtues.js';
import { applyGuardianVirtueActivationTraits, refreshGuardianVirtues } from '#gw2/professions/guardian/core/hooks.js';
import { emitGuardianBoon, triggerGuardianFuriousFocus } from '#gw2/professions/guardian/core/traits/index.js';
import { recordGuardianTraitProc } from '#gw2/professions/guardian/core/traits/shared.js';
import { dragonhunterState } from '#gw2/professions/guardian/specializations/dragonhunter/state.js';
import {
  reactToDragonhunterJusticeHit,
  reactToDragonhunterControl
} from '#gw2/professions/guardian/specializations/dragonhunter/mechanics/virtue-effects.js';
import { DRAGONHUNTER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/dragonhunter/profiles.js';
import type { Gw2Runtime, RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { GuardianRuntimeState } from '#gw2/professions/guardian/types.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';

type Runtime = Gw2Runtime<GuardianRuntimeState>;
const readyVirtues = new WeakSet<RuntimeCast>();
const COURAGE = 'guardian.dragonhunter.courage';
const FURIOUS = 'guardian.dragonhunter.furious-focus';
const TETHER = 'guardian.dragonhunter.tether';
const BURN = 'guardian.dragonhunter.tether-burn';
const EXPIRY = 'guardian.dragonhunter.tether-expiry';

/** One recurring wake preserves Courage's cadence while actual recharge suppresses individual pulses. */
function couragePulse(runtime: Runtime): void {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.passiveCourage);
  const interval = hasTrait(runtime, TRAIT.INDOMITABLE_COURAGE)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.INDOMITABLE_COURAGE), 'pulseInterval')
    : balanceProfileNumber(profile, 'pulseInterval');
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
  const duration = hasTrait(runtime, TRAIT.BIG_GAME_HUNTER)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.bigGameHunter), 'pulseInterval')
    : 6;
  if (!(duration > 0)) return;
  state.tetherActivationId = event.activationId ?? null;
  state.tetherUntil = canonicalTime(runtime.time + duration);
  const window = armSkillFlip(
    runtime.profession.core.availableFlips,
    ID.HUNTERS_VERDICT,
    runtime.time,
    state.tetherUntil
  );
  runtime.schedule(
    EXPIRY,
    state.tetherUntil,
    { deadline: state.tetherUntil, identity: window.identity },
    undefined,
    -220
  );
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
export const dragonhunterHooks: Partial<RuntimeProfession<GuardianRuntimeState>> = {
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
    if (
      cast.skill.id === ID.SPEAR_OF_JUSTICE &&
      !cancelledBeforeInterruptCommit(cast.skill, cast.start, cast.fullEnd, cast.effectiveEnd)
    ) {
      const at = canonicalTime(
        cast.start + projectCastRelativeEffectTimingMs(cast.skill, (cast.fullEnd - cast.start) * 1000, 480) / 1000
      );
      if (at <= cast.effectiveEnd) runtime.schedule(FURIOUS, at, cast);
    }
  },
  modifyEffects(runtime, cast, effects) {
    if (cast.skill.id !== ID.WINGS_OF_RESOLVE || !hasTrait(runtime, TRAIT.SOARING_DEVASTATION)) return effects;
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.soaringDevastation);
    const weapon = gw2ActivePrimaryWeapon(runtime.config, runtime.activeWeaponSet);
    return [
      ...effects,
      ...(profile.effects ?? [])
        .filter((effect) => effect.type === 'strike' || effect.type === 'condition')
        .map((effect) => ({
          ...effect,
          name:
            effect.type === 'strike' ? 'Wings of Resolve — Soaring Devastation' : 'Soaring Devastation — Immobilized',
          weapon,
          timingAnchor: 'castEnd' as const
        }))
    ];
  },
  onCastComplete(runtime, cast) {
    if (cancelledBeforeInterruptCommit(cast.skill, cast.start, cast.fullEnd, cast.effectiveEnd)) return;
    const virtue = cast.skill.categories?.includes('Virtue') ? guardianVirtueForSlot(cast.skill.slot) : null;
    if (virtue) {
      refreshGuardianVirtues(runtime);
      if (readyVirtues.has(cast)) applyGuardianVirtueActivationTraits(runtime, cast, virtue);
    }

    if (cast.skill.id === ID.HUNTERS_VERDICT) {
      dragonhunterState.from(runtime).tetherUntil = 0;
      consumeSkillFlip(runtime.profession.core.availableFlips, ID.HUNTERS_VERDICT);
    }

    if (cast.skill.categories?.includes('Trap') && hasTrait(runtime, TRAIT.HUNTERS_PREMONITION)) {
      const profile = requireBalanceProfileFromContext(runtime, PROFILE.huntersPremonition);
      const aegis = requireEffect(profile, 'boon', 'aegis');
      if (aegis)
        emitGuardianBoon(runtime, {
          type: 'buff',
          at: runtime.time,
          source: 'guardian',
          sourceId: cast.skill.id,
          actorType: 'player',
          skillId: cast.skill.id,
          skillName: cast.skill.name,
          activationId: cast.id,
          kind: 'aegis',
          duration: effectNumber(profile, aegis, 'duration'),
          stacks: effectNumber(profile, aegis, 'stacks')
        });
    }

    if (cast.skill.slot === 'Elite' && hasTrait(runtime, TRAIT.HUNTERS_DETERMINATION)) {
      const amount = balanceProfileNumber(
        requireBalanceProfileFromContext(runtime, PROFILE.huntersDetermination),
        'resourceGain'
      );
      runtime.endurance.grant(amount);
      recordGuardianTraitProc(
        runtime,
        TRAIT.HUNTERS_DETERMINATION,
        "Hunter's Determination",
        runtime.time,
        cast.skill.name,
        `${amount} endurance`
      );
    }
  },
  reactions: {
    'damage.resolved'(runtime, event, details) {
      refreshGuardianVirtues(runtime);
      const damage = details as NativeResolvedDamageDetails;
      if (!(Number(event.coefficient) > 0) || !(Number(damage.hitContext?.damage) > 0)) return;
      reactToDragonhunterJusticeHit(runtime, event, damage);
      if (event.skillId !== ID.SPEAR_OF_JUSTICE || event.actorType !== 'player') return;
      const action = runtime.history.find(
        (candidate) => candidate.type === 'action' && candidate.activationId === event.activationId
      );
      if (!action) return;
      runtime.schedule(TETHER, Math.max(runtime.time, Number(action.endsAt)), event, undefined, -50);
    },
    'control.resolved'(runtime, event) {
      if (event.actorType === 'player') reactToDragonhunterControl(runtime, event);
    }
  },
  tasks: {
    [COURAGE]: couragePulse,
    [FURIOUS]: (runtime, data) => triggerGuardianFuriousFocus(runtime, data as RuntimeCast),
    [TETHER]: attachTether,
    [BURN]: tetherBurn,
    [EXPIRY](runtime, data) {
      const { deadline, identity } = data as { deadline: number; identity: number | string };
      const state = dragonhunterState.from(runtime);
      if (state.tetherUntil === deadline) state.tetherUntil = 0;
      expireSkillFlip(runtime.profession.core.availableFlips, ID.HUNTERS_VERDICT, runtime.time, identity);
    }
  }
};
