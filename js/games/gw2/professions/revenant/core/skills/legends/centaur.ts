/** Owns Legendary Centaur Stance skill definitions and their alternate identities. */
import { ACTOR, BOON, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantRuntimeState, RevenantSkill } from '#gw2/professions/revenant/types.js';

export const REVENANT_CENTAUR_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<RevenantSkill>>> = {
  [ID.PROTECTIVE_SOLACE]: {
    name: 'Protective Solace',
    icon: 'https://render.guildwars2.com/file/D5B16367CFE84826CCC80E92EE785F202AE9F200/1013017.png',
    type: 'Utility',
    slot: 'Utility',
    // The parent recharges when its shield is released, rather than while it is active.
    cooldown: 0,
    manualReleaseCooldown: 5,
    energyCost: 5,
    upkeepCost: 8,
    pulseInterval: 1,
    legendId: 'LegendaryCentaur',
    // Custom: Starts/stops upkeep drain and schedules upkeep pulses; see `core/mechanics/upkeep.ts`.
    castTimeMs: 0,
    effects: [],
    // The declaration owns this activation; shared mechanics retain its live state.
    sideEffects: [
      { on: 'castStart', do: { type: 'revenant.reserve-upkeep' } },
      { on: 'castCommit', do: { type: 'revenant.activate-upkeep' } }
    ]
  },
  [ID.NATURAL_HARMONY]: {
    name: 'Natural Harmony',
    icon: 'https://render.guildwars2.com/file/BBF2026B38E6EC7108B44FFA6BB66F0BFF0A7E01/1013015.png',
    type: 'Utility',
    slot: 'Utility',
    cooldown: 2,
    energyCost: 20,
    legendId: 'LegendaryCentaur',
    castTimeMs: 0,
    effects: []
  },
  [ID.ENERGY_EXPULSION]: {
    name: 'Energy Expulsion',
    icon: 'https://render.guildwars2.com/file/47F60D20E87C7A6D5B9E4E5D062F01F2793A1414/1012984.png',
    type: 'Elite',
    slot: 'Elite',
    cooldown: 2,
    energyCost: 35,
    legendId: 'LegendaryCentaur',
    castTimeMs: 0,
    effects: [
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.KNOCKDOWN
      }
    ],
    // Empowered Stability belongs to the cast, independently of the tablet's explosion.
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'revenant.expel-energy',
          id: 'empowered',
          effects: [
            {
              type: 'boon',
              audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
              boon: BOON.STABILITY,
              duration: 5,
              stacks: 3
            }
          ]
        }
      }
    ]
  },
  [ID.DIMINISH_SOLACE]: {
    name: 'Diminish Solace',
    icon: 'https://render.guildwars2.com/file/4A6976DDEC36B5067F6D3CB2615605459E0A94EE/1013007.png',
    type: 'Utility',
    slot: 'Utility',
    cooldown: 0,
    energyCost: 0,
    // Reuse upkeep teardown and availability checks for the matching active shield.
    castTimeMs: 0,
    effects: [],
    // The declaration owns this activation; shared mechanics retain its live state.
    sideEffects: [{ on: 'castCommit', do: { type: 'revenant.release-upkeep' } }]
  },
  [ID.PURIFYING_ESSENCE]: {
    name: 'Purifying Essence',
    icon: 'https://render.guildwars2.com/file/02DEFA14E7A5E925F22C7EB85E7B51364316DE77/1013018.png',
    type: 'Utility',
    slot: 'Utility',
    cooldown: 5,
    energyCost: 25,
    legendId: 'LegendaryCentaur',
    castTimeMs: 0,
    effects: []
  },
  [ID.VENTARIS_WILL]: {
    name: "Ventari's Will",
    icon: 'https://render.guildwars2.com/file/9709A709A80DBD075BDCE5E069C02E720348A740/1012992.png',
    type: 'Heal',
    slot: 'Heal',
    cooldown: 0.25,
    energyCost: 0,
    legendId: 'LegendaryCentaur',
    castTimeMs: 0,
    effects: []
  },
  [ID.PROJECT_TRANQUILITY]: {
    name: 'Project Tranquility',
    icon: 'https://render.guildwars2.com/file/01BC005B3C1F590D7075523EEA27361D31D69803/1012988.png',
    type: 'Heal',
    slot: 'Heal',
    cooldown: 2,
    energyCost: 0,
    legendId: 'LegendaryCentaur',
    castTimeMs: 0,
    effects: []
  }
};

/** Invoking Ventari summons the tablet and empowers the next qualifying skill. */
export function invokeCentaur(runtime: RevenantRuntime): void {
  runtime.profession.core.tranquil = runtime.profession.core.activeLegendId === 'LegendaryCentaur';

  if (runtime.profession.core.tranquil) runtime.armFlip(ID.VENTARIS_WILL);
}

/** Only unempowered Harmony, Essence, and Expulsion rearm Tranquil; the tablet survives every use. */
export const centaurLifecycle: RuntimeHooks<RevenantRuntimeState, RevenantSkill> = {
  initialize: invokeCentaur,
  sideEffectHandlers: {
    'revenant.expel-energy'(runtime, context) {
      if (context.kind !== 'cast') return;

      const cast = context.cast;

      if (runtime.profession.core.tranquil) {
        const action = requireSkillAction(cast.skill, 'empowered');
        runtime.effects.emit({
          kind: 'profile',
          profile: cast.skill,
          effects: action.effects,
          at: runtime.time,
          attribution: {
            source: 'revenant',
            sourceId: cast.skill.id,
            actorType: ACTOR.PLAYER,
            skillId: cast.skill.id,
            skillName: cast.skill.name,
            activationId: cast.id
          }
        });
      }

      runtime.profession.core.tranquil = !runtime.profession.core.tranquil;
    }
  },
  onCastCommit(runtime, cast) {
    const state = runtime.profession.core;

    if (cast.skill.id === ID.PROJECT_TRANQUILITY) {
      state.tranquil = true;
      runtime.armFlip(ID.VENTARIS_WILL);
    } else if (cast.skill.id === ID.NATURAL_HARMONY || cast.skill.id === ID.PURIFYING_ESSENCE) {
      state.tranquil = !state.tranquil;
    } else if (cast.skill.id === ID.PROTECTIVE_SOLACE) {
      state.tranquil = false;
    }
  }
};
