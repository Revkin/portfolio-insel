import type { ProjectColor } from './types.ts';

/** Colour palette from docs/SPEC.md, section 3. */
export const PALETTE = {
  nightSky: '#1B1F45',
  deepSea: '#0E2A3A',
  neonCyan: '#3EF2E6',
  neonMagenta: '#FF3FB4',
  violet: '#9B5CFF',
  amber: '#FFB23E',
  lime: '#9DFF4A',
  grassDay: '#6E8F3A',
  pathStone: '#8A8278',
  uiText: '#E6FBFF',
} as const;

export const PROJECT_COLORS: Record<ProjectColor, string> = {
  cyan: PALETTE.neonCyan,
  magenta: PALETTE.neonMagenta,
  violet: PALETTE.violet,
  amber: PALETTE.amber,
  lime: PALETTE.lime,
};
