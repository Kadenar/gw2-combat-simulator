import type { EffectDelivery } from '#gw2/platform/simulation/effect-emission.js';
import {
  buildMesmerPacket,
  mesmerPacketOwner,
  buildMesmerStrikes,
  buildMesmerConditions
} from '#gw2/professions/mesmer/core/mechanics/packets.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { buildMirageBoon, statusFromEffect } from '#gw2/professions/mesmer/specializations/mirage/mechanics/boons.js';
import { mirageState } from '#gw2/professions/mesmer/specializations/mirage/state.js';
import {
  applyMirageAmbushTraits,
  applyMirageCloakTraits,
  applyMirageShatterTraits,
  beginInfiniteHorizonAmbush
} from '#gw2/professions/mesmer/specializations/mirage/traits/behavior.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import { canonicalTime, EPSILON, isTimeInWindow } from '#kernel/core/clock.js';
/** Mirage-owned cloak, ambush, and deception behavior. */
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { MesmerClone, MesmerCloneAttack } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import { MIRAGE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/mesmer/specializations/mirage/profiles.js';
import type {
  MesmerMirageCloakOptions,
  MesmerMirageController
} from '#gw2/professions/mesmer/specializations/mirage/types.js';
import type { MesmerActivePrimaryWeapon, MesmerAmbushAttack } from '#gw2/professions/mesmer/types.js';

import type { EndurancePolicy } from '#gw2/platform/combat/resources/endurance-policy.js';
import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { denySkillCast } from '#gw2/platform/engine/skills/availability.js';
import { NON_MIRAGE_AXE_SKILL_IDS } from '#gw2/professions/mesmer/data/module-data.js';

interface MirageActionControllerOptions {
  readonly state: MesmerRuntime;
  readonly config: MesmerRuntime['config'];
  readonly ambushAttacks: Readonly<Record<string, MesmerAmbushAttack>>;
  readonly cloneAttacks: Readonly<Record<string, MesmerCloneAttack>>;
  readonly activePrimaryWeapon: MesmerActivePrimaryWeapon;
}

/**
 * Owns Mirage cloak, ambush, and shatter reactions.
 */
export function createMirageActionController({
  state,
  config,
  ambushAttacks,
  cloneAttacks,
  activePrimaryWeapon
}: MirageActionControllerOptions): MesmerMirageController {
  // Ground mirrors use exact half-open pickup windows; skill metadata owns any creation delay.
  const createMirrors = (at: number, count: number) => {
    const mechanicsProfile = requireBalanceProfileFromContext(state, PROFILE.mechanics);
    const mirror = requireEffect(mechanicsProfile, 'buff', 'mirage-mirror');
    if (!mirror) return;
    at = canonicalTime(at);
    // Every creation path discards expired mirrors so no expiry task is needed to bound the live collection.
    const owner = mirageState.from(state);
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
    clones: readonly MesmerClone[] = professionCoreState(state).clones,
    delivery: EffectDelivery = {}
  ) => {
    if (!beginInfiniteHorizonAmbush(state, at, clones.length, activePrimaryWeapon(), delivery)) return;

    for (const clone of clones) {
      const weapon = clone.weapon || activePrimaryWeapon();
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
            actorType: 'summon',
            summonKind: 'clone',
            metadata: { cloneId: clone.id }
          }
        })) {
          const packet = buildMesmerPacket({ ...application.event, summonKind: 'clone' });
          state.effects.emit({
            ...delivery,
            kind: 'packet',
            event: packet,
            owner: mesmerPacketOwner(packet),
            priority: Number(packet.priority ?? 0)
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
            source: 'Clone'
          },
          {
            metadata: { cloneId: clone.id },
            weaponStrength: attack.weaponStrength,
            source: 'Clone',
            actorType: 'summon',
            summonKind: 'clone',
            name: `${ambush.name} — Clone`
          }
        ).forEach((packet) => {
          state.effects.emit({
            ...delivery,
            kind: 'packet',
            event: packet,
            owner: mesmerPacketOwner(packet),
            priority: Number(packet.priority ?? 0)
          });
        });
      for (const condition of ambush.clone.conditions || []) {
        buildMesmerConditions(state, `${ambush.name} — Clone`, impactAt, condition, 'Clone', '', {
          metadata: { cloneId: clone.id },
          skillId: ambush.id,
          actorType: 'summon',
          summonKind: 'clone'
        }).forEach((packet) => {
          state.effects.emit({
            ...delivery,
            kind: 'packet',
            event: packet,
            owner: mesmerPacketOwner(packet),
            priority: Number(packet.priority ?? 0)
          });
        });
      }

      for (const boon of ambush.clone.boons || []) {
        state.effects.emit({
          ...delivery,
          kind: 'packet',
          event: buildMirageBoon(impactAt, boon, `${ambush.name} — Clone`, 'summon')
        });
      }
    }
  };

  // Refresh the exact ambush deadline without shortening an existing window or snapping it to a buff tick.
  const grantAmbushWindow = (
    at: number,
    source: string,
    duration = balanceProfileNumber(requireBalanceProfileFromContext(state, PROFILE.mechanics), 'durationPerTier'),
    delivery: EffectDelivery = {}
  ) => {
    if (config.specialization !== 'Mirage') return;
    at = canonicalTime(at);
    mirageState.from(state).ambushUntil = Math.max(mirageState.from(state).ambushUntil, canonicalTime(at + duration));
    mirageState.from(state).ambushSource = source;
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
        event: packet,
        owner: mesmerPacketOwner(packet),
        priority: Number(packet.priority ?? 0)
      });
    }
  };

  // Grants Mirage Cloak at the specified time
  const grantMirageCloak = (
    at: number,
    source: string,
    {
      duration = balanceProfileNumber(requireBalanceProfileFromContext(state, PROFILE.mechanics), 'durationMultiplier')
    }: MesmerMirageCloakOptions = {},
    delivery: EffectDelivery = {}
  ) => {
    if (config.specialization !== 'Mirage') return;
    at = canonicalTime(at);
    grantAmbushWindow(at, source, undefined, delivery);
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
        event: packet,
        owner: mesmerPacketOwner(packet),
        priority: Number(packet.priority ?? 0)
      });
    }

    applyMirageCloakTraits(state, at, source, duration, executeCloneAmbushes, delivery);
  };

  // Accepted ambushes consume their window and schedule only trait-owned consequences.
  const acceptPlayerAmbush = (skill: MesmerSkill, at: number, castStart = at, delivery: EffectDelivery = {}) => {
    // The ambush keeps the weapon selected when its cast began, even if the
    // rotation swaps weapons before completion mechanics are dispatched.
    const weapon = skill.weapon || activePrimaryWeapon();
    const ambush = ambushAttacks[weapon];
    if (!ambush || skill.id !== ambush.id) return;
    const impactAt = ambush.player.damageAtMs == null ? at : castStart + ambush.player.damageAtMs / 1000;
    applyMirageAmbushTraits(state, ambush, impactAt, delivery);

    mirageState.from(state).ambushUntil = 0;
    mirageState.from(state).ambushSource = '';
  };

  // Handles Mirage-only shatter effects after Core resolves the shared shatter packet and resource spend.
  const handleMirageShatter = (skill: MesmerSkill, at: number, spent: number, delivery: EffectDelivery = {}) => {
    applyMirageShatterTraits(state, skill, at, spent, grantAmbushWindow, createMirrors, grantMirageCloak, delivery);
  };

  // Attempts to pick up a Mirage Mirror at the given time, applying damage and granting Mirage Cloak if successful.
  const pickUpMirror = (at: number, skill: MesmerSkill) => {
    const mirrors = mirageState.from(state).mirrors;
    const index = mirrors.findIndex((mirror) => isTimeInWindow(at, mirror.availableAt, mirror.expiresAt));
    if (index < 0) return false;
    mirrors.splice(index, 1);
    const pseudo = {
      id: skill.mirrorPayload!.skillId,
      name: skill.mirrorPayload!.name,
      weapon: activePrimaryWeapon(),
      blade: false
    };
    const mechanicsProfile = requireBalanceProfileFromContext(state, skill.mirrorPayload!.profileId);
    const strike = requireEffect(mechanicsProfile, 'strike', 'Strike');
    if (strike)
      buildMesmerStrikes(state, pseudo, at, {
        ...strike,
        name: undefined,
        summonKind: undefined,
        source: 'Player'
      }).forEach((packet) => {
        state.effects.emit({
          kind: 'packet',
          event: packet,
          owner: mesmerPacketOwner(packet),
          priority: Number(packet.priority ?? 0)
        });
      });
    // Only a consumed, available mirror applies its authored Weakness.
    const weakness = requireEffect(mechanicsProfile, 'condition', 'Weakness');
    if (weakness)
      buildMesmerConditions(state, pseudo.name, at, statusFromEffect(weakness), 'Player', '', {
        skillId: pseudo.id,
        sourceId: pseudo.id,
        actorType: 'player'
      }).forEach((packet) => {
        state.effects.emit({
          kind: 'packet',
          event: packet,
          owner: mesmerPacketOwner(packet),
          priority: Number(packet.priority ?? 0)
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
    handleMirageShatter,
    pickUpMirror
  };
}

/** Gates mirror pickups on an available mirror and ambushes on an active or queued ambush window. */
export function mirageAvailability(context: MesmerRuntime, skill: MesmerSkill): AvailabilityResult {
  // Explicit IDs must obey the same weapon replacement as the palette.
  if (NON_MIRAGE_AXE_SKILL_IDS.has(skill.id)) {
    return denySkillCast(skill, 'mesmer.mirage-axe-replaced', 'Mirage replaces this axe skill.');
  }

  if (skill.id === ID.PICK_UP_MIRAGE_MIRROR) {
    const mirrors = mirageState.from(context).mirrors;
    if (mirrors.some((mirror) => isTimeInWindow(context.time, mirror.availableAt, mirror.expiresAt))) {
      return { ready: true };
    }

    // A queued mirror-creation trigger is a valid retry boundary even though
    // the mirror does not enter specialization state until that task executes.
    const retryAt = Math.min(
      ...mirageState.from(context).pendingMirrorAts,
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
  const runtime = mesmerMechanicsFor(context);
  const activeAmbush = runtime.ambushAttacks[runtime.activePrimaryWeapon()];
  const state = mirageState.from(context);
  // An ambush selected during the preceding cast remains queued through its lockout. A later wait or cooldown
  // cannot extend that queue: the preceding cast must still occupy the lane at this action's start.
  const queuedAmbush = context.history
    .filter((event) => event.type === 'action')
    .some(
      (action) =>
        action.actorType === 'player' &&
        action.at < state.ambushUntil &&
        action.at < context.time - EPSILON &&
        Number(action.castLockoutEndsAt ?? action.endsAt) >= context.time - EPSILON
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
  state: (context) => mirageState.from(context),
  maximum: () => 100,
  regenerationRate: (_context, vigor) => (vigor ? 7.5 : 5)
};
