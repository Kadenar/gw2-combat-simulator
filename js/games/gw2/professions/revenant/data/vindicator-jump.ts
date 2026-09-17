import type { Skill } from '#gw2/platform/engine/skills/types.js';

export const VINDICATOR_AIRBORNE_MS = 600;
export const VINDICATOR_LANDING_MS = 200;

/** Replays a recorded jump from its endurance-spending input through the landing, including overlapping autos. */
export const VINDICATOR_JUMP_SKILL: Skill = Object.freeze({
  id: 23275,
  name: 'Dodge Jump',
  displayName: 'Dodge + Landing',
  icon: 'https://wiki.guildwars2.com/images/b/b2/Dodge.png',
  description:
    '600 ms airborne dodge + 200 ms landing. Endurance is spent at takeoff; the selected dodge effect resolves on landing.',
  type: 'Action',
  slot: 'Action',
  specialization: 'Vindicator',
  handlerId: 'revenant.vindicator-jump',
  castTimeMs: VINDICATOR_AIRBORNE_MS + VINDICATOR_LANDING_MS,
  paletteAction: true,
  hotkeyAction: 'dodge',

  resourceCost: 50,
  cooldown: 0,
  effects: []
});
