import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { strikeEffectCoefficient } from '#gw2/platform/engine/effects/authoring.js';
import { effectFirstAt, scaleCastBoundTiming } from '#gw2/platform/engine/effects/materializer.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2Runtime, RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import { buildGuardianStrike, guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { emitJusticeIsBlind, justiceIsBlindEligible } from '#gw2/professions/guardian/core/traits/behavior.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { LUMINARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/luminary/profiles.js';
import {
  LUMINARY_INITIAL_STATE_SKILL_IDS as INITIAL,
  LUMINARY_INITIAL_LIGHT_AURA_SKILL_ID
} from '#gw2/professions/guardian/specializations/luminary/skills/radiant-forge-skills.js';
import { luminaryState } from '#gw2/professions/guardian/specializations/luminary/state.js';
import {
  reactToSovereignAura,
  restoreLuminaryArmaments,
  startSovereignOfLight
} from '#gw2/professions/guardian/specializations/luminary/traits/behavior.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

type Runtime = Gw2Runtime<GuardianRuntimeState, GuardianSkill>;
export const AURA_GRANT = 'guardian.luminary.aura-grant';
export const EFFULGENT = 'guardian.luminary.effulgent';
export const STANCE = 'guardian.luminary.stance';

/** Linked self effects use the packet materializer's scaling and anchor so they resolve with the selected impact. */
export function luminaryImpactAt(cast: RuntimeCast<GuardianSkill>): number {
  const effect = cast.skill.effects?.find((effect) => effect.type === 'strike' && strikeEffectCoefficient(effect) > 0);
  if (effect?.type !== 'strike') return cast.effectiveEnd;
  return canonicalTime(effectFirstAt(cast.start, cast.fullEnd, scaleCastBoundTiming(cast, cast.skill, effect)));
}

/** Actual combo outcomes refresh the single aura; only Luminary sources can detonate an existing one on grant. */
export function grantLuminaryAura(runtime: Runtime, event: Gw2ResolverEvent): void {
  let duration = event.duration;
  if (duration === undefined) {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.lightAura);
    const aura = requireEffect(profile, 'buff', 'light-aura');
    if (!aura) return;
    duration = effectNumber(profile, aura, 'duration');
  }

  reactToSovereignAura(runtime, event);
  luminaryState.from(runtime).lightAuraUntil = gw2EffectExpiresAt(runtime.time, duration);
}

/** Imported boundary state is an explicit input, applied once without restoring subsequent live state. */
function initialState(runtime: Runtime, cast: RuntimeCast<GuardianSkill>): void {
  const duration = Math.max(0, cast.command.initialStateDurationMs ?? 0) / 1000;
  if (!(duration > 0)) return;
  const event = { ...guardianCastCause(runtime, cast), duration, stacks: 1 };
  const id = cast.skill.id;
  if (id === INITIAL.claw) {
    runtime.effects.emit({
      kind: 'packet',
      event: { ...event, type: 'control', controlKind: 'initial-state', initialStateDuration: duration }
    });
    return;
  }

  if (restoreLuminaryArmaments(runtime, cast, duration)) return;
  if (id === INITIAL.resolution) runtime.effects.emit({ kind: 'packet', event: { ...event, kind: 'resolution' } });
}

/** Schedule finite activation effects; all state mutations happen when their boundary executes. */
export function startLuminaryEffects(runtime: Runtime, cast: RuntimeCast<GuardianSkill>): void {
  initialState(runtime, cast);
  const skill = cast.skill;
  const event = guardianCastCause(runtime, cast);
  const hostile = { ...event, offTarget: cast.command.offTarget === true };
  const sovereignForgeAura = startSovereignOfLight(runtime, cast);
  const justiceBlind = justiceIsBlindEligible(runtime, skill);
  if (skill.id === LUMINARY_INITIAL_LIGHT_AURA_SKILL_ID || sovereignForgeAura || justiceBlind)
    runtime.schedule(AURA_GRANT, cast.start, hostile, undefined, -10);
  if (justiceBlind) emitJusticeIsBlind(runtime, hostile, skill);
}

