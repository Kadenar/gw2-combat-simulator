import type { Gw2AttributeContext, Gw2AttributeContributions } from '#gw2/platform/builds/types.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';

/** Wellspring uses a pet's captured Power plus its own Might; unsnapshotted queries read accumulated Power. */
export function wellspringPetAttributes(context: Gw2AttributeContext): Gw2AttributeContributions {
  const multiplier = balanceProfileNumber(
    requireBalanceProfileFromContext(context, TRAIT.WELLSPRING),
    'attributeConversion'
  );
  const base = Number(context.event?.summonBasePower);
  if (!Number.isFinite(base) || base <= 0)
    return { transforms: [{ kind: 'convert-current', from: 'power', to: 'healingPower', multiplier }] };
  const power = base + (context.query?.mightStacksAt(context.time, context.runtime, context.event) ?? 0) * 30;
  return {
    attributeEffects: [{ kind: 'flat', to: 'Healing Power', amount: power * multiplier, feedsConversions: false }]
  };
}
