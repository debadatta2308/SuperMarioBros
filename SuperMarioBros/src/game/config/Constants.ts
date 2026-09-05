/**
 * Kinematic constants — all values in px/s or px/s², integrated at a fixed 60 Hz.
 */
export const FIXED_DT = 1 / 60;
export const FIXED_STEP_MS = 1000 / 60;
export const MAX_FRAME_MS = 100; // spiral-of-death guard

export const PHYSICS = {
  RUN_SPEED: 280,
  SPRINT_SPEED: 420,
  GROUND_ACCEL: 1200,
  GROUND_FRICTION: 1400, // also used for skidding
  AIR_ACCEL: 800,
  JUMP_VELOCITY: -620,
  GRAVITY_RISING: 1400, // holding jump while moving up
  GRAVITY_FALLING: 2200, // falling or jump key released
  TERMINAL_VELOCITY: 700,
  COYOTE_FRAMES: 6, // ~100ms
  JUMP_BUFFER_FRAMES: 5, // ~80ms
  HARD_LANDING_VY: 520, // vy above which landing squash triggers
} as const;

export const WORLD = {
  TILE: 32,
  COLS: 236,
  ROWS: 20,
  VIEW_W: 960,
  VIEW_H: 540,
} as const;

export const WONDER = {
  FREEZE_MS: 200,
  WAVE_FREQ: 0.05, // x frequency (per px)
  WAVE_SPEED: 3.0, // rad/s
  WAVE_AMP: 16, // px
  BGM_TEMPO_NORMAL: 128,
  BGM_TEMPO_WONDER: 168,
} as const;

/** Tile IDs stored in the world grid. */
export enum Tile {
  Empty = 0,
  Grass = 1,
  Dirt = 2,
  Brick = 3,
  Question = 4,
  Used = 5,
  Hard = 6,
  PipeTL = 7,
  PipeTR = 8,
  PipeBL = 9,
  PipeBR = 10,
}

export const SOLID_TILES = new Set<number>([
  Tile.Grass,
  Tile.Dirt,
  Tile.Brick,
  Tile.Question,
  Tile.Used,
  Tile.Hard,
  Tile.PipeTL,
  Tile.PipeTR,
  Tile.PipeBL,
  Tile.PipeBR,
]);

export const isPipe = (t: number) => t >= Tile.PipeTL && t <= Tile.PipeBR;

/** Axis-aligned kinematic body used by every moving entity. */
export interface KinematicBody {
  x: number; // left
  y: number; // top
  w: number;
  h: number;
  vx: number;
  vy: number;
  onGround: boolean;
  hitCeiling: boolean;
  hitWall: number; // -1 left, 1 right, 0 none
  ceilingTiles: { col: number; row: number }[];
}

export const createBody = (x: number, y: number, w: number, h: number): KinematicBody => ({
  x,
  y,
  w,
  h,
  vx: 0,
  vy: 0,
  onGround: false,
  hitCeiling: false,
  hitWall: 0,
  ceilingTiles: [],
});

/** Per-fixed-step input snapshot. */
export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  sprint: boolean;
  jumpHeld: boolean;
  jumpPressed: boolean; // edge, consumed by one fixed step
  actionPressed: boolean;
  actionHeld: boolean;
}

export const GAME_EVENTS = {
  HUD: 'hud-update',
  TOAST: 'hud-toast',
} as const;
