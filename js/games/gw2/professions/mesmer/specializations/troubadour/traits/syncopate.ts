import type { EffectDelivery } from '#gw2/platform/simulation/effect-emission.js';
import {
  buildMesmerStrikes,
  mesmerPacketOwner,
  buildMesmerPacket
} from '#gw2/professions/mesmer/core/mechanics/packets.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerInstrument, MesmerRuntime } from '#gw2/professions/mesmer/types.js';

/** Resolves Syncopate from accepted Troubadour control events. */
export function observeSyncopateEvent(context: MesmerRuntime, event: SimulationEvent): void {
  if (event.type !== 'control') return;
  const runtime = mesmerMechanicsFor(context);
  if (!hasTrait(context, TRAIT.SYNCOPATE)) return;
  const syncopateProfile = requireBalanceProfileFromContext(context, TRAIT.SYNCOPATE);
  const damage = requireEffect(syncopateProfile, 'strike', 'Immediate wave');
  if (!damage) return;

  const skillName = event.skillName || event.name || 'Control effect';
  buildMesmerStrikes(
    runtime.context,
    { id: 'Syncopate', name: 'Syncopate', weapon: 'Utility', blade: false },
    event.at,
    {
      ...damage,
      name: undefined,
      summonKind: undefined,
      source: 'Trait',
      actorType: 'player',
      // A proc caused by a surviving delayed disable inherits that packet's interruption protection.
      persistsAfterInterrupt: event.persistsAfterInterrupt === true,
      weapon: 'utility',
      weaponStrengthProfileId: 'nonweapon.unequipped'
    },
    { source: 'Trait', sourceId: TRAIT.SYNCOPATE, actorType: 'player' }
  ).forEach((packet) => {
    runtime.context.effects.emit({
      kind: 'packet',
      event: packet,
      owner: mesmerPacketOwner(packet),
      priority: Number(packet.priority ?? 0)
    });
  });
  runtime.context.effects.emit({
    kind: 'announcement',
    log: true,
    attribution: { source: 'Trait', sourceId: TRAIT.SYNCOPATE, actorType: 'effect' },
    announcement: { type: 'trait', name: 'Syncopate', at: event.at, sourceSkill: skillName, detail: '' }
  });
}

/** The committed heal triggers its immediate wave even when diagnostic proc output is suppressed. */
export function triggerMethodOfMadnessSyncopate(context: MesmerRuntime): void {
  const runtime = mesmerMechanicsFor(context);
  if (!hasTrait(context, TRAIT.SYNCOPATE)) return;
  const damage = requireEffect(requireBalanceProfileFromContext(context, TRAIT.SYNCOPATE), 'strike', 'Immediate wave');
  if (!damage) return;
  buildMesmerStrikes(
    runtime.context,
    { id: 'Syncopate', name: 'Syncopate', weapon: 'Utility', blade: false },
    context.time,
    {
      ...damage,
      name: undefined,
      summonKind: undefined,
      source: 'Player',
      weapon: 'utility'
    }
  ).forEach((packet) => {
    runtime.context.effects.emit({
      kind: 'packet',
      event: packet,
      owner: mesmerPacketOwner(packet),
      priority: Number(packet.priority ?? 0)
    });
  });
  runtime.context.effects.emit({
    kind: 'announcement',
    log: true,
    attribution: { source: 'Trait', sourceId: TRAIT.SYNCOPATE, actorType: 'effect' },
    announcement: { type: 'trait', name: 'Syncopate', at: context.time, sourceSkill: 'Lesser Chaos Storm', detail: '' }
  });
}

/** Adds the delayed wave and its daze to player and afterimage Drum impacts when Syncopate is selected. */
export function scheduleSyncopateDrumWave(
  context: MesmerRuntime,
  skill: MesmerSkill,
  instrument: MesmerInstrument,
  damageAt: number,
  source: string,
  actorType: 'player' | 'summon',
  delivery: EffectDelivery = {}
): void {
  if (instrument.instrument !== 'Drum') return;
  const runtime = mesmerMechanicsFor(context);
  if (!hasTrait(context, TRAIT.SYNCOPATE)) return;
  const syncopateProfile = requireBalanceProfileFromContext(context, TRAIT.SYNCOPATE);
  const delayedAt = damageAt + balanceProfileNumber(syncopateProfile, 'initialDelay');
  const delayedWave = requireEffect(syncopateProfile, 'strike', 'Delayed wave');
  const daze = requireEffect(syncopateProfile, 'control', 'Delayed daze');
  // The delayed strike and disable survive independently; empty output produces no proc.
  if (!delayedWave && !daze) return;
  if (delayedWave)
    buildMesmerStrikes(
      runtime.context,
      {
        id: 'Syncopate delayed wave',
        name: 'Syncopate',
        weapon: 'Utility',
        blade: false
      },
      delayedAt,
      {
        ...delayedWave,
        name: undefined,
        summonKind: undefined,
        source: 'Trait',
        actorType,
        // The committed Drum owns this delayed projectile even after its animation is interrupted.
        persistsAfterInterrupt: true,
        weaponStrengthProfileId: 'nonweapon.unequipped'
      },
      {
        source: 'Trait',
        sourceId: TRAIT.SYNCOPATE,
        skillId: skill.id,
        actorType,
        damageBreakdownName: 'Syncopate (Delay Wave)',
        name: 'Syncopate — delayed wave'
      }
    ).forEach((packet) => {
      runtime.context.effects.emit({
        ...delivery,
        kind: 'packet',
        event: packet,
        owner: mesmerPacketOwner(packet),
        priority: Number(packet.priority ?? 0)
      });
    });
  if (daze) {
    const packet = buildMesmerPacket({
      type: 'control',
      at: delayedAt,
      skillId: skill.id,
      skillName: 'Syncopate — delayed wave',
      controlKind: daze.controlKind,
      persistsAfterInterrupt: true,
      source,
      sourceId: TRAIT.SYNCOPATE,
      actorType
    });
    runtime.context.effects.emit({
      ...delivery,
      kind: 'packet',
      event: packet,
      owner: mesmerPacketOwner(packet),
      priority: Number(packet.priority ?? 0)
    });
  }

  runtime.context.effects.emit({
    ...delivery,
    kind: 'announcement',
    log: true,
    attribution: { source: 'Trait', sourceId: TRAIT.SYNCOPATE, actorType: 'effect' },
    announcement: {
      type: 'trait',
      name: 'Syncopate',
      at: delayedAt,
      sourceSkill: skill.name,
      detail: 'delayed drum wave'
    }
  });
}

/** Install the accepted-heal consequence after the Troubadour runtime has installed its instrument manifest. */
export function initializeSyncopate(runtime: MesmerRuntime): void {
  mesmerMechanicsFor(runtime).methodOfMadnessCommitted = (at) => runtime.schedule('mesmer.syncopate', at);
}
