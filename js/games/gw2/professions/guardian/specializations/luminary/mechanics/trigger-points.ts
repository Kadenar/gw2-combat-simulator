import type { ActionContext } from '#gw2/platform/effects/actions.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import type { GuardianSkill } from '#gw2/professions/guardian/types.js';

/** An accepted Luminary cast, at its start. */
export interface LuminaryCast {
  readonly cast: RuntimeCast<GuardianSkill>;
}

/** Sovereign of Light schedules its detonation before the cast schedules a replacement aura. */
export const luminaryCastStarted = defineTriggerPoint<LuminaryCast>('guardian.luminary-cast-started', [
  TRAIT.SOVEREIGN_OF_LIGHT
]);

/** An accepted radiant weapon equip, at its start. */
export const radiantWeaponDrawn = defineTriggerPoint<LuminaryCast>('guardian.radiant-weapon-drawn', [
  TRAIT.RADIANT_ARMAMENTS
]);

/** A completed Luminary virtue, after the shared virtue rewards. */
export const luminaryVirtueCompleted = defineTriggerPoint<LuminaryCast>('guardian.luminary-virtue-completed', [
  TRAIT.MASTER_AT_ARMS
]);

/** A delayed radiant weapon equip completion. */
export const radiantWeaponEquipped = defineTriggerPoint<LuminaryCast>('guardian.radiant-weapon-equipped', [
  TRAIT.RESPLENDENT_WEAPONRY,
  TRAIT.EMPOWERED_ARMAMENTS,
  TRAIT.ILLUMINATING_INSPIRATION
]);

/** A virtue committed and armed its next weapon entitlement. */
export interface RadiantVirtueArming {
  readonly context: ActionContext;
}

/** Master-at-Arms recharges the matching radiant weapons right after the virtue arms them. */
export const radiantVirtueArmed = defineTriggerPoint<RadiantVirtueArming>('guardian.radiant-virtue-armed', [
  TRAIT.MASTER_AT_ARMS
]);

/** A Light Aura about to replace any live aura. */
export interface LightAuraGrant {
  readonly cause: Gw2ResolverEvent;
}

/** A Luminary source may detonate the old aura before the mechanic installs its replacement. */
export const lightAuraGranting = defineTriggerPoint<LightAuraGrant>('guardian.light-aura-granting', [
  TRAIT.SOVEREIGN_OF_LIGHT
]);
