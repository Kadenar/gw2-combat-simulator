import { buffActive } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { replaceThiefBuff } from '#gw2/professions/thief/core/mechanics/buffs.js';
import { thiefReworkStruck, type ThiefStrike } from '#gw2/professions/thief/core/mechanics/trigger-points.js';
import { initiatingStrike } from '#gw2/professions/thief/core/rework/mechanics/deft-initiation.js';
import { twinFangs } from '#gw2/professions/thief/core/traits/critical-strikes/index.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

/** Preserve critical damage while requiring a landed flanking hit to earn a refreshable critical-chance window. */
export const twinFangsRework = defineTrait({
  ...twinFangs,
  balance: { ...twinFangs.balance, duration: 0 },
  modifierRules: twinFangs.modifierRules!.map((rule) =>
    rule.id === 'thief.twin-fangs-critical-chance'
      ? {
          ...rule,
          when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && buffActive(context, 'twin-fangs')
        }
      : rule
  ),
  triggers: [
    onTriggerPoint(thiefReworkStruck, {
      run(runtime: ThiefRuntime, { cause }: ThiefStrike) {
        if (!runtime.config.target?.defiant || !initiatingStrike(runtime, cause)) return;

        replaceThiefBuff(
          runtime,
          'twin-fangs',
          balanceNumberFromContext(runtime, TRAIT.TWIN_FANGS, 'duration'),
          TRAIT.TWIN_FANGS,
          'Twin Fangs',
          'Trait'
        );
      }
    })
  ]
});
