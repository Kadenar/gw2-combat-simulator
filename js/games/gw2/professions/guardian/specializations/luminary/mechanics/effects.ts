import { gw2EffectExpiresAt } from '#gw2/platform/combat/effect-timing.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { ACTOR, AURA, CONTROL } from '#gw2/platform/constants.js';
import { requireBalanceNumber } from '#gw2/platform/effects/validation.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import {
  effectNumber,
  requireBalanceProfile,
  requireEffect,
  requireSkill
} from '#gw2/platform/skills/balance-profiles.js';
import type { BalanceProfile, Skill, SkillId } from '#gw2/platform/skills/types.js';
import { buildGuardianStrike, guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { lightAuraGranting } from '#gw2/professions/guardian/specializations/luminary/mechanics/trigger-points.js';
import { luminaryState } from '#gw2/professions/guardian/specializations/luminary/state.js';
import type { GuardianRuntime, GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';

export const AURA_GRANT = 'guardian.luminary.aura-grant';

export const EFFULGENT = 'guardian.luminary.effulgent';

export const STANCE = 'guardian.luminary.stance';

/** Every scheduled grant identifies its payload owner independently of the triggering cast's attribution. */
type AuraGrant = { readonly cause: Gw2ResolverEvent } & ({ readonly skillId: SkillId } | { readonly traitId: SkillId });

/** Native grants use the standard aura packet, after old-aura detonation and before same-time impacts. */
export function grantLuminaryAura(
  runtime: GuardianRuntime,
  event: Gw2ResolverEvent,
  profile: Skill | BalanceProfile
): void {
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
  luminaryState.from(runtime.profession).lightAuraUntil = gw2EffectExpiresAt(runtime.time, event.duration ?? 0);
}

/** Count only accepted strikes in the half-open window, excluding gear and summoned actors. */
export function countEffulgentHit(runtime: GuardianRuntime, event: Gw2ResolverEvent, damage: number): void {
  const state = luminaryState.from(runtime.profession);

  if (!(damage > 0) || !(Number(event.coefficient) > 0) || runtime.time >= state.effulgentActiveUntil) return;

  if (!isGw2PlayerActorEvent(event) && !(event.source === 'guardian' && event.actorType === ACTOR.EFFECT)) return;

  const skill = requireSkill(runtime.helpers, ID.EFFULGENT_STANCE);
  const maximum = requireBalanceNumber(skill.maximumStacks, `skill=${skill.id} field=maximumStacks`);
  state.effulgentStacks = Math.min(maximum, state.effulgentStacks + 1);
}

const luminaryEffectTasks = {
  [AURA_GRANT](runtime: GuardianRuntime, data: unknown) {
    const grant = data as AuraGrant;
    const owner =
      'skillId' in grant
        ? requireSkill(runtime.helpers, grant.skillId)
        : requireBalanceProfile(runtime.helpers, grant.traitId);
    grantLuminaryAura(runtime, grant.cause, owner);
  },
  [STANCE](runtime: GuardianRuntime, data: unknown) {
    const { cast, piercing } = data as { cast: RuntimeCast<GuardianSkill>; piercing: boolean };
    const state = luminaryState.from(runtime.profession);
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
    const state = luminaryState.from(runtime.profession);

    if (state.effulgentActivationId !== event.activationId) return;

    const skill = requireSkill(runtime.helpers, ID.EFFULGENT_STANCE);
    const maximum = requireBalanceNumber(skill.maximumStacks, `skill=${skill.id} field=maximumStacks`);
    const stacks = Math.max(0, Math.min(maximum, state.effulgentStacks));
    state.effulgentActiveUntil = 0;
    state.effulgentStacks = 0;
    state.effulgentActivationId = null;
    const strike = requireEffect(skill, 'strike', 'Strike');

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
            effectNumber(skill, strike, 'coefficient') +
            stacks *
              requireBalanceNumber(skill.damageIncreasePerStack, `skill=${skill.id} field=damageIncreasePerStack`),
          weaponStrengthProfileId: 'nonweapon.unequipped',
          offTarget: event.offTarget === true
        })
      });
    }

    if (stacks === maximum && requireEffect(skill, 'control', 'Control'))
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
