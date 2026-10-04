import { attributeProvenance } from '#gw2/platform/builds/attribute-provenance.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { guardianBoonActive } from '#gw2/professions/guardian/core/mechanics/modifier-queries.js';
import { guardianTraitIcon } from '#gw2/professions/guardian/core/traits/behavior.js';

import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { MANTRAS } from '#gw2/professions/guardian/data/mantra-definitions.js';

import { isInternalCooldownReady } from '#gw2/platform/combat/procs.js';
import { firebrandState } from '#gw2/professions/guardian/specializations/firebrand/state.js';
import type { GuardianBuild, GuardianSkill } from '#gw2/professions/guardian/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

const refundByCast = new WeakMap<RuntimeCast<GuardianSkill>, number>();

/** Counts accepted pages and grants earned refunds even after the tome session ends. */
export const swiftScholar = defineTrait({
  id: TRAIT.SWIFT_SCHOLAR,
  name: 'Swift Scholar',
  balance: {
    minimumStacks: 3,
    resourceGain: 1,
    effects: [{ type: 'boon', name: 'quickness', boon: 'quickness', stacks: 1, duration: 3 }]
  },
  hooks: {
    onCastStart(runtime, cast) {
      if (!cast.skill.tome || cast.cancelled) return;
      const state = firebrandState.from(runtime);
      if (state.swiftScholarTome !== cast.skill.tome) {
        state.swiftScholarTome = String(cast.skill.tome);
        state.swiftScholarCount = 0;
      }

      state.swiftScholarCount++;
      const profile = requireBalanceProfileFromContext(runtime, TRAIT.SWIFT_SCHOLAR);
      if (state.swiftScholarCount >= balanceProfileNumber(profile, 'minimumStacks')) {
        state.swiftScholarCount = 0;
        // A later concurrent stow cannot revoke the refund already earned by this accepted page.
        refundByCast.set(cast, balanceProfileNumber(profile, 'resourceGain'));
      }
    },
    onCastCommit(runtime, cast) {
      const skill = cast.skill;
      if (!skill.tome) return;
      const refund = refundByCast.get(cast) ?? 0;
      if (refund > 0) {
        runtime.resourceController.grant('tomePages', refund);
        {
          runtime.effects.emit({
            kind: 'announcement',
            announcement: {
              type: 'trait',
              name: 'Swift Scholar',
              at: runtime.time,
              sourceSkill: skill.name,
              detail: `+${refund} tome pages`,
              icon: guardianTraitIcon(TRAIT.SWIFT_SCHOLAR)
            }
          });
        }
      }
    }
  }
});

/** Each completed page grants the boon associated with its tome. */
export const legendaryLore = defineTrait({
  id: TRAIT.LEGENDARY_LORE,
  name: 'Legendary Lore',
  balance: {
    effects: [
      { type: 'boon', name: 'might', boon: 'might', stacks: 2, duration: 10 },
      { type: 'boon', name: 'regeneration', boon: 'regeneration', stacks: 1, duration: 6 },
      { type: 'boon', name: 'protection', boon: 'protection', stacks: 1, duration: 4 }
    ]
  },
  hooks: {
    onCastCommit(runtime, cast) {
      const skill = cast.skill;
      if (!skill.tome) return;
      if (hasTrait(runtime, TRAIT.LEGENDARY_LORE)) {
        const boonProfile = requireBalanceProfileFromContext(runtime, TRAIT.LEGENDARY_LORE);
        const selectedBoon = requireEffect(
          boonProfile,
          'boon',
          skill.tome === 'justice' ? 'might' : skill.tome === 'resolve' ? 'regeneration' : 'protection'
        );
        const boonCause = {
          ...guardianCastCause(runtime, cast),
          sourceId: TRAIT.LEGENDARY_LORE,
          name: 'Legendary Lore'
        };
        if (selectedBoon) {
          runtime.effects.emit({
            kind: 'profile',
            profile: boonProfile,
            effects: [selectedBoon],
            attribution: boonCause,
            cause: boonCause,
            transform: (event) => ({ ...boonCause, ...event, audience: { recipients: 'self' } })
          });
        }
      }
    }
  }
});

