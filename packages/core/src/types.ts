export type Floor = 'clean' | 'wet' | 'pee';

export type Slot =
  | { kind: 'free'; floor: Floor }
  | { kind: 'person'; smelly: boolean };

export type Board = Slot[];

export interface CostWeights {
  floor: Record<Floor, number>;
  smellyMultiplier: number;
  decayBase: number;
}
