/** Owns Syncopate's balance values, disable procs, and delayed Drum wave. */
import {
  balanceProfileEffect,
  balanceProfileEffectFromContext as profileEffect,
  balanceProfileValueFromContext as profileValue
} from '#gw2/platform/combat/state/balance-profiles.js';
import { defineTraitProfile } from '#gw2/platform/profession-definition/balance-profiles.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerRuntimeFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/types.js';
import type { MesmerCastContext, MesmerSchedulerContext } from '#gw2/professions/mesmer/types.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

export const SYNCOPATE_PROFILE = defineTraitProfile(TRAIT.SYNCOPATE, 'Syncopate', {
  initialDelay: 3,
  effects: [
    { type: 'strike', name: 'Immediate wave', coefficient: 0.75, hits: 1 },
    { type: 'strike', name: 'Delayed wave', coefficient: 1, hits: 1 }
  ]
});

/** Resolves Syncopate from Troubadour control and Method of Madness proc events. */
export function observeSyncopateEvent(context: MesmerSchedulerContext, event: SimulationEvent): void {
  const runtime = mesmerRuntimeFor(context);
  if (!runtime.traits.has(TRAIT.SYNCOPATE)) return;
  const damage =
    profileEffect(context, TRAIT.SYNCOPATE, 'strike') ?? balanceProfileEffect(SYNCOPATE_PROFILE, 'strike')!;

  if (event.type === 'control') {
    const skillName = String(event.skillName || event.name || 'Control effect');
    runtime.addDamage(
      { id: 'Syncopate', name: 'Syncopate', weapon: 'Utility', blade: false },
      event.at,
      {
        coefficient: Number(damage.coefficient),
        hits: Number(damage.hits),
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
    return;
  }

  if (event.type !== 'proc' || event.sourceId !== 'Method of Madness') return;
  runtime.addDamage({ id: 'Syncopate', name: 'Syncopate', weapon: 'Utility', blade: false }, event.at, {
    coefficient: Number(damage.coefficient),
    hits: Number(damage.hits),
    source: 'Player',
    weapon: 'utility'
  });
  runtime.addTraitProc('Syncopate', event.at, 'Lesser Chaos Storm');
}

/** Adds the delayed wave and its daze to player and afterimage Drum impacts when Syncopate is selected. */
export function scheduleSyncopateDrumWave(
  context: MesmerCastContext,
  skill: MesmerSkill,
  damageAt: number,
  source: string,
  actorType: 'player' | 'summon'
): void {
  const runtime = mesmerRuntimeFor(context);
  if (!runtime.traits.has(TRAIT.SYNCOPATE)) return;
  const delayedAt =
    damageAt + profileValue(context, TRAIT.SYNCOPATE, 'initialDelay', Number(SYNCOPATE_PROFILE.initialDelay));
  const delayedWave =
    profileEffect(context, TRAIT.SYNCOPATE, 'strike', 1) ?? balanceProfileEffect(SYNCOPATE_PROFILE, 'strike', 1)!;
  runtime.addDamage(
    {
      id: 'Syncopate delayed wave',
      name: 'Syncopate',
      weapon: 'Utility',
      blade: false
    },
    delayedAt,
    {
      coefficient: Number(delayedWave.coefficient),
      hits: Number(delayedWave.hits),
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
  runtime.addEvent({
    type: 'control',
    at: delayedAt,
    skillId: skill.id,
    skillName: 'Syncopate — delayed wave',
    controlKind: 'daze',
    persistsAfterInterrupt: true,
    source,
    sourceId: TRAIT.SYNCOPATE,
    actorType
  });
  runtime.addTraitProc('Syncopate', delayedAt, skill.name, 'delayed drum wave');
}
