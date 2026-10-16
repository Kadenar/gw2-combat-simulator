import { buffActive } from '#gw2/platform/combat/query/runtime-query.js';
import { MODIFIER_TARGET, type Gw2ModifierContext, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';

import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceNumberFromContext,
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { buildGuardianStrike, guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { justiceBlinding } from '#gw2/professions/guardian/core/mechanics/virtues.js';
import {
  lightAuraGranting,
  luminaryCastStarted
} from '#gw2/professions/guardian/specializations/luminary/mechanics/activations.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { LUMINARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/luminary/profiles.js';
import {
  LUMINARY_INITIAL_STATE_SKILL_IDS as INITIAL,
  LUMINARY_INITIAL_LIGHT_AURA_SKILL_ID
} from '#gw2/professions/guardian/specializations/luminary/skills/radiant-forge-skills.js';
import { luminaryState } from '#gw2/professions/guardian/specializations/luminary/state.js';
import type { GuardianSkill, GuardianRuntime } from '#gw2/professions/guardian/types.js';

export const AURA_GRANT = 'guardian.luminary.aura-grant';

export const EFFULGENT = 'guardian.luminary.effulgent';

export const STANCE = 'guardian.luminary.stance';

/** Actual combo outcomes refresh the single aura; only Luminary sources can detonate an existing one on grant. */
export function grantLuminaryAura(runtime: GuardianRuntime, event: Gw2ResolverEvent): void {
  let duration = event.duration;

  if (duration === undefined) {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.lightAura);
    const aura = requireEffect(profile, 'buff', 'light-aura');

    if (!aura) return;

    duration = effectNumber(profile, aura, 'duration');
  }

  runtime.fireTrigger(lightAuraGranting, { cause: event });
  luminaryState.from(runtime).lightAuraUntil = gw2EffectExpiresAt(runtime.time, duration);
}

/** Imported armaments already own their final duration and remain valid without current trait selection. */
function restoreLuminaryArmaments(
  runtime: GuardianRuntime,
  cast: RuntimeCast<GuardianSkill>,
  duration: number
): boolean {
  const empowered = cast.skill.id === INITIAL.empoweredArmaments;

  if (!empowered && cast.skill.id !== INITIAL.radiantHammer) return false;

  if (empowered) luminaryState.from(runtime).empoweredArmamentsUntil = gw2EffectExpiresAt(runtime.time, duration);

  runtime.effects.emit({
    kind: 'packet',
    event: {
      ...guardianCastCause(runtime, cast),
      duration,
      stacks: 1,
      kind: empowered ? 'guardian-empowered-armaments' : 'guardian-radiant-armaments',
      ...(!empowered ? { metadata: { radiantWeapon: 'hammer' } } : {})
    }
  });
  return true;
}

/** Imported boundary state is an explicit input, applied once without restoring subsequent live state. */
function initialState(runtime: GuardianRuntime, cast: RuntimeCast<GuardianSkill>): void {
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
export function startLuminaryEffects(runtime: GuardianRuntime, cast: RuntimeCast<GuardianSkill>): void {
  initialState(runtime, cast);
  const skill = cast.skill;
  const event = guardianCastCause(runtime, cast);
  const hostile = { ...event, offTarget: cast.command.offTarget === true };
  // Sovereign of Light schedules detonation before this cast's replacement aura.
  runtime.fireTrigger(luminaryCastStarted, { cast });

  if (skill.id === LUMINARY_INITIAL_LIGHT_AURA_SKILL_ID)
    runtime.schedule(AURA_GRANT, cast.start, hostile, undefined, -10);

  // Announce the accepted virtue independently of selection; the trait owns both aura and Blind admission.
  if (skill.categories?.includes('Virtue') && skill.slot === 'Profession_1')
    runtime.fireTrigger(justiceBlinding, { cause: hostile, skill, auraTask: AURA_GRANT });
}

/** Count only accepted strikes in the half-open window, excluding gear and summoned actors. */
export function countEffulgentHit(runtime: GuardianRuntime, event: Gw2ResolverEvent, damage: number): void {
  const state = luminaryState.from(runtime);

  if (!(damage > 0) || !(Number(event.coefficient) > 0) || runtime.time >= state.effulgentActiveUntil) return;

  if (!isGw2PlayerActorEvent(event) && !(event.source === 'guardian' && event.actorType === 'effect')) return;

  const maximum = balanceNumberFromContext(runtime, PROFILE.effulgentStance, 'maximumStacks');
  state.effulgentStacks = Math.min(maximum, state.effulgentStacks + 1);
}

export const luminaryEffectTasks = {
  [AURA_GRANT]: (runtime: GuardianRuntime, data: unknown) => grantLuminaryAura(runtime, data as Gw2ResolverEvent),
  [STANCE](runtime: GuardianRuntime, data: unknown) {
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
  [EFFULGENT](runtime: GuardianRuntime, data: unknown) {
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

/** Applies a stance modifier to its own impact or proc only when an older application was already active. */
function stanceModifierActive(context: Gw2ModifierContext, kind: string, skillId: number, skillName: string): boolean {
  if (!buffActive(context, kind)) return false;

  if (context.event?.skillId !== skillId && context.event?.triggeredBy !== skillName) return true;

  return (context.events || []).some(
    (event) =>
      event.type === 'buff' &&
      event.kind === kind &&
      event.at < context.time &&
      gw2EffectExpiresAt(event.at, event.duration || 0) > context.time
  );
}

/** Stances own their damage windows and the eligibility of their activating impact. */
export const luminaryStanceModifiers: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'guardian.piercing-stance',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    // The stance is active before its impact, including the damage it triggers at that timestamp.
    when: (context) => buffActive(context, 'guardian-piercing-stance')
  },
  {
    id: 'guardian.daring-advance',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.15,
    // order: 100 places this after additive stacking; multiplicative modifiers
    // that interact with additive sums must sort after them.
    order: 100,
    when: (context) => stanceModifierActive(context, 'guardian-daring-advance', ID.DARING_ADVANCE, 'Daring Advance')
  }
]);
