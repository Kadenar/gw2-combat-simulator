import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { buildMesmerPacket, mesmerPacketOwner } from '#gw2/professions/mesmer/core/mechanics/packets.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import { chronomancerState } from '#gw2/professions/mesmer/specializations/chronomancer/state.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { replaceAutoattackChains } from '#gw2/platform/skills/autoattack-chain-controller.js';
/**
 * Chronomancer-owned Continuum Split checkpoints and restoration.
 */
import type { AvailabilityResult, CooldownController } from '#gw2/platform/execution/types.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { MesmerRefreshAmmo } from '#gw2/professions/mesmer/types.js';
import type { MesmerResourceSpendDetails } from '#gw2/professions/mesmer/core/mechanics/resource-types.js';
import type { MesmerShatterResolution } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerContinuumController } from '#gw2/professions/mesmer/specializations/chronomancer/types.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

interface ContinuumControllerOptions {
  readonly state: MesmerRuntime;
  readonly cooldownController: CooldownController;
  readonly unaffectedCooldownIds: ReadonlySet<SkillId>;
  readonly refreshAmmo: MesmerRefreshAmmo;
  readonly consumeResources: (at: number, details?: MesmerResourceSpendDetails) => number;
  readonly triggerShatterTraits: (resolution: MesmerShatterResolution) => void;
  readonly durationPerSource: number;
  readonly bonusDuration?: number;
  readonly scheduleExpiry?: ((at: number) => unknown) | null;
}

export function createContinuumController({
  state,
  cooldownController,
  unaffectedCooldownIds,
  refreshAmmo,
  consumeResources,
  triggerShatterTraits,
  durationPerSource,
  bonusDuration = 0,
  scheduleExpiry = null
}: ContinuumControllerOptions): MesmerContinuumController {
  // Restore the captured Continuum Split resources and cooldowns exactly once,
  // then invalidate the active snapshot and emit its exit reason.
  const restoreContinuum = (at: number, reason: string) => {
    const chronomancer = chronomancerState.from(state);
    const continuum = chronomancer.continuum;
    if (!continuum) return;
    const splitReady = continuum.splitReady;
    const openAt = continuum.openAt;
    cooldownController.restoreCheckpoint(
      continuum.recharge,
      at,
      unaffectedCooldownIds,
      splitReady ? [{ skillId: continuum.splitId, readyAt: at + splitReady - openAt }] : []
    );
    replaceAutoattackChains(state, continuum.autoattackChains);
    cooldownController.refresh(at);
    for (const id of cooldownController.ammoSkillIds()) {
      const ammoSkill = state.helpers.skillsById.get(id);
      if (ammoSkill) refreshAmmo(ammoSkill, at);
    }

    {
      const packet = buildMesmerPacket({
        type: 'marker',
        at,
        name: 'Continuum Shift',
        detail: reason
      });
      state.effects.emit({
        kind: 'packet',
        event: packet,
        owner: mesmerPacketOwner(packet),
        priority: Number(packet.priority ?? 0)
      });
    }

    chronomancer.continuum = null;
  };

  const beginContinuumSplit = (
    skill: MesmerSkill,
    at: number,
    spendDetails: MesmerResourceSpendDetails = {}
  ): MesmerShatterResolution => {
    // Publish Split's exact clone spend against its rotation entry so the timeline can show the standard shatter badge.
    const spent = consumeResources(at, spendDetails);
    // The mechanic selects exclusions; the shared service owns pool representation and earned-work snapshots.
    const recharge = cooldownController.checkpoint(at, unaffectedCooldownIds, skill.id);
    const chronomancer = chronomancerState.from(state);
    // Fragmentation extends the base window once, independently of the number of clones spent.
    const duration = durationPerSource * (spent + 1) + bonusDuration;
    chronomancer.continuum = {
      splitId: skill.id,
      splitReady: cooldownController.readyAt(skill.id),
      openAt: at,
      recharge,
      autoattackChains: { ...professionCoreState(state).autoattackChains },
      expiresAt: at + duration
    };
    scheduleExpiry?.(chronomancer.continuum.expiresAt);
    const resolution: MesmerShatterResolution = {
      skill,
      at,
      spent,
      traitHits: [{ at, count: spent + 1 }],
      delivery: {}
    };
    triggerShatterTraits(resolution);
    {
      const packet = buildMesmerPacket({
        type: 'marker',
        at,
        name: 'Continuum Split',
        detail: `${duration.toFixed(1)}s window`
      });
      state.effects.emit({
        kind: 'packet',
        event: packet,
        owner: mesmerPacketOwner(packet),
        priority: Number(packet.priority ?? 0)
      });
    }

    return resolution;
  };

  return {
    beginContinuumSplit,
    restoreContinuum
  };
}

/** Continuum Shift is castable only while Continuum Split is active. */
export function chronomancerAvailability(
  context: MechanicQueriesOf<MesmerRuntime>,
  skill: MesmerSkill
): AvailabilityResult {
  if (skill.id !== ID.CONTINUUM_SHIFT || chronomancerState.from(context).continuum) {
    return { ready: true };
  }

  return {
    ready: false,
    retryAt: null,
    code: 'mesmer.continuum-inactive',
    reason: `${skill.name} requires an active Continuum Split.`
  };
}
