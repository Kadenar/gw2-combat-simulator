import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import { buildGuardianStrike, guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { refreshGuardianVirtues } from '#gw2/professions/guardian/core/mechanics/virtues.js';
import { guardianTraitIcon } from '#gw2/professions/guardian/core/traits/behavior.js';

import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { luminaryImpactAt } from '#gw2/professions/guardian/specializations/luminary/mechanics/effects.js';
import { LUMINARY_INITIAL_STATE_SKILL_IDS as INITIAL } from '#gw2/professions/guardian/specializations/luminary/skills/radiant-forge-skills.js';
import { luminaryState } from '#gw2/professions/guardian/specializations/luminary/state.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';

type Runtime = MechanicContext<GuardianRuntimeState, GuardianSkill>;

export const AURA_DETONATE = 'guardian.luminary.aura-detonate';

const VIRTUES: readonly number[] = [ID.RADIANT_JUSTICE, ID.RADIANT_RESOLVE, ID.RADIANT_COURAGE];

/** Imported armaments already own their final duration and remain valid without current trait selection. */
export function restoreLuminaryArmaments(
  runtime: Runtime,
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

/** Only Luminary activation sources can consume a preexisting aura. */
function detonator(skill: GuardianSkill): boolean {
  return (
    skill.id !== ID.GLARING_BURST &&
    Boolean(
      skill.id === ID.RADIANT_JUSTICE ||
      skill.id === ID.RADIANT_RESOLVE ||
      skill.id === ID.RADIANT_COURAGE ||
      skill.radiantForgeSkill ||
      (skill.specialization === 'Luminary' && skill.categories?.includes('Stance'))
    )
  );
}

/** A surviving strike consumes the aura before queuing its hostile outcome, even on a miss. */
export function detonate(runtime: Runtime, event: Gw2ResolverEvent): void {
  const state = luminaryState.from(runtime);
  if (state.lightAuraUntil <= runtime.time) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.SOVEREIGN_OF_LIGHT);
  const strike = requireEffect(profile, 'strike', 'Strike');
  if (!strike) return;
  state.lightAuraUntil = 0;
  runtime.effects.emit({
    kind: 'packet',
    cause: event,
    event: buildGuardianStrike({
      at: runtime.time,
      priority: -15,
      sourceId: ID.SOVEREIGN_OF_LIGHT_DAMAGE,
      actorType: 'effect',
      ownerActorType: 'player',
      skillId: ID.SOVEREIGN_OF_LIGHT_DAMAGE,
      skillName: 'Sovereign of Light',
      name: 'Sovereign of Light',
      coefficient: effectNumber(profile, strike, 'coefficient'),
      skillWeapon: 'Unequipped',
      triggeredBy: event.skillName,
      offTarget: event.offTarget === true
    })
  });
  {
    runtime.effects.emit({
      kind: 'announcement',
      announcement: {
        type: 'trait',
        name: 'Sovereign of Light',
        at: runtime.time,
        sourceSkill: event.skillName ?? '',
        detail: 'Light aura detonated',
        icon: guardianTraitIcon(TRAIT.SOVEREIGN_OF_LIGHT)
      }
    });
  }
}

/** Aura applications may detonate their predecessor before the mechanic installs the replacement. */
export function reactToSovereignAura(runtime: Runtime, event: Gw2ResolverEvent): void {
  const skill = event.skillId == null ? undefined : runtime.helpers.skillsById.get(event.skillId);
  if (skill && detonator(skill) && hasTrait(runtime, TRAIT.SOVEREIGN_OF_LIGHT)) detonate(runtime, event);
}

/** Schedules detonation before aura replacement and requests the selected Forge-entry aura. */
export function startSovereignOfLight(runtime: Runtime, cast: RuntimeCast<GuardianSkill>): boolean {
  const skill = cast.skill;
  const sovereign = hasTrait(runtime, TRAIT.SOVEREIGN_OF_LIGHT);
  if (sovereign && detonator(skill)) {
    const at =
      skill.radiantForgeSkill || skill.id === ID.PIERCING_STANCE || skill.id === ID.DARING_ADVANCE
        ? luminaryImpactAt(cast)
        : cast.start;
    runtime.schedule(
      AURA_DETONATE,
      at,
      { ...guardianCastCause(runtime, cast), offTarget: cast.command.offTarget === true },
      undefined,
      -20
    );
  }

  return sovereign && skill.id === ID.ENTER_RADIANT_FORGE;
}

/** The accepted equip animation grants its armament window after earlier cast-start effects. */
export function startRadiantArmaments(runtime: Runtime, cast: RuntimeCast<GuardianSkill>): void {
  if (!cast.skill.radiantWeapon || cast.skill.flipParentId != null) return;
  // Armament damage starts with the accepted equip animation, independently of its completion rewards.
  if (hasTrait(runtime, TRAIT.RADIANT_ARMAMENTS)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.RADIANT_ARMAMENTS);
    const effect = requireEffect(profile, 'buff', 'radiant-armaments');
    if (effect) {
      runtime.effects.emit({
        kind: 'packet',
        event: {
          ...guardianCastCause(runtime, cast),
          kind: 'guardian-radiant-armaments',
          duration: effectNumber(profile, effect, 'duration'),
          stacks: 1,
          metadata: { radiantWeapon: cast.skill.radiantWeapon }
        }
      });
      {
        runtime.effects.emit({
          kind: 'announcement',
          announcement: {
            type: 'trait',
            name: 'Radiant Armaments',
            at: runtime.time,
            sourceSkill: cast.skill.name,
            detail: cast.skill.radiantWeapon,
            icon: guardianTraitIcon(TRAIT.RADIANT_ARMAMENTS)
          }
        });
      }
    }
  }
}

