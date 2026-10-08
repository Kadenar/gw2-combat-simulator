import { CAST_READY, denyCast } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { armSkillFlip, consumeSkillFlip } from '#gw2/platform/execution/skill-flips.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import {
  guardianVirtueForSlot,
  reactToJusticeHitWithOptions,
  refreshGuardianVirtues
} from '#gw2/professions/guardian/core/mechanics/virtues.js';
import { applyGuardianVirtueActivationTraits } from '#gw2/professions/guardian/core/traits/virtues/behavior.js';
import { triggerGuardianFuriousFocus } from '#gw2/professions/guardian/core/traits/zeal/behavior.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import {
  luminaryBuffPolicies,
  luminaryEffectStates
} from '#gw2/professions/guardian/specializations/luminary/effect-state.js';
import {
  countEffulgentHit,
  grantLuminaryAura,
  luminaryEffectTasks,
  startLuminaryEffects
} from '#gw2/professions/guardian/specializations/luminary/mechanics/effects.js';
import {
  enterForge,
  EQUIP,
  equipForge,
  EXIT,
  exitForge
} from '#gw2/professions/guardian/specializations/luminary/mechanics/radiant-forge.js';
import { LUMINARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/luminary/profiles.js';
import { hammerImpact } from '#gw2/professions/guardian/specializations/luminary/skills/hammer-impact.js';
import {
  BLADE_IMMOBILIZE,
  BOON,
  glaringBurstDetail,
  glaringBurstDuration,
  HAMMER,
  luminaryWeaponActions
} from '#gw2/professions/guardian/specializations/luminary/skills/radiant-forge-skills.js';
import { luminaryStanceActions } from '#gw2/professions/guardian/specializations/luminary/skills/stance-skills.js';
import { luminaryVirtueActions } from '#gw2/professions/guardian/specializations/luminary/skills/virtue-skills.js';
import { luminaryState } from '#gw2/professions/guardian/specializations/luminary/state.js';
import {
  completeLuminaryEquipTraits,
  completeMasterAtArms,
  startRadiantArmaments
} from '#gw2/professions/guardian/specializations/luminary/traits/behavior.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

const VIRTUES: readonly number[] = [ID.RADIANT_JUSTICE, ID.RADIANT_RESOLVE, ID.RADIANT_COURAGE];
const readyVirtues = new WeakSet<RuntimeCast<GuardianSkill>>();

/** Luminary owns its live form, virtue entitlements, finite stance work, and actual combo-derived auras. */
export const luminaryHooks: RuntimeHooks<GuardianRuntimeState, GuardianSkill> = {
  buffPolicies: luminaryBuffPolicies,
  observeEffects: luminaryEffectStates,
  /** Initialize only damage-relevant form and scaling state for one assumed occurrence. */
  prepareDamageState(runtime, skill, inputs) {
    const state = luminaryState.from(runtime);
    state.radiantForge = Boolean(skill?.radiantForgeSkill);
    state.radiantForgeEndsAt = Infinity;
    state.radiantWeapon = skill?.radiantWeapon ?? '';
    if (inputs.radiantHammer)
      runtime.effects.emit({
        kind: 'packet',
        event: {
          type: 'buff',
          at: runtime.time,
          source: 'Assumption',
          sourceId: 'assumption.radiant-armaments',
          actorType: 'player',
          skillName: 'Radiant Armaments',
          kind: 'guardian-radiant-armaments',
          duration: 3600,
          stacks: 1,
          metadata: { radiantWeapon: 'hammer' }
        }
      });
  },

  sideEffectHandlers: {
    ...luminaryWeaponActions,
    ...luminaryVirtueActions,
    ...luminaryStanceActions,
    // Form transitions share expiry/recharge ownership; declarations choose when to invoke them.
    'guardian.enter-forge'(runtime, context) {
      if (context.kind === 'cast') enterForge(runtime, context.cast);
    },
    'guardian.exit-forge'(runtime, context) {
      if (context.kind === 'cast') exitForge(runtime, context.cast);
    },
    'guardian.snapshot-forge'(runtime, context) {
      if (context.kind === 'cast') equipForge.set(context.cast, luminaryState.from(runtime).forgeActivationId);
    },
    'guardian.equip-forge'(runtime, context) {
      if (context.kind !== 'cast') return;
      const cast = context.cast;
      const state = luminaryState.from(runtime);
      if (state.radiantForge && equipForge.get(cast) === state.forgeActivationId) {
        state.radiantWeapon = String(cast.skill.radiantWeapon);
        state.radiantWeaponsUsed[String(cast.skill.radiantWeapon)] = true;
        if (cast.skill.radiantWeapon === 'blade') state.glaringBurstSwordSlow = false;
        const flips = runtime.profession.core.availableFlips;
        for (const id of Object.keys(flips)) {
          const skill = runtime.helpers.skillsById.get(Number(id));
          if (skill?.radiantWeapon && skill.flipParentId != null) consumeSkillFlip(flips, id);
        }

        if (cast.skill.flipSkillId != null) armSkillFlip(flips, cast.skill.flipSkillId, runtime.time);
        runtime.effects.emit({
          kind: 'packet',
          event: { ...guardianCastCause(runtime, cast), type: 'sigil_swap', weaponSet: runtime.activeWeaponSet }
        });
        runtime.scheduleForCast(EQUIP, canonicalTime(runtime.time + 0.001), cast);
      }
    },
    'guardian.hammer-aura'(runtime, context) {
      if (context.kind === 'effect')
        grantLuminaryAura(runtime, { ...context.trigger.event, type: 'combo', duration: undefined });
    }
  },
  availability(runtime, skill) {
    const active = luminaryState.from(runtime).radiantForge;
    if (skill.type === 'Weapon' && active)
      return denyCast(
        'guardian.radiant-forge-weapon-lockout',
        `${skill.name} is unavailable — exit Radiant Forge first.`
      );
    if ((skill.radiantForgeSkill || skill.id === ID.EXIT_RADIANT_FORGE) && !active)
      return denyCast('guardian.radiant-forge-inactive', `${skill.name} is unavailable — requires Radiant Forge.`);
    if (skill.id === ID.ENTER_RADIANT_FORGE && active)
      return denyCast(
        'guardian.radiant-forge-active',
        `${skill.name} is unavailable — Radiant Forge is already active.`
      );
    return CAST_READY;
  },
  castDurationMs(runtime, skill, duration) {
    return skill.id === ID.GLARING_BURST ? glaringBurstDuration(runtime, skill, duration) : duration;
  },
  castDetail(context, cast) {
    return cast.skill.id === ID.GLARING_BURST ? glaringBurstDetail(context) : undefined;
  },
  onCastStart(runtime, cast) {
    if (cast.cancelled) return;
    startLuminaryEffects(runtime, cast);
    if (VIRTUES.includes(Number(cast.skill.id))) {
      refreshGuardianVirtues(runtime);
      const virtue = guardianVirtueForSlot(cast.skill.slot)!;
      if (runtime.profession.core.virtueReadyAt[virtue] <= runtime.time) readyVirtues.add(cast);
    }

    startRadiantArmaments(runtime, cast);
  },
  onCastCommit(runtime, cast) {
    if (!VIRTUES.includes(Number(cast.skill.id))) return;
    const virtue = guardianVirtueForSlot(cast.skill.slot)!;
    refreshGuardianVirtues(runtime);
    if (readyVirtues.has(cast)) {
      applyGuardianVirtueActivationTraits(runtime, cast, virtue);
      if (virtue === 'justice') triggerGuardianFuriousFocus(runtime, cast);
    }

    completeMasterAtArms(runtime, cast);
  },
  reactions: {
    'damage.resolved'(runtime, event, details) {
      countEffulgentHit(runtime, event, (details as NativeResolvedDamageDetails).hitContext?.damage ?? 0);
      refreshGuardianVirtues(runtime);
      reactToJusticeHitWithOptions(runtime, event, details, {
        skillId: ID.RADIANT_JUSTICE,
        skillName: 'Radiant Justice',
        passiveBurnDuration: 2
      });
    },
    'aura.applied'(runtime, event) {
      if (event.aura === 'Light Aura') grantLuminaryAura(runtime, event);
    }
  },
  tasks: {
    ...luminaryEffectTasks,
    [EXIT](runtime, data) {
      if (luminaryState.from(runtime).forgeActivationId === data) exitForge(runtime);
    },
    [EQUIP]: completeLuminaryEquipTraits,
    [HAMMER]: hammerImpact,
    [BLADE_IMMOBILIZE](runtime, data) {
      const { cast } = data as { cast: RuntimeCast<GuardianSkill> };
      runtime.effects.emit({
        kind: 'profile',
        profile: requireBalanceProfileFromContext(runtime, PROFILE.radiantCourageImmobilize),
        attribution: guardianCastCause(runtime, cast),
        transform: (event) => ({ ...event, offTarget: cast.command.offTarget === true })
      });
    },
    [BOON](runtime, data) {
      const { cast, kind, duration, party } = data as {
        cast: RuntimeCast<GuardianSkill>;
        kind: string;
        duration: number;
        party?: boolean;
      };
      runtime.effects.emit({
        kind: 'packet',
        event: {
          ...guardianCastCause(runtime, cast),
          priority: kind === 'guardian-radiant-courage-sword' ? -5 : 0,
          kind,
          duration,
          stacks: 1,
          audience: { recipients: party ? 'party' : 'self' }
        }
      });
    }
  }
};
