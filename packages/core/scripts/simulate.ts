import { levelStats } from './stats';
import { PERK_BASE, SCORING } from '../src/config';

console.log('lvl urin pers smel wet pee timeMs  P(hit)  E[delta]  difficulty');
for (let l = 1; l <= 40; l++) {
  const s = levelStats(l);
  console.log(
    [
      String(s.level).padStart(3),
      String(s.urinals).padStart(4),
      String(s.persons).padStart(4),
      String(s.smelly).padStart(4),
      String(s.wet).padStart(3),
      String(s.pee).padStart(3),
      String(s.timeMs).padStart(6),
      s.pHit.toFixed(3).padStart(7),
      s.expDelta.toFixed(2).padStart(9),
      s.difficulty.toFixed(2).padStart(10),
    ].join(' '),
  );
}
console.log(`\nPERK_BASE.skip=${PERK_BASE.skip} SCORING.rewardBest=${SCORING.rewardBest}`);
