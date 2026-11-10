// Explicit test values exercise the reworked contracts independently of live tuning.
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';

export const firebrandTestProfession = withPatchPreview(guardianProfession, {
  id: 'firebrand-test-values',
  label: 'Firebrand test values',
  professions: {
    guardian: {
      provisional: [
        ['imbuedHaste', TRAIT.IMBUED_HASTE, 'conditionDamageIncrease'],
        ['bleedingDamage', TRAIT.UNRELENTING_CRITICISM, 'conditionDamageIncrease'],
        ['bleedingDuration', TRAIT.UNRELENTING_CRITICISM, 'conditionDurationBonus'],
        ['ashesMultiplier', TRAIT.RIGHTEOUS_FLAMES, 'durationMultiplier', undefined, undefined, 1, 5, 0.5, '%'],
        ['ashesDuration', TRAIT.FERVID_CONVICTION, 'duration', 'buff', 'ashes-of-the-just', 1, 10, 0.5, 's'],
        ['ashesStacks', TRAIT.FERVID_CONVICTION, 'stacks', 'buff', 'ashes-of-the-just', 1, 10, 1, 'stacks']
      ].map(([id, profileId, field, type, name, minimum = 0, maximum = 1, step = 0.01, unit = '%']) => ({
        id,
        label: id,
        specialization: 'Firebrand',
        traitId: String(profileId),
        profileId: String(profileId),
        field,
        ...(type ? { effect: { type, name } } : {}),
        minimum,
        maximum,
        step,
        unit
      })),
      balanceProfiles: {
        [TRAIT.IMBUED_HASTE]: { fields: { conditionDamageIncrease: 0.1 } },
        [TRAIT.UNRELENTING_CRITICISM]: { fields: { conditionDamageIncrease: 0.1, conditionDurationBonus: 0.33 } },
        [TRAIT.RIGHTEOUS_FLAMES]: {
          assumption: 'Explicit test tuning.',
          fields: { durationMultiplier: 1.5 }
        },
        [TRAIT.FERVID_CONVICTION]: {
          assumption: 'Explicit test tuning.',
          effects: [{ type: 'buff', name: 'ashes-of-the-just', kind: 'ashes-of-the-just', stacks: 1, duration: 10 }]
        },
        [TRAIT.STALWART_SPEED]: {
          effects: [
            {
              type: 'boon',
              name: 'quickness',
              boon: 'quickness',
              stacks: 1,
              duration: 2,
              audience: { recipients: 'party', maximumRecipients: 5 }
            }
          ]
        }
      }
    }
  }
});
