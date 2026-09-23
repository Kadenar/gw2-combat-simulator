import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/engine/skills/balance-profiles.js';
import { TEMPEST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/tempest/profiles.js';

/** Selects Tempest's aura boon payloads; each phase still owns eligibility, scaling, and reporting. */
export function tempestAuraBoons(context: unknown, trait: 'Invigorating Torrents' | 'Elemental Bastion') {
  const torrents = trait === 'Invigorating Torrents';
  return (torrents ? ['Vigor', 'Regeneration'] : ['Alacrity']).flatMap((name) => {
    const profile = requireBalanceProfileFromContext(
      context,
      torrents ? PROFILE.invigoratingTorrents : PROFILE.elementalBastion
    );
    const effect = requireEffect(profile, 'boon', name);
    if (!effect) return [];
    return [
      {
        kind: String(effect.boon).toLowerCase(),
        stacks: Number(effect.stacks),
        duration: Number(effect.duration)
      }
    ];
  });
}
