/** Own Mirage ambush admission, cast occupancy, and pending mirror creation alongside cloak and pickup effects. */
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { ENDURANCE, enduranceRegenerationRate } from '#gw2/platform/combat/resources/endurance-rules.js';
import type { EndurancePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import { ACTOR, CONDITION } from '#gw2/platform/constants.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import { materializeSkillEffectApplications } from '#gw2/platform/effects/materializer.js';
import { gw2ActivePrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast, SkillTaskData } from '#gw2/platform/execution/cast-contracts.js';
import { skillTaskAt } from '#gw2/platform/execution/cast-timing.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import { balanceNumber, requireEffect, requireSkill } from '#gw2/platform/skills/balance-profiles.js';
import { mesmerCastDelivery } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import type { MesmerClone } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import {
  buildMesmerConditions,
  buildMesmerPacket,
  buildMesmerStrikes
} from '#gw2/professions/mesmer/core/mechanics/packets.js';
import { mesmerEvaded } from '#gw2/professions/mesmer/core/mechanics/trigger-points.js';
import { NON_MIRAGE_AXE_SKILL_IDS } from '#gw2/professions/mesmer/core/skills/weapons/axe.js';
import { MESMER_CORE_CLONE_ATTACKS } from '#gw2/professions/mesmer/core/skills/weapons/clone-attacks.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { createMesmerIllusionRewards, mesmerActivePrimaryWeapon } from '#gw2/professions/mesmer/family-resources.js';
import { mesmerSelectedAmbush } from '#gw2/professions/mesmer/specializations/mirage/mechanics/ambush.js';
import { mirageCloneBoonRequest } from '#gw2/professions/mesmer/specializations/mirage/mechanics/boons.js';
import {
  mirageAmbushAccepted,
  mirageCastCommitted,
  mirageCloakGranted,
  mirageCloneAmbushRequested,
  mirageInitialized
} from '#gw2/professions/mesmer/specializations/mirage/mechanics/trigger-points.js';
import { MESMER_MIRAGE_AMBUSH_SKILLS } from '#gw2/professions/mesmer/specializations/mirage/skills/index.js';
import { mirageState } from '#gw2/professions/mesmer/specializations/mirage/state.js';
import type {
  MesmerMirageCloakOptions,
  MesmerMirageController
} from '#gw2/professions/mesmer/specializations/mirage/types.js';
import type { MesmerRuntime, MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';
import { canonicalTime, isTimeInWindow } from '#kernel/core/clock.js';

/** Selected catalog profiles supply player and clone ambushes without mutable runtime lookup tables. */
export function mesmerAmbushAttacks(context: MesmerRuntime) {
  return Object.fromEntries(
    Object.entries(MESMER_MIRAGE_AMBUSH_SKILLS).map(([weapon, attack]) => [
      weapon,
      mesmerSelectedAmbush(context.helpers, attack.id)
    ])
  );
}

/**
 * Owns cloak, ambush, and shatter reactions for the registered Mirage module.
 */
export function createMirageMechanics(state: MesmerRuntime): MesmerMirageController {
  const ambushAttacks = mesmerAmbushAttacks(state);
  const cloneAttacks = MESMER_CORE_CLONE_ATTACKS;
  const activePrimaryWeapon = () => gw2ActivePrimaryWeapon(state.config, state.activeWeaponSet === 1 ? 1 : 2) || '';
  // Ground mirrors use exact half-open pickup windows; skill metadata owns any creation delay.
  const createMirrors = (at: number, count: number) => {
    const mirrorSkill = requireSkill(state.helpers, ID.MIRAGE_MIRROR_DAMAGE);
    const mirror = requireEffect(mirrorSkill, 'buff', 'mirage-mirror');

    if (!mirror) return;

    at = canonicalTime(at);
    // Every creation path discards expired mirrors so no expiry task is needed to bound the live collection.
    const owner = mirageState.from(state.profession);
    owner.mirrors = owner.mirrors.filter((mirror) => mirror.expiresAt > at);
    for (let index = 0; index < Math.max(0, count); index += 1) {
      owner.mirrors.push({
        availableAt: at,
        expiresAt: canonicalTime(at + mirror.duration)
      });
    }
  };

  // Executes clone ambush attacks at the specified time, optionally for a given set of clones.
  const executeCloneAmbushes = (
    at: number,
    clones: readonly MesmerClone[] = professionCoreState(state.profession).clones,
    delivery: EffectDelivery = {}
  ) => {
    state.fireTrigger(mirageCloneAmbushRequested, {
      at,

      weapon: activePrimaryWeapon(),
      delivery,
      clones: [...clones],
      ambushAttacks,
      cloneAttacks
    });
  };

  // The selected balance profile sets every ambush window; refresh it without shortening a surviving deadline.
  const grantAmbushWindow = (at: number, source: string, delivery: EffectDelivery = {}) => {
    const duration = balanceNumber(state.helpers, TRAIT.MIRAGE_CLOAK, 'durationPerTier');
    at = canonicalTime(at);
    mirageState.from(state.profession).ambushUntil = Math.max(
      mirageState.from(state.profession).ambushUntil,
      canonicalTime(at + duration)
    );
    mirageState.from(state.profession).ambushSource = source;
    {
      const packet = buildMesmerPacket({
        type: 'marker',
        at,
        name: 'Ambush Window',
        detail: `${source} (${duration}s)`
      });
      state.effects.emit({
        ...delivery,
        kind: 'packet',
        event: packet
      });
    }
  };

  // Grants Mirage Cloak at the specified time
  const grantMirageCloak = (
    at: number,
    source: string,
    { duration = balanceNumber(state.helpers, TRAIT.MIRAGE_CLOAK, 'duration') }: MesmerMirageCloakOptions = {},
    delivery: EffectDelivery = {}
  ) => {
    at = canonicalTime(at);
    grantAmbushWindow(at, source, delivery);
    {
      const packet = buildMesmerPacket({
        type: 'buff',
        at,
        kind: 'mirage-cloak',
        stacks: 1,
        duration,
        sourceSkill: source
      });
      state.effects.emit({
        ...delivery,
        kind: 'packet',
        event: packet
      });
    }

    state.fireTrigger(mirageCloakGranted, { at, source, duration, delivery });
  };

  // Accepted ambushes consume their window and schedule only trait-owned consequences.
  const acceptPlayerAmbush = (skill: MesmerSkill, at: number, castStart = at, delivery: EffectDelivery = {}) => {
    // The ambush keeps the weapon selected when its cast began, even if the
    // rotation swaps weapons before completion mechanics are dispatched.
    const weapon = skill.weapon || activePrimaryWeapon();
    const ambush = ambushAttacks[weapon];

    if (!ambush || skill.id !== ambush.id) return;

    const impactAt = ambush.player.damageAtMs == null ? at : castStart + ambush.player.damageAtMs / 1000;
    state.fireTrigger(mirageAmbushAccepted, { ambush, impactAt, delivery });

    mirageState.from(state.profession).ambushUntil = 0;
    mirageState.from(state.profession).ambushSource = '';
  };

  // Attempts to pick up a Mirage Mirror at the given time, applying damage and granting Mirage Cloak if successful.
  const pickUpMirror = (at: number, skill: MesmerSkill) => {
    const mirrors = mirageState.from(state.profession).mirrors;
    const index = mirrors.findIndex((mirror) => isTimeInWindow(at, mirror.availableAt, mirror.expiresAt));

    if (index < 0) return false;

    mirrors.splice(index, 1);
    const payload = requireSkill(state.helpers, skill.mirrorPayloadSkillId!);
    const pseudo = {
      id: payload.id,
      name: payload.name,
      weapon: activePrimaryWeapon(),
      blade: false
    };
    const strike = requireEffect(payload, 'strike', 'Strike');

    if (strike)
      buildMesmerStrikes(state, pseudo, at, {
        ...strike,
        name: undefined,
        summonKind: undefined,
        source: 'Player'
      }).forEach((packet) => {
        state.effects.emit({
          kind: 'packet',
          event: packet
        });
      });

    // Only a consumed, available mirror applies its authored Weakness.
    const weakness = requireEffect(payload, 'condition', CONDITION.WEAKNESS);

    if (weakness)
      buildMesmerConditions(state, pseudo.name, at, weakness, 'Player', '', {
        skillId: pseudo.id,
        sourceId: pseudo.id,
        actorType: ACTOR.PLAYER
      }).forEach((packet) => {
        state.effects.emit({
          kind: 'packet',
          event: packet
        });
      });

    grantMirageCloak(at, skill.name);
    return true;
  };

  return {
    createMirrors,
    executeCloneAmbushes,
    acceptPlayerAmbush,
    grantMirageCloak,
    grantAmbushWindow,
    pickUpMirror
  };
}

/** Gates mirror pickups on an available mirror and ambushes on an active or queued ambush window. */
export function mirageAvailability(context: MechanicQueriesOf<MesmerRuntime>, skill: MesmerSkill): AvailabilityResult {
  // Explicit IDs must obey the same weapon replacement as the palette.
  if (NON_MIRAGE_AXE_SKILL_IDS.has(skill.id)) {
    return denySkillCast(skill, 'mesmer.mirage-axe-replaced', 'Mirage replaces this axe skill.');
  }

  if (skill.id === ID.PICK_UP_MIRAGE_MIRROR) {
    const mirrors = mirageState.from(context.profession).mirrors;

    if (mirrors.some((mirror) => isTimeInWindow(context.time, mirror.availableAt, mirror.expiresAt))) {
      return { ready: true };
    }

    // A queued mirror-creation trigger is a valid retry boundary even though
    // the mirror does not enter specialization state until that task executes.
    const retryAt = Math.min(
      ...mirageState.from(context.profession).pendingMirrors.map((mirror) => mirror.at),
      ...mirrors.filter((mirror) => mirror.expiresAt > context.time).map((mirror) => mirror.availableAt)
    );
    return {
      ready: false,
      retryAt: Number.isFinite(retryAt) ? retryAt : null,
      code: 'mesmer.mirage-mirror',
      reason: 'No Mirage Mirror is available to pick up.'
    };
  }

  if (!skill.ambush) return { ready: true };

  // Eligibility needs selected weapon identity and committed windows, not illusion controllers.
  const weapon = gw2ActivePrimaryWeapon(context.config, context.activeWeaponSet === 1 ? 1 : 2) || '';
  const activeAmbush = MESMER_MIRAGE_AMBUSH_SKILLS[weapon];
  const state = mirageState.from(context.profession);
  // Accepted cast occupancy can preserve admission; a later wait cannot extend that entitlement.
  const queuedAmbush = state.ambushCastWindows.some(
    (cast) => cast.start < state.ambushUntil && cast.start < context.time && cast.laneEnd >= context.time
  );

  if (
    activeAmbush &&
    activeAmbush.id === skill.id &&
    state.ambushSource &&
    (state.ambushUntil > context.time || queuedAmbush)
  ) {
    return { ready: true };
  }

  return {
    ready: false,
    retryAt: null,
    code: 'mesmer.ambush',
    reason: `${skill.name} has no active Mirage Cloak ambush window.`
  };
}

/** Binds shared endurance operations to this module's live pool and balance rules. */
export const mirageEndurance: EndurancePolicy<MesmerRuntime> = {
  state: (context) => mirageState.from(context.profession).endurance,
  maximum: () => ENDURANCE.maximum,
  regenerationRate: (_context, vigor) => enduranceRegenerationRate(vigor)
};

/** Materialize admitted clone ambushes under their captured weapon and clone ownership. */
export function executeMirageCloneAmbushPackets(
  state: MesmerRuntime,
  {
    at,
    clones,
    weapon: activeWeapon,
    delivery,
    ambushAttacks,
    cloneAttacks
  }: TriggerPointInput<typeof mirageCloneAmbushRequested>
): void {
  for (const clone of clones) {
    const weapon = clone.weapon || activeWeapon;
    const ambush = ambushAttacks[weapon];

    if (!ambush) continue;

    const attack = cloneAttacks[weapon] || cloneAttacks.Sword;
    // Keep catalog identity on summon packets so ownership, rather than a synthetic skill ID, separates actors.
    const pseudo = {
      id: ambush.id,
      name: ambush.name,
      weapon,
      blade: false
    };
    // Explicit summon ownership keeps clone ambush packets independent of their display labels.
    const impactAt = at + (ambush.clone.castTimeMs || 0) / 1000;
    // Clone ambushes use the weapon's authored control and retain summon ownership.
    const skill = state.helpers.skillsById.get(ambush.id);
    for (const effect of skill?.effects || []) {
      if (effect.type !== 'control') continue;

      for (const application of materializeSkillEffectApplications({
        skill: skill!,
        effect,
        start: at,
        fullEnd: impactAt,
        baseEvent: {
          source: 'Clone',
          sourceId: ambush.id,
          skillId: ambush.id,
          skillName: ambush.name,
          actorType: ACTOR.SUMMON,
          summonKind: 'clone',
          metadata: { cloneId: clone.id }
        }
      })) {
        const packet = buildMesmerPacket({ ...application.event, summonKind: 'clone' });
        state.effects.emit({
          ...delivery,
          kind: 'packet',
          event: packet
        });
      }
    }

    if (ambush.clone.type === 'strike')
      buildMesmerStrikes(
        state,
        pseudo,
        ambush.clone.ticks?.length ? at : impactAt,
        {
          ...(ambush.clone.ticks?.length
            ? {
                ticks: ambush.clone.ticks,
                timingAnchor: 'castStart' as const,
                timingScale: 'fixed' as const
              }
            : {
                ...ambush.clone,
                name: undefined,
                summonKind: undefined
              }),
          source: 'Clone',
          // Materialize clone strength as part of the strike so it cannot fall back to player weapon strength.
          weaponStrength: attack.weaponStrength
        },
        {
          metadata: { cloneId: clone.id },
          source: 'Clone',
          actorType: ACTOR.SUMMON,
          summonKind: 'clone',
          name: `${ambush.name} - Clone`
        }
      ).forEach((packet) => {
        state.effects.emit({
          ...delivery,
          kind: 'packet',
          event: packet
        });
      });

    for (const condition of ambush.clone.conditions || []) {
      buildMesmerConditions(state, `${ambush.name} - Clone`, impactAt, condition, 'Clone', '', {
        metadata: { cloneId: clone.id },
        skillId: ambush.id,
        actorType: ACTOR.SUMMON,
        summonKind: 'clone'
      }).forEach((packet) => {
        state.effects.emit({
          ...delivery,
          kind: 'packet',
          event: packet
        });
      });
    }

    if (ambush.clone.boons?.length) {
      // Emit the clone's complete boon yield together under its delivery owner.
      state.effects.emit({
        ...delivery,
        ...mirageCloneBoonRequest(impactAt, ambush.clone.boons, ambush, clone.id)
      });
    }
  }
}

/** Retain only occupancy that can still affect the next command, including its exact completion boundary. */
function retireMirageCastWindows(runtime: MesmerRuntime): void {
  const state = mirageState.from(runtime.profession);
  state.ambushCastWindows = state.ambushCastWindows.filter((cast) => cast.laneEnd >= runtime.time);
}

/** Register mirror creation against its accepted activation before the engine enqueues the authored task. */
function registerMirageMirrors(runtime: MesmerRuntime, cast: RuntimeCast<MesmerSkill>): void {
  const state = mirageState.from(runtime.profession);
  for (const taskDefinition of cast.skill.tasks ?? []) {
    if (taskDefinition.type !== 'mesmer.mirage.create-mirror') continue;

    state.pendingMirrors.push({
      activationId: cast.id,
      at: skillTaskAt(cast, taskDefinition, runtime.time)
    });
  }
}

/** A creation task consumes its own admission; another activation cannot retire or reuse it. */
function resolveMirageMirror(runtime: MesmerRuntime, { cast, taskDefinition }: SkillTaskData<MesmerSkill>): void {
  const state = mirageState.from(runtime.profession);
  const index = state.pendingMirrors.findIndex(
    (mirror) => mirror.activationId === cast.id && mirror.at === runtime.time
  );

  if (index < 0) return;

  state.pendingMirrors.splice(index, 1);
  createMirageMechanics(runtime).createMirrors(runtime.time, taskDefinition.count ?? 1);
}

/** Keep ambush admission, mirror creation, and cloak tasks with the state transitions they govern. */
export const mirageActionLifecycle: RuntimeHooks<MesmerRuntimeState, MesmerSkill> = {
  resolveInputControl(_context, skill) {
    // Walking through a mirror adds no discrete key press.
    return skill.id === ID.PICK_UP_MIRAGE_MIRROR ? null : undefined;
  },
  initialize(runtime) {
    runtime.fireTrigger(mirageInitialized);
  },
  endurance: mirageEndurance,
  availability: mirageAvailability,
  onCastStart(runtime, cast) {
    retireMirageCastWindows(runtime);
    mirageState.from(runtime.profession).ambushCastWindows.push({ start: cast.start, laneEnd: cast.laneEnd });

    if (cast.skill.ambush && !cast.cancelledBeforeCommit)
      createMirageMechanics(runtime).acceptPlayerAmbush(
        cast.skill,
        cast.fullEnd,
        cast.start,
        mesmerCastDelivery(cast, cast.skill)
      );
  },
  onCastCommit(runtime, cast) {
    retireMirageCastWindows(runtime);

    // Existing clones receive Illusionary Ambush before Self-Deception can replace the oldest clone.
    if (cast.skill.id === ID.ILLUSIONARY_AMBUSH && !hasTrait(runtime, TRAIT.INFINITE_HORIZON)) {
      executeMirageCloneAmbushPackets(runtime, {
        at: runtime.time,
        clones: [...professionCoreState(runtime.profession).clones],
        weapon: mesmerActivePrimaryWeapon(runtime),
        delivery: mesmerCastDelivery(cast, cast.skill),
        ambushAttacks: mesmerAmbushAttacks(runtime),
        cloneAttacks: MESMER_CORE_CLONE_ATTACKS
      });
    }

    runtime.fireTrigger(mirageCastCommitted, {
      cast,
      at: runtime.time,
      currentResource: professionCoreState(runtime.profession).clones.length,
      weapon: mesmerActivePrimaryWeapon(runtime)
    });
    registerMirageMirrors(runtime, cast);
  },
  onCastCancel(runtime, cast) {
    retireMirageCastWindows(runtime);
    const state = mirageState.from(runtime.profession);
    state.pendingMirrors = state.pendingMirrors.filter((mirror) => mirror.activationId !== cast.id);
  },
  tasks: {
    'mesmer.mirage.ambush-clone'(runtime, data) {
      const { cast } = data as SkillTaskData<MesmerSkill>;
      createMesmerIllusionRewards(runtime).queueResources(
        runtime.time,
        1,
        cast.skill.weapon || mesmerActivePrimaryWeapon(runtime),
        cast.skill.name,
        { sourceSkillId: cast.skill.id }
      );
    },
    'mesmer.mirage.create-mirror'(runtime, data) {
      resolveMirageMirror(runtime, data as SkillTaskData<MesmerSkill>);
    },
    'mesmer.mirage.grant-cloak'(runtime, data) {
      const { cast } = data as SkillTaskData<MesmerSkill>;
      createMirageMechanics(runtime).grantMirageCloak(runtime.time, cast.skill.name);
    },
    'mesmer.mirage.pick-up-mirror'(runtime, data) {
      createMirageMechanics(runtime).pickUpMirror(runtime.time, (data as SkillTaskData<MesmerSkill>).cast.skill);
    },
    'mesmer.mirage.dodge'(runtime, data) {
      const { cast } = data as SkillTaskData<MesmerSkill>;
      createMirageMechanics(runtime).grantMirageCloak(runtime.time, cast.skill.name);
      runtime.fireTrigger(mesmerEvaded, { at: runtime.time });
    }
  }
};
