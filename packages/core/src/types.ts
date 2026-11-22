export type Floor = 'clean' | 'wet' | 'pee';

export type OccupantKind =
  | 'plain'
  | 'smelly'
  | 'parent'
  | 'child'
  | 'gap'
  | 'shy'
  | 'splasher'
  | 'outOfOrder';

export interface Occupant {
  kind: OccupantKind;
}

/** A urinal slot; free when `occupant` is null. The floor belongs to every slot. */
export interface Slot {
  floor: Floor;
  occupant: Occupant | null;
}

export type Board = Slot[];

export interface OccupantSpec {
  /** Cost influence at distance 1. */
  weight: number;
  /** Per-step decay of the influence. */
  decayBase: number;
  /** Time penalty (fraction of level time) for tapping the slot. */
  penaltyPct: number;
  /** True for people, false for objects/traps. */
  isPerson: boolean;
}

export interface CostWeights {
  floor: Record<Floor, number>;
  occupants: Record<OccupantKind, OccupantSpec>;
  /** Per-step decay of the floor scent under an occupied slot. */
  floorScentDecay: number;
}
