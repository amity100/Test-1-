import type { TrapKind } from '../sim/Traps';

const svg = (body: string): string => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;

/** Vector glyphs for every trap kind (build bar, fortify picker, hit banners). */
export const TRAP_ICON: Record<TrapKind, string> = {
  spikes: svg('<path d="M4 20h16"/><path d="M6 20l2-8 2 8M11 20l2-10 2 10M16 20l1.5-6 1.5 6"/>'),
  flame: svg('<path d="M12 21c-4 0-6.5-2.6-6.5-6 0-2.6 1.6-4.4 3-6 .3 1.6 1.2 2.6 2.5 3.2-.4-2.8.8-6 3.5-8.2 0 3 1.5 4.6 2.8 6.2 1 1.3 1.7 2.7 1.7 4.5 0 3.5-2.8 6.3-7 6.3z"/><path d="M12 21c-1.8 0-3-1.3-3-3 0-1.4 1.2-2.4 2-3.5.8 1.1 2 2.1 2 3.5 0 1.7-1.2 3-1 3z" fill="currentColor" stroke="none"/>'),
  launcher: svg('<path d="M4 20h16"/><path d="M7 17c0-2 10-2 10-4s-10-2-10-4 10-2 10-4"/><path d="M9 7l3-4 3 4"/>'),
  mine: svg('<circle cx="12" cy="14" r="5"/><path d="M12 9V6M8.5 10.5l-2-2M15.5 10.5l2-2M4 20h16"/>'),
  trapdoor: svg('<rect x="4" y="10" width="16" height="6"/><path d="M4 13h16"/><path d="M12 10V4"/><path d="M9 7l3-3 3 3"/>'),
  saw: svg('<path d="M3 20h18"/><circle cx="12" cy="13" r="5"/><path d="M12 5.5v2M17.3 7.7l-1.4 1.4M19.5 13h-2M17.3 18.3l-1.4-1.4M6.7 7.7l1.4 1.4M4.5 13h2M6.7 18.3l1.4-1.4"/><circle cx="12" cy="13" r="1.4" fill="currentColor" stroke="none"/>'),
  pendulum: svg('<path d="M4 4h16"/><path d="M12 4l4 11"/><path d="M13 13l6 2-3 5-5-3z" fill="currentColor"/>'),
  crusher: svg('<path d="M4 3h16"/><path d="M8 3v4M16 3v4"/><rect x="5" y="7" width="14" height="6"/><path d="M7 13l1.5 3M12 13v3M17 13l-1.5 3"/><path d="M4 21h16"/>'),
  turret: svg('<rect x="6" y="14" width="12" height="5"/><path d="M12 14V9"/><path d="M8 9h8"/><path d="M12 9l7-3"/>'),
  gate: svg('<path d="M5 4v16M19 4v16M9 4v16M15 4v16"/><path d="M5 8h14M5 16h14"/>'),
};

export const TRAP_NAME_KEY: Record<TrapKind, string> = {
  spikes: 'trapSpikes',
  flame: 'trapFlame',
  launcher: 'trapLauncher',
  mine: 'trapMine',
  trapdoor: 'trapTrapdoor',
  saw: 'trapSaw',
  pendulum: 'trapPendulum',
  crusher: 'trapCrusher',
  turret: 'trapTurret',
  gate: 'trapGate',
};

/** One plain sentence on what the trap does (fortify picker). */
export const TRAP_DESC_KEY: Record<TrapKind, string> = {
  spikes: 'trapDescSpikes',
  flame: 'trapDescFlame',
  launcher: 'trapDescLauncher',
  mine: 'trapDescMine',
  trapdoor: 'trapDescTrapdoor',
  saw: 'trapDescSaw',
  pendulum: 'trapDescPendulum',
  crusher: 'trapDescCrusher',
  turret: 'trapDescTurret',
  gate: 'trapDescGate',
};

/** Banner shown to the local player when this trap gets them. */
export const TRAP_HIT_KEY: Record<TrapKind, string> = {
  spikes: 'trapHitSpikes',
  flame: 'trapHitFlame',
  launcher: 'trapHitLauncher',
  mine: 'trapHitMine',
  trapdoor: 'trapHitTrapdoor',
  saw: 'trapHitSaw',
  pendulum: 'trapHitPendulum',
  crusher: 'trapHitCrusher',
  turret: 'trapHitTurret',
  gate: 'trapHitGate',
};
