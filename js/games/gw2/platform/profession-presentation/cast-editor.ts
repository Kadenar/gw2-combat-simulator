/** Profession-owned choices and command edits for the shared choice-and-delay editor. */
import type { CastCommand } from '#gw2/platform/builds/rotation.js';
import type { Gw2SimulationResult } from '#gw2/platform/results/types.js';

export type CastEditorPatch = Partial<Omit<CastCommand, 'type' | 'skillId'>>;

export interface CastEditorPreparation {
  readonly command?: CastCommand;
  /** Each call executes a fresh prefix, optionally followed by one candidate. */
  readonly preview: (command?: CastCommand) => Pick<Gw2SimulationResult, 'events' | 'steps' | 'planningState'>;
  readonly formatTime: (timeMs: number) => string;
}

export interface CastEditorModel {
  readonly heading: string;
  readonly accessibleLabel: string;
  readonly choiceLabel: string;
  readonly choices: readonly {
    readonly id: string;
    readonly label: string;
    readonly disabled?: boolean;
    readonly reason?: string;
  }[];
  readonly selectedChoiceId: string;
  readonly unavailableMessage?: string;
  readonly delay: {
    readonly label: string;
    readonly help: string;
    readonly valueMs: number;
    readonly minimumMs: number;
    readonly stepMs: number;
  };
  /** Null rejects an invalid selection; explicit undefined patch fields clear saved options. */
  readonly apply: (choiceId: string, delayMs: number) => CastEditorPatch | null;
}

/** Recognition is cheap; preview simulations run only when the browser opens the editor. */
export interface ProfessionCastEditor {
  readonly prepare: (context: CastEditorPreparation) => CastEditorModel;
}
