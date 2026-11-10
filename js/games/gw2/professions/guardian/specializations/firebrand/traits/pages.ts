/** Shared page-session rewards retain their cast ownership through tome stows. */
import { advanceCounter } from '#gw2/platform/combat/resources/counters.js';
import { BOON, RECIPIENT } from '#gw2/platform/constants.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { balanceProfileNumber, requireBalanceProfile, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import { guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { guardianTraitIcon } from '#gw2/professions/guardian/core/traits/metadata.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import {
  swiftScholarPagesGranted,
  tomeOpened,
  tomeStowed,
  type TomeOpening
} from '#gw2/professions/guardian/specializations/firebrand/mechanics/trigger-points.js';
import { firebrandState } from '#gw2/professions/guardian/specializations/firebrand/state.js';
import type { GuardianRuntime, GuardianSkill } from '#gw2/professions/guardian/types.js';

const refundByCast = new WeakMap<RuntimeCast<GuardianSkill>, number>();

/** Counts accepted pages and grants earned refunds even after the tome session ends. */
export const swiftScholar = defineTrait({
  id: TRAIT.SWIFT_SCHOLAR,
  balance: {
    minimumStacks: 3,
    resourceGain: 1,
    effects: [{ type: 'boon', name: BOON.QUICKNESS, boon: BOON.QUICKNESS, stacks: 1, duration: 3 }]
  },
  // The minor needs no explicit selection, but its rewards still obey trigger isolation; pages remain mechanic-owned.
  triggers: [
    onTriggerPoint(tomeOpened, { requiresSelection: false, run: openSwiftScholarSession }),
    onTriggerPoint(tomeStowed, {
      requiresSelection: false,
      run: (runtime: GuardianRuntime) => resetSwiftScholar(runtime)
    }),
    {
      on: 'castStart',
      requiresSelection: false,
      run(runtime, cast) {
        if (!cast.skill.tome || cast.cancelledBeforeCommit) return;

        const state = firebrandState.from(runtime.profession);

        if (state.swiftScholarTome !== cast.skill.tome) {
          state.swiftScholarTome = cast.skill.tome;
          state.swiftScholarCount = 0;
        }

        const profile = requireBalanceProfile(runtime.helpers, TRAIT.SWIFT_SCHOLAR);
        // Complete this tome's page cycle at acceptance while leaving the earned refund attached to its cast.
        const progress = advanceCounter(
          state.swiftScholarCount,
          1,
          balanceProfileNumber(profile, 'minimumStacks'),
          'reset'
        );
        state.swiftScholarCount = progress.value;

        if (progress.reached) {
          // A later concurrent stow cannot revoke the refund already earned by this accepted page.
          refundByCast.set(cast, balanceProfileNumber(profile, 'resourceGain'));
        }
      }
    }
  ],
  lifetime: {
    // Completing an admitted cycle remains available even when new trait producers are disabled.
    onCastCommit(runtime, cast) {
      const skill = cast.skill;

      if (!skill.tome) return;

      const refund = refundByCast.get(cast) ?? 0;

      if (refund > 0) {
        runtime.resourceController.grant('tomePages', refund);
        // Dependent rewards share the earned refund's completion boundary, including after a stow.
        runtime.fireTrigger(swiftScholarPagesGranted, { cast });

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
});

/** Each completed page grants the boon associated with its tome. */
export const legendaryLore = defineTrait<GuardianSkill>({
  id: TRAIT.LEGENDARY_LORE,
  balance: {
    effects: [
      { type: 'boon', name: BOON.MIGHT, boon: BOON.MIGHT, stacks: 2, duration: 10 },
      { type: 'boon', name: BOON.REGENERATION, boon: BOON.REGENERATION, stacks: 1, duration: 6 },
      { type: 'boon', name: BOON.PROTECTION, boon: BOON.PROTECTION, stacks: 1, duration: 4 }
    ]
  },
  triggers: [
    {
      on: 'castCommit',
      run(runtime, cast) {
        const skill = cast.skill;

        if (!skill.tome) return;

        const boonProfile = requireBalanceProfile(runtime.helpers, TRAIT.LEGENDARY_LORE);
        const selectedBoon = requireEffect(
          boonProfile,
          'boon',
          skill.tome === 'justice' ? BOON.MIGHT : skill.tome === 'resolve' ? BOON.REGENERATION : BOON.PROTECTION
        );
        const boonCause = {
          ...guardianCastCause(runtime, cast),
          sourceId: TRAIT.LEGENDARY_LORE,
          name: 'Legendary Lore'
        };

        if (selectedBoon) {
          emitTraitProfile(runtime, boonProfile.id, boonProfile.id, boonCause, {
            preserveName: true,
            effects: (effect) => effect === selectedBoon,
            attribution: boonCause,
            transform: (event) => ({ ...boonCause, ...event, audience: { recipients: RECIPIENT.SELF } })
          });
        }
      }
    }
  ]
});

/** Tome session changes reset only the counter, never refunds earned by accepted casts. */
function resetSwiftScholar(runtime: GuardianRuntime, virtue?: string): void {
  const state = firebrandState.from(runtime.profession);

  if (virtue === undefined || state.swiftScholarTome !== virtue) {
    state.swiftScholarTome = virtue ?? '';
    state.swiftScholarCount = 0;
  }
}

/** A new tome session restarts the count; a ready opening grants Quickness after the shared virtue rewards. */
function openSwiftScholarSession(runtime: GuardianRuntime, { cast, virtue, ready }: TomeOpening): void {
  resetSwiftScholar(runtime, virtue);

  if (!ready) return;

  const boonProfile = requireBalanceProfile(runtime.helpers, TRAIT.SWIFT_SCHOLAR);
  const selectedBoon = requireEffect(boonProfile, 'boon', BOON.QUICKNESS);
  const boonCause = guardianCastCause(runtime, cast);

  if (!selectedBoon) return;

  emitTraitProfile(runtime, boonProfile.id, boonProfile.id, boonCause, {
    preserveName: true,
    effects: (effect) => effect === selectedBoon,
    attribution: boonCause,
    transform: (event) => ({ ...boonCause, ...event, audience: { recipients: RECIPIENT.SELF } })
  });
  runtime.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'trait',
      name: 'Swift Scholar',
      at: runtime.time,
      sourceSkill: cast.skill.name,
      detail: 'Tome activation',
      icon: guardianTraitIcon(TRAIT.SWIFT_SCHOLAR)
    }
  });
}
