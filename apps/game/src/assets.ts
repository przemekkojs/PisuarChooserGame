/** Phaser-free: the ONLY source of asset paths (relative, Vite base './'). */
export interface AssetManifest {
  images: Record<string, string>;
  sounds: Record<string, string>;
}

/** Image sizes (SVG viewBox, px) used when rasterising; see assets/ASSETS.md. */
export const IMAGE_SIZES: Record<string, { w: number; h: number }> = {
  door: { w: 700, h: 1100 },
  hand: { w: 220, h: 220 },
  urinal: { w: 160, h: 280 },
  floor_wet: { w: 200, h: 60 },
  floor_pee: { w: 200, h: 60 },
  person: { w: 160, h: 420 },
  person_smelly: { w: 160, h: 420 },
  person_child: { w: 160, h: 420 },
  person_parent: { w: 160, h: 420 },
  person_shy: { w: 160, h: 420 },
  person_splasher: { w: 160, h: 420 },
  urinal_oos: { w: 160, h: 280 },
  person_late: { w: 160, h: 420 },
  cleaner: { w: 160, h: 420 },
  shadow: { w: 160, h: 280 },
  bg_wall: { w: 1920, h: 1080 },
  bg_floor: { w: 1920, h: 380 },
  hero: { w: 220, h: 420 },
  hero_wet: { w: 220, h: 420 },
};

export const ASSET_MANIFEST: AssetManifest = {
  images: {
    door: 'assets/door.svg',
    hand: 'assets/hand.svg',
    urinal: 'assets/urinal.svg',
    floor_wet: 'assets/floor_wet.svg',
    floor_pee: 'assets/floor_pee.svg',
    person: 'assets/person.svg',
    person_smelly: 'assets/person_smelly.svg',
    person_child: 'assets/person_child.svg',
    person_parent: 'assets/person_parent.svg',
    person_shy: 'assets/person_shy.svg',
    person_splasher: 'assets/person_splasher.svg',
    urinal_oos: 'assets/urinal_oos.svg',
    person_late: 'assets/person_late.svg',
    cleaner: 'assets/cleaner.svg',
    shadow: 'assets/shadow.svg',
    bg_wall: 'assets/bg_wall.svg',
    bg_floor: 'assets/bg_floor.svg',
    hero: 'assets/hero.svg',
    hero_wet: 'assets/hero_wet.svg',
  },
  sounds: {
    door_open: 'audio/door_open.wav',
    pick_good: 'audio/pick_good.wav',
    pick_bad: 'audio/pick_bad.wav',
    pick_occupied: 'audio/pick_occupied.wav',
    timeout: 'audio/timeout.wav',
    perk: 'audio/perk.wav',
    tick: 'audio/tick.wav',
  },
};