/** Quickness supplies panel attributes once; runtime rules reconcile actual boon uptime. */
export const imbuedHaste = defineTrait({
  id: TRAIT.IMBUED_HASTE,
  name: 'Imbued Haste',
  balance: {
    attributeBonus: 250
  },
  modifierRules: [
    {
      id: 'guardian.firebrand.imbued-haste-attributes',
      label: 'Imbued Haste',
      target: [
        MODIFIER_TARGET.ATTRIBUTE_CONDITION_DAMAGE,
        MODIFIER_TARGET.ATTRIBUTE_HEALING_POWER,
        MODIFIER_TARGET.ATTRIBUTE_VITALITY
      ],
      operation: 'add',
      amount: (context) => {
        const staticApplied = attributeProvenance(context.config).professionStaticRulesApplied;
        const runtimeActive = guardianBoonActive(context, 'quickness');
        const staticallyActive = staticApplied && Boolean(context.config?.boons?.quickness);
        const imbuedHasteProfile = requireBalanceProfileFromContext(context, TRAIT.IMBUED_HASTE);
        return (
          (Number(runtimeActive) - Number(staticallyActive)) *
          balanceProfileNumber(imbuedHasteProfile, 'attributeBonus')
        );
      }
    }
  ],
  buildAttributes: (_common, { build, balanceContext }) => ({
    attributeEffects: (['Condition Damage', 'Healing Power', 'Vitality'] as const).map((to) => ({
      kind: 'flat' as const,
      to,
      amount: balanceProfileNumber(
        requireBalanceProfileFromContext(balanceContext, TRAIT.IMBUED_HASTE),
        'attributeBonus'
      ),
      feedsConversions: true,
      enabled: (build as GuardianBuild).assumptions?.quickness !== false
    }))
  })
});

/** Accepted heals grant surviving party Quickness before claiming the interval. */
export const liberatorsVow = defineTrait({
  id: TRAIT.LIBERATORS_VOW,
  name: "Liberator's Vow",
  balance: {
    internalCooldown: 7,
    effects: [{ type: 'boon', name: 'quickness', boon: 'quickness', stacks: 1, duration: 2 }]
  },
  hooks: {
    onCastCommit(runtime, cast) {
      const skill = cast.skill;
      if (
        skill.type === 'Heal' &&
        hasTrait(runtime, TRAIT.LIBERATORS_VOW) &&
        isInternalCooldownReady(runtime.time, runtime.procs.deadline('guardian.firebrand.liberatorsVow'))
      ) {
        {
          const boonProfile = requireBalanceProfileFromContext(runtime, TRAIT.LIBERATORS_VOW);
          const selectedBoon = requireEffect(boonProfile, 'boon', 'quickness');
          const boonCause = guardianCastCause(runtime, cast);
          if (selectedBoon) {
            runtime.effects.emit({
              kind: 'profile',
              profile: boonProfile,
              effects: [selectedBoon],
              attribution: boonCause,
              cause: boonCause,
              transform: (event) => ({ ...boonCause, ...event, audience: { recipients: 'party' } })
            });
            {
              runtime.procs.setDeadline(
                'guardian.firebrand.liberatorsVow',
                canonicalTime(
                  runtime.time +
                    balanceProfileNumber(
                      requireBalanceProfileFromContext(runtime, TRAIT.LIBERATORS_VOW),
                      'internalCooldown'
                    )
                )
              );
              {
                runtime.effects.emit({
                  kind: 'announcement',
                  announcement: {
                    type: 'trait',
                    name: "Liberator's Vow",
                    at: runtime.time,
                    sourceSkill: skill.name,
                    detail: 'Quickness',
                    icon: guardianTraitIcon(TRAIT.LIBERATORS_VOW)
                  }
                });
              }
            }
          }
        }
      }
    }
  }
});

