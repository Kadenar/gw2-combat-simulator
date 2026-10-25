import { ACTOR, AURA } from '#gw2/platform/constants.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import {
  admitVirtueActivation,
  completeVirtueActivation,
  guardianVirtueForSlot,
  reactToJusticeHitWithOptions,
  refreshGuardianVirtues
} from '#gw2/professions/guardian/core/mechanics/virtues.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import {
  luminaryBuffPolicies,
  luminaryEffectStates
} from '#gw2/professions/guardian/specializations/luminary/effect-state.js';
import {
  luminaryVirtueCompleted,
  radiantWeaponDrawn
} from '#gw2/professions/guardian/specializations/luminary/mechanics/trigger-points.js';
import {
  acceptLuminaryAura,
  countEffulgentHit,
  grantLuminaryAura,
  luminaryEffectLifecycle,
  startLuminaryEffects
} from '#gw2/professions/guardian/specializations/luminary/mechanics/effects.js';
import { radiantForgeLifecycle } from '#gw2/professions/guardian/specializations/luminary/mechanics/radiant-forge.js';
import { luminaryHammerLifecycle } from '#gw2/professions/guardian/specializations/luminary/skills/hammer-impact.js';
import {
  glaringBurstDetail,
  glaringBurstDuration
} from '#gw2/professions/guardian/specializations/luminary/skills/radiant-forge-skills.js';
import { luminaryStanceLifecycle } from '#gw2/professions/guardian/specializations/luminary/skills/stance-skills.js';
import { luminaryVirtueLifecycle } from '#gw2/professions/guardian/specializations/luminary/skills/virtue-skills.js';
import { luminaryState } from '#gw2/professions/guardian/specializations/luminary/state.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';

const VIRTUES: readonly number[] = [ID.RADIANT_JUSTICE, ID.RADIANT_RESOLVE, ID.RADIANT_COURAGE];

/** Luminary owns its live form, virtue entitlements, finite stance work, and actual combo-derived auras. */
export const luminaryHooks = composeRuntimeHooks<GuardianRuntimeState, GuardianSkill>([
  luminaryHammerLifecycle,
  luminaryVirtueLifecycle,
  luminaryStanceLifecycle,
  radiantForgeLifecycle,
  luminaryEffectLifecycle,
  {
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
            actorType: ACTOR.PLAYER,
            skillName: 'Radiant Armaments',
            kind: 'guardian-radiant-armaments',
            duration: 3600,
            stacks: 1,
            metadata: { radiantWeapon: 'hammer' }
          }
        });
    },

    sideEffectHandlers: {
      'guardian.hammer-aura'(runtime, context) {
        if (context.kind === 'effect') grantLuminaryAura(runtime, context.trigger.event);
      }
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

      if (VIRTUES.includes(Number(cast.skill.id)))
        admitVirtueActivation(runtime, cast, guardianVirtueForSlot(cast.skill.slot)!);

      if (cast.skill.radiantWeapon && cast.skill.flipParentId == null)
        runtime.fireTrigger(radiantWeaponDrawn, { cast });
    },
    onCastCommit(runtime, cast) {
      if (!VIRTUES.includes(Number(cast.skill.id))) return;

      completeVirtueActivation(runtime, cast, guardianVirtueForSlot(cast.skill.slot)!);
      runtime.fireTrigger(luminaryVirtueCompleted, { cast });
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
        if (event.aura === AURA.LIGHT) acceptLuminaryAura(runtime, event);
      }
    }
  }
]);
