import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import type {
  PreviewControl,
  ProfessionAttributePreviewContext
} from '#gw2/platform/profession-presentation/attribute-preview.js';

/** Assemble owner-declared controls with shared selection checks and patch-aware stack caps. */
export function createPreviewControls(context: ProfessionAttributePreviewContext) {
  const traits = new Map(context.activeTraits.map((trait) => [trait.name, trait]));
  const skills = selectedSkillNameSet(context.build.selectedSkills);
  const controls: PreviewControl[] = [];
  const has = (...names: string[]): boolean => names.some((name) => traits.has(name));
  const add = (control: PreviewControl): void => {
    controls.push(control);
  };

  const trait = (name: string, control: Omit<PreviewControl, 'label' | 'group'>): void => {
    if (has(name)) add({ label: name, group: 'Trait conditionals', ...control });
  };

  return {
    controls,
    has,
    skills,
    add,
    trait,
    maximumStacks(name: string): number {
      return balanceProfileNumber(requireBalanceProfileFromContext(context, traits.get(name)!.id), 'maximumStacks');
    },
    boon(key: string, ...names: string[]): void {
      if (has(...names))
        add({
          key,
          label: key[0].toUpperCase() + key.slice(1),
          group: 'Boons',
          kind: 'boon',
          description: names.filter((name) => has(name)).join(', ')
        });
    },
    buff(name: string, key: string, field: string, description: string, stacked = false): void {
      if (has(name))
        trait(name, { key, kind: 'buff', field, description, max: stacked ? this.maximumStacks(name) : undefined });
    },
    condition(name: string, required: string): void {
      if (has(required))
        add({
          key: `condition:${name}`,
          label: `Target ${name}`,
          group: 'Target conditions',
          kind: 'condition',
          field: name,
          max: name === 'Vulnerability' ? 25 : undefined,
          description: required
        });
    },
    passives(...names: string[]): void {
      for (const name of names)
        if (skills.has(name))
          add({
            key: `passive:${name}`,
            label: name,
            group: 'Other buffs',
            kind: 'passive',
            field: name,
            initial: 1,
            description: 'Passive attributes active'
          });
    },
    targetHealth(...names: string[]): void {
      if (has(...names))
        add({
          key: 'targetHealth',
          label: 'Target health (%)',
          group: 'Trait conditionals',
          kind: 'special',
          scope: ['attributes', 'damage'],
          max: 100,
          initial: 100,
          description: 'Target-health-dependent bonuses'
        });
    },
    playerHealth(names: readonly string[], initial = 100): void {
      if (has(...names))
        add({
          key: 'playerHealth',
          label: 'Player health (%)',
          group: 'Trait conditionals',
          kind: 'special',
          max: 100,
          initial,
          description: names.filter((name) => has(name)).join(', ')
        });
    }
  };
}