/** Final mantra IDs own the proc report; colocated skill rewards precede charge retirement. */
export const weightyTerms = defineTrait({
  id: TRAIT.WEIGHTY_TERMS,
  name: 'Weighty Terms',
  balance: {
    resourceGain: 2,
    effects: [{ type: 'condition', name: 'Slow', condition: 'Slow', stacks: 1, duration: 1.5 }]
  },
  hooks: {
    onCastCommit(runtime, cast) {
      const skill = cast.skill;
      if (hasTrait(runtime, TRAIT.WEIGHTY_TERMS) && MANTRAS.some(({ finalId }) => finalId === skill.id)) {
        const profile = requireBalanceProfileFromContext(runtime, TRAIT.WEIGHTY_TERMS);
        const gain = balanceProfileNumber(profile, 'resourceGain');
        // Skill side effects own the rewards; retain only the existing proc report here.
        {
          runtime.effects.emit({
            kind: 'announcement',
            announcement: {
              type: 'trait',
              name: 'Weighty Terms',
              at: runtime.time,
              sourceSkill: skill.name,
              detail: `+${gain} tome pages`,
              icon: guardianTraitIcon(TRAIT.WEIGHTY_TERMS)
            }
          });
        }
      }
    }
  }
});

/** Delivered Aegis or Stability grants party Quickness on the existing shared interval. */
export const stalwartSpeed = defineTrait({
  id: TRAIT.STALWART_SPEED,
  name: 'Stalwart Speed',
  balance: {
    internalCooldown: 7,
    effects: [{ type: 'boon', name: 'quickness', boon: 'quickness', stacks: 1, duration: 2 }]
  }
});

/** Player controls grant boons while Courage retains its passive through dormancy. */
export const stoicDemeanor = defineTrait({
  id: TRAIT.STOIC_DEMEANOR,
  name: 'Stoic Demeanor',
  balance: {
    effects: [
      { type: 'boon', name: 'resistance', boon: 'resistance', stacks: 1, duration: 2 },
      { type: 'boon', name: 'might', boon: 'might', stacks: 3, duration: 10 }
    ]
  }
});

/** Accepted axe damage grants the surviving Bleeding packet after Ashes consumption. */
export const unrelentingCriticism = defineTrait({
  id: TRAIT.UNRELENTING_CRITICISM,
  name: 'Unrelenting Criticism',
  balance: {
    effects: [
      {
        type: 'condition',
        name: 'Bleeding',
        condition: 'Bleeding',
        stacks: 1,
        duration: 4.5
      }
    ]
  }
});

/** Delivered Quickness grants one allied or self Ashes charge and retains passive Justice. */
export const quickfire = defineTrait({
  id: TRAIT.QUICKFIRE,
  name: 'Quickfire',
  balance: {
    internalCooldown: 7,
    effects: [
      {
        type: 'buff',
        name: 'ashes-of-the-just',
        kind: 'ashes-of-the-just',
        stacks: 1,
        duration: 10
      }
    ]
  }
});

/** Increases the shared page capacity and upgrades the untraited initial default. */
export const archivistOfWhispers = defineTrait({
  id: TRAIT.ARCHIVIST_OF_WHISPERS,
  name: 'Archivist of Whispers',
  balance: { maximumStacks: 8 }
});

/** Shortens the resource controller cadence without creating a second recovery clock. */
export const loremaster = defineTrait({
  id: TRAIT.LOREMASTER,
  name: 'Loremaster',
  balance: {
    pulseInterval: 5
  }
});

export const firebrandTraits = [
  archivistOfWhispers,
  loremaster,
  swiftScholar,
  legendaryLore,
  imbuedHaste,
  liberatorsVow,
  weightyTerms,
  stalwartSpeed,
  stoicDemeanor,
  unrelentingCriticism,
  quickfire
];
