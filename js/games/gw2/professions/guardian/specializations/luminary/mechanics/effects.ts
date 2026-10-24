import { ACTOR, CONTROL, AURA } from '#gw2/platform/constants.js';
import { buffActive } from '#gw2/platform/combat/query/runtime-query.js';
import { MODIFIER_TARGET, type Gw2ModifierContext, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { gw2EffectExpiresAt } from '#gw2/platform/combat/effect-timing.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';

import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
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
} from '#gw2/professions/guardian/specializations/luminary/mechanics/trigger-points.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { LUMINARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/luminary/profiles.js';
import { luminaryState } from '#gw2/professions/guardian/specializations/luminary/state.js';
import type { GuardianSkill, GuardianRuntime, GuardianRuntimeState } from '#gw2/professions/guardian/types.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';

export const AURA_GRANT = 'guardian.luminary.aura-grant';

export const EFFULGENT = 'guardian.luminary.effulgent';

export const STANCE = 'guardian.luminary.stance';

/** Native grants use the standard aura packet, after old-aura detonation and before same-time impacts. */
export function grantLuminaryAura(runtime: GuardianRuntime, event: Gw2ResolverEvent): void {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.lightAura);
  const aura = requireEffect(profile, 'aura', AURA.LIGHT);

  if (!aura) return;

  runtime.effects.emit({
    kind: 'profile',
    profile,
    effects: [aura],
    at: runtime.time,
    fullEnd: runtime.time,
    cause: event,
    attribution: event,
    priority: -10
  });
}

/** Native and combo grants share acceptance; detonation sees the old aura before its replacement is stored. */
export function acceptLuminaryAura(runtime: GuardianRuntime, event: Gw2ResolverEvent): void {
  runtime.fireTrigger(lightAuraGranting, { cause: event });
  luminaryState.from(runtime).lightAuraUntil = gw2EffectExpiresAt(runtime.time, event.duration ?? 0);
}

/** Schedule finite activation effects; all state mutations happen when their boundary executes. */
export function startLuminaryEffects(runtime: GuardianRuntime, cast: RuntimeCast<GuardianSkill>): void {
  const skill = cast.skill;
  const event = guardianCastCause(runtime, cast);
  const hostile = { ...event, offTarget: cast.command.offTarget === true };
  // Sovereign of Light schedules detonation before this cast's replacement aura.
  runtime.fireTrigger(luminaryCastStarted, { cast });

  // Announce the accepted virtue independently of selection; the trait owns both aura and Blind admission.
  if (skill.categories?.includes('Virtue') && skill.slot === 'Profession_1')
    runtime.fireTrigger(justiceBlinding, { cause: hostile, skill, auraTask: AURA_GRANT });
}

/** Count only accepted strikes in the half-open window, excluding gear and summoned actors. */
export function countEffulgentHit(runtime: GuardianRuntime, event: Gw2ResolverEvent, damage: number): void {
  const state = luminaryState.from(runtime);

  if (!(damage > 0) || !(Number(event.coefficient) > 0) || runtime.time >= state.effulgentActiveUntil) return;

  if (!isGw2PlayerActorEvent(event) && !(event.source === 'guardian' && event.actorType === ACTOR.EFFECT)) return;

  const maximum = balanceNumberFromContext(runtime, PROFILE.effulgentStance, 'maximumStacks');
  state.effulgentStacks = Math.min(maximum, state.effulgentStacks + 1);
}

const luminaryEffectTasks = {
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
          actorType: ACTOR.PLAYER,
          skillId: ID.EFFULGENT_STANCE_DAMAGE,
          skillName: 'Effulgent Stance',
          controlKind: CONTROL.DAZE,
          offTarget: event.offTarget === true
        }
      });
  }
};

/** Registers scheduled Luminary effect work with the Luminary hook assembly. */
export const luminaryEffectLifecycle = {
  tasks: luminaryEffectTasks
} satisfies RuntimeHooks<GuardianRuntimeState, GuardianSkill>;

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