/** Count only accepted strikes in the half-open window, excluding gear and summoned actors. */
export function countEffulgentHit(runtime: Runtime, event: Gw2ResolverEvent, damage: number): void {
  const state = luminaryState.from(runtime);
  if (!(damage > 0) || !(Number(event.coefficient) > 0) || runtime.time >= state.effulgentActiveUntil) return;
  if (!isGw2PlayerActorEvent(event) && !(event.source === 'guardian' && event.actorType === 'effect')) return;
  const maximum = balanceProfileNumber(
    requireBalanceProfileFromContext(runtime, PROFILE.effulgentStance),
    'maximumStacks'
  );
  state.effulgentStacks = Math.min(maximum, state.effulgentStacks + 1);
}

export const luminaryEffectTasks = {
  [AURA_GRANT]: (runtime: Runtime, data: unknown) => grantLuminaryAura(runtime, data as Gw2ResolverEvent),
  [STANCE](runtime: Runtime, data: unknown) {
    const { cast, piercing } = data as { cast: RuntimeCast<GuardianSkill>; piercing: boolean };
    const state = luminaryState.from(runtime);
    const duration = 8 + (piercing ? Math.max(0, state.piercingStanceUntil - runtime.time) : 0);
    if (piercing) state.piercingStanceUntil = gw2EffectExpiresAt(runtime.time, duration);
    runtime.effects.emit({
      kind: 'packet',
      event: {
        ...guardianCastCause(runtime, cast),
        kind: piercing ? 'guardian-piercing-stance' : 'guardian-daring-advance',
        duration,
        stacks: 1,
        priority: piercing ? -20 : 0
      }
    });
  },
  [EFFULGENT](runtime: Runtime, data: unknown) {
    const event = data as Gw2ResolverEvent;
    const state = luminaryState.from(runtime);
    if (state.effulgentActivationId !== event.activationId) return;
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.effulgentStance);
    const maximum = balanceProfileNumber(profile, 'maximumStacks');
    const stacks = Math.max(0, Math.min(maximum, state.effulgentStacks));
    state.effulgentActiveUntil = 0;
    state.effulgentStacks = 0;
    state.effulgentActivationId = null;
    const strike = requireEffect(profile, 'strike', 'Strike');
    if (strike) {
      runtime.effects.emit({
        kind: 'announcement',
        announcement: {
          type: 'skill',
          name: 'Effulgent Stance',
          at: runtime.time,
          sourceSkill: 'Effulgent Stance',
          detail: `${stacks}/${maximum} stacks`
        }
      });
      runtime.effects.emit({
        kind: 'packet',
        cause: event,
        event: buildGuardianStrike({
          at: runtime.time,
          priority: 5,
          sourceId: ID.EFFULGENT_STANCE_DAMAGE,
          skillId: ID.EFFULGENT_STANCE_DAMAGE,
          skillName: 'Effulgent Stance',
          name: 'Effulgent Stance',
          coefficient:
            effectNumber(profile, strike, 'coefficient') +
            stacks * balanceProfileNumber(profile, 'damageIncreasePerStack'),
          weaponStrengthProfileId: 'nonweapon.unequipped',
          offTarget: event.offTarget === true
        })
      });
    }

    if (stacks === maximum && requireEffect(profile, 'control', 'Control'))
      runtime.effects.emit({
        kind: 'packet',
        cause: event,
        event: {
          type: 'control',
          at: runtime.time,
          priority: 6,
          source: 'guardian',
          sourceId: ID.EFFULGENT_STANCE_DAMAGE,
          actorType: 'player',
          skillId: ID.EFFULGENT_STANCE_DAMAGE,
          skillName: 'Effulgent Stance',
          controlKind: 'daze',
          offTarget: event.offTarget === true
        }
      });
  }
};
