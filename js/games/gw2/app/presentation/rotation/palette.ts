import type { ProfessionPaletteGroup, SchedulerRecord, SkillId } from '#gw2/platform/engine/types.js';

export interface AmmoView {
  readonly current?: number;
  readonly maximum?: number;
  readonly pips?: readonly boolean[];
}

export interface PaletteResourceView {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly maximum: number;
}

export interface PaletteStatusIconView {
  readonly icon: string;
  readonly label: string;
  readonly title?: string;
}

export interface PaletteControlView {
  readonly id: string;
  readonly label: string;
  readonly icon?: string;
  readonly title?: string;
  readonly color?: string;
  readonly className?: string;
  readonly active?: boolean;
  readonly pressed?: boolean;
  readonly muted?: boolean;
  readonly badge?: string;
}

export interface PaletteSkillView extends SchedulerRecord {
  readonly name?: string;
  readonly skillId?: SkillId | null;
  readonly hotkeyAction?: string;
  readonly title?: string;
  readonly icon?: string;
  readonly variantBadge?: string;
  readonly color?: string;
  readonly disabled?: boolean;
  readonly contextDisabled?: boolean;
  readonly concealed?: boolean;
  readonly highlighted?: boolean;
  readonly draggable?: boolean;
  readonly cooldownLabel?: string;
  readonly ammo?: AmmoView | null;
  readonly resource?: PaletteResourceView | null;
  readonly virtual?: boolean;
}

export interface PaletteGroupView {
  readonly id?: string;
  readonly label?: string;
  readonly color?: string;
  readonly className?: string;
  readonly skills?: readonly PaletteSkillView[];
  readonly controls?: readonly PaletteControlView[];
  readonly statusIcon?: PaletteStatusIconView;
}

export interface NormalizedPaletteGroup extends Omit<ProfessionPaletteGroup, 'skillEntries'> {
  readonly skillEntries: SchedulerRecord[];
  readonly reservedSkillIds: readonly number[];
  readonly color: string;
  readonly className: string;
  readonly stackId: string;
  readonly placement: 'profession' | 'weapon-set-1' | 'active-weapon';
  readonly weaponRowLabel: string;
  readonly resourceAnchor: boolean;
  readonly resourceIds: readonly string[];
  readonly resourcePlacement: 'above' | 'beside' | 'below';
}
