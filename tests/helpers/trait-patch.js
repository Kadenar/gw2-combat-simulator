/** Patch registered trait owners so preview fixtures exercise the same composition as live builds. */
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';

export function patchTraitProfession(profession, edit) {
  return withPatchPreview(profession, {
    id: 's4-preview',
    label: 'S4 preview',
    professions: { [profession.id]: edit }
  });
}
