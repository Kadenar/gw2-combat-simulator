/** Balance dependencies are mandatory, and skill reads preserve the selected profession's declarations. */
import {
  attributeBonusNumber,
  balanceNumber,
  ownerAttributeBonusNumber,
  requireBalanceProfile,
  requireSkill
} from '#gw2/platform/skills/balance-profiles.js';
import type { CanonicalCatalog } from '#gw2/platform/skills/types.js';
import { firebrandPageTuning } from '#gw2/professions/guardian/specializations/firebrand/traits/page-tuning.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

declare const catalog: CanonicalCatalog<ThiefSkill>;
const selected = requireSkill(catalog, 1);

export const thiefSkill: ThiefSkill = selected;

export const selectedArtifact: ThiefSkill['artifactKind'] = selected.artifactKind;

// @ts-expect-error A balance-dependent helper requires its selected profile source.
firebrandPageTuning({ config: {} });
// @ts-expect-error Enclosing context shapes are not balance sources.
balanceNumber({ catalog }, 1, 'duration');
// @ts-expect-error Opaque callbacks cannot replace an explicit source.
requireBalanceProfile(() => catalog.balanceProfilesById.get(1), 1);
// @ts-expect-error A required skill lookup cannot accept missing maps.
requireSkill({}, 1);

// Profile lookup and resolved-owner reads have distinct, explicit contracts.
attributeBonusNumber(catalog, 1, 'power');
ownerAttributeBonusNumber(selected, 'power');
// @ts-expect-error A resolved owner must use the owner reader, not the catalog reader.
attributeBonusNumber(selected, 'power');
