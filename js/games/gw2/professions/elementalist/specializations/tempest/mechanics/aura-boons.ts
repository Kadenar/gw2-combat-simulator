import { balanceProfileEffectFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { TEMPEST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/tempest/profiles.js';

/** Selects Tempest's aura boon payloads; each phase still owns eligibility, scaling, and reporting. */
export function tempestAuraBoons(context: unknown, trait: 'Invigorating Torrents' | 'Elemental Bastion') {
  const torrents = trait === 'Invigorating Torrents';
  return (torrents ? ['Vigor', 'Regeneration'] : ['Alacrity']).map((name) => {
    const effect = balanceProfileEffectFromContext(
      context,
      torrents ? PROFILE.invigoratingTorrents : PROFILE.elementalBastion,
      'boon',
      0,
      name
    );
    return {
      kind: String(effect?.boon || name).toLowerCase(),
      stacks: Number(effect?.stacks ?? 1),
      duration: Number(effect?.duration ?? (torrents ? 5 : 4))
    };
  });
}
