export interface MesmerTroubadourState {
  numericResource: number;
  instruments: Record<string, number>;
  lastInstrument: string;
}

export interface MesmerProjectedInstrument {
  readonly name: string;
  readonly expiresAt: number;
  readonly remaining: number;
}
