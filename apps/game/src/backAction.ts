export type BackAction = 'pause' | 'resume' | 'summaryOk' | 'exit';

/** What the system "Wstecz" button does on each screen (spec section 11). */
export function backAction(screen: 'start' | 'play' | 'summary', paused: boolean): BackAction {
  if (screen === 'summary') return 'summaryOk';
  if (screen === 'play') return paused ? 'resume' : 'pause';
  return 'exit';
}
