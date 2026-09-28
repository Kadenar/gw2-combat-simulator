import { hasTrait } from '#gw2/platform/combat/state/traits.js';
/** Owns Syncopate's balance values, disable procs, and delayed Drum wave. */
import {
  requireBalanceProfileFromContext,
  requireEffect,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTraitProfile } from '#gw2/platform/profession-definition/balance-profiles.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

export const SYNCOPATE_PROFILE = defineTraitProfile(TRAIT.SYNCOPATE, 'Syncopate', {
  initialDelay: 3,
  effects: [
    { type: 'strike', name: 'Immediate wave', coefficient: 0.75, hits: 1 },
    { type: 'strike', name: 'Delayed wave', coefficient: 1, hits: 1 },
    { type: 'control', name: 'Delayed daze', controlKind: 'daze' }
  ]
});

/** Resolves Syncopate from accepted Troubadour control events. */
export function observeSyncopateEvent(context: MesmerRuntime, event: SimulationEvent): void {
  if (event.type !== 'control') return;
  const runtime = mesmerMechanicsFor(context);
  if (!hasTrait(context, TRAIT.SYNCOPATE)) return;
  const syncopateProfile = requireBalanceProfileFromContext(context, TRAIT.SYNCOPATE);
  const damage = requireEffect(syncopateProfile, 'strike', 'Immediate wave');
  if (!damage) return;

  const skillName = event.skillName || event.name || 'Control effect';
  runtime.addDamage(
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
  );
  runtime.addTraitProc('Syncopate', event.at, skillName);
}

/** The committed heal triggers its immediate wave even when diagnostic proc output is suppressed. */
export function triggerMethodOfMadnessSyncopate(context: MesmerRuntime): void {
  const runtime = mesmerMechanicsFor(context);
  if (!hasTrait(context, TRAIT.SYNCOPATE)) return;
  const damage = requireEffect(requireBalanceProfileFromContext(context, TRAIT.SYNCOPATE), 'strike', 'Immediate wave');
  if (!damage) return;
  runtime.addDamage({ id: 'Syncopate', name: 'Syncopate', weapon: 'Utility', blade: false }, context.time, {
    ...damage,
    name: undefined,
    summonKind: undefined,
    source: 'Player',
    weapon: 'utility'
  });
  runtime.addTraitProc('Syncopate', context.time, 'Lesser Chaos Storm');
}

/** Adds the delayed wave and its daze to player and afterimage Drum impacts when Syncopate is selected. */
export function scheduleSyncopateDrumWave(
  context: MesmerRuntime,
  skill: MesmerSkill,
  damageAt: number,
  source: string,
  actorType: 'player' | 'summon'
): void {
  const runtime = mesmerMechanicsFor(context);
  if (!hasTrait(context, TRAIT.SYNCOPATE)) return;
  const syncopateProfile = requireBalanceProfileFromContext(context, TRAIT.SYNCOPATE);
  const delayedAt = damageAt + balanceProfileNumber(syncopateProfile, 'initialDelay');
  const delayedWave = requireEffect(syncopateProfile, 'strike', 'Delayed wave');
  const daze = requireEffect(syncopateProfile, 'control', 'Delayed daze');
  // The delayed strike and disable survive independently; empty output produces no proc.
  if (!delayedWave && !daze) return;
  if (delayedWave)
    runtime.addDamage(
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
    );
  if (daze)
    runtime.addEvent({
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
  runtime.addTraitProc('Syncopate', delayedAt, skill.name, 'delayed drum wave');
}