/** Reports the selected virtue reset after its Core activation traits have run. */
export function completeMasterAtArms(runtime: Runtime, cast: RuntimeCast<GuardianSkill>): void {
  if (hasTrait(runtime, TRAIT.MASTER_AT_ARMS)) {
    {
      runtime.effects.emit({
        kind: 'announcement',
        announcement: {
          type: 'trait',
          name: 'Master-at-Arms',
          at: runtime.time,
          sourceSkill: cast.skill.name,
          detail: 'Radiant weapons recharged',
          icon: guardianTraitIcon(TRAIT.MASTER_AT_ARMS)
        }
      });
    }
  }
}

/** Each virtue arms its entitlement before this colocated selected-trait recharge reset. */
export const masterAtArmsRecharges: Readonly<Record<number, NonNullable<Skill['sideEffects']>[number]>> = {
  [ID.RADIANT_COURAGE]: {
    on: 'castCommit',
    when: (runtime) => hasTrait(runtime, TRAIT.MASTER_AT_ARMS),
    do: { type: 'rechargeReset', skillIds: [ID.GLEAMING_BLADE, ID.RADIANT_BULWARK] }
  },
  [ID.RADIANT_RESOLVE]: {
    on: 'castCommit',
    when: (runtime) => hasTrait(runtime, TRAIT.MASTER_AT_ARMS),
    do: { type: 'rechargeReset', skillIds: [ID.LUMINOUS_STAFF] }
  },
  [ID.RADIANT_JUSTICE]: {
    on: 'castCommit',
    when: (runtime) => hasTrait(runtime, TRAIT.MASTER_AT_ARMS),
    do: { type: 'rechargeReset', skillIds: [ID.DAZZLING_HAMMER] }
  }
};

/** Delayed equip rewards retain boon, armament, then recharge ordering. */
export function completeLuminaryEquipTraits(runtime: Runtime, data: unknown): void {
  const { cast } = data as { cast: RuntimeCast<GuardianSkill> };
  const cause = guardianCastCause(runtime, cast);
  const state = luminaryState.from(runtime);
  if (hasTrait(runtime, TRAIT.RESPLENDENT_WEAPONRY)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.RESPLENDENT_WEAPONRY);
    for (const effect of profile.effects ?? []) {
      if (effect.type !== 'boon') continue;
      runtime.effects.emit({
        kind: 'packet',
        event: {
          ...cause,
          sourceId: TRAIT.RESPLENDENT_WEAPONRY,
          skillName: 'Resplendent Weaponry',
          kind: effect.boon,
          duration: effect.duration,
          stacks: effectNumber(profile, effect, 'stacks'),
          audience: { recipients: 'party' }
        }
      });
    }
  }

  if (hasTrait(runtime, TRAIT.EMPOWERED_ARMAMENTS)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.EMPOWERED_ARMAMENTS);
    const duration = Math.min(
      balanceProfileNumber(profile, 'maximumStacks'),
      Math.max(0, state.empoweredArmamentsUntil - runtime.time) + balanceProfileNumber(profile, 'resourceGain')
    );
    state.empoweredArmamentsUntil = gw2EffectExpiresAt(runtime.time, duration);
    runtime.effects.emit({
      kind: 'packet',
      event: { ...cause, kind: 'guardian-empowered-armaments', duration, stacks: 1 }
    });
    {
      runtime.effects.emit({
        kind: 'announcement',
        announcement: {
          type: 'trait',
          name: 'Empowered Armaments',
          at: runtime.time,
          sourceSkill: cast.skill.name,
          detail: 'Radiant weapon equipped',
          icon: guardianTraitIcon(TRAIT.EMPOWERED_ARMAMENTS)
        }
      });
    }
  }

  if (hasTrait(runtime, TRAIT.ILLUMINATING_INSPIRATION)) {
    const reduction = balanceProfileNumber(
      requireBalanceProfileFromContext(runtime, TRAIT.ILLUMINATING_INSPIRATION),
      'rechargeReduction'
    );
    for (const id of VIRTUES)
      runtime.cooldownController.reduceSkillRecharge(runtime.helpers.skillsById.get(id)!, reduction, runtime.time);
    refreshGuardianVirtues(runtime);
    {
      runtime.effects.emit({
        kind: 'announcement',
        announcement: {
          type: 'trait',
          name: 'Illuminating Inspiration',
          at: runtime.time,
          sourceSkill: cast.skill.name,
          detail: `Virtue recharges reduced by ${reduction} seconds`,
          icon: guardianTraitIcon(TRAIT.ILLUMINATING_INSPIRATION)
        }
      });
    }
  }
}
