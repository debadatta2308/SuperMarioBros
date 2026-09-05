import Phaser from 'phaser';
import { KinematicBody, SOLID_TILES, Tile, WONDER, WORLD } from '../config/Constants';

export interface BumpEvent {
  col: number;
  row: number;
  tile: Tile;
}

/**
 * Tile world with a per-column vertical wave displacement. Collision queries
 * are evaluated against the *displaced* geometry, so during a Wonder event the
 * hitboxes of pipes/terrain move with their visuals.
 */
export class World {
  readonly tile = WORLD.TILE;
  readonly cols = WORLD.COLS;
  readonly rows = WORLD.ROWS;
  readonly widthPx = WORLD.COLS * WORLD.TILE;
  readonly heightPx = WORLD.ROWS * WORLD.TILE;

  private grid: Uint8Array;
  private images = new Map<number, Phaser.GameObjects.Image>();
  private bumps = new Map<number, number>();
  private layer: Phaser.GameObjects.Layer;

  /** 0..1 amplitude scalar for the wonder wave (smoothly tweened). */
  waveAmount = 0;
  waveTime = 0;

  constructor(private scene: Phaser.Scene) {
    this.grid = new Uint8Array(this.cols * this.rows);
    this.layer = scene.add.layer();
    this.layer.setDepth(10);
  }

  // ---------------------------------------------------------------- grid API
  idx(col: number, row: number) {
    return row * this.cols + col;
  }

  get(col: number, row: number): number {
    if (col < 0 || col >= this.cols) return Tile.Hard; // world walls
    if (row < 0) return Tile.Empty;
    if (row >= this.rows) return Tile.Empty; // pits are deadly, not solid
    return this.grid[this.idx(col, row)];
  }

  set(col: number, row: number, t: Tile) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
    const i = this.idx(col, row);
    this.grid[i] = t;
    const existing = this.images.get(i);
    if (existing) {
      existing.destroy();
      this.images.delete(i);
    }
    if (t !== Tile.Empty) {
      const img = this.scene.add.image(col * this.tile, row * this.tile, `tile_${t}`).setOrigin(0);
      this.layer.add(img);
      this.images.set(i, img);
    }
  }

  isSolidTile(t: number) {
    return SOLID_TILES.has(t);
  }

  // ---------------------------------------------------------------- wave
  /** Wonder wave: offset_y = sin(x * 0.05 + time * 3.0) * 16 */
  columnOffset(col: number): number {
    if (this.waveAmount <= 0) return 0;
    const x = col * this.tile;
    return Math.sin(x * WONDER.WAVE_FREQ + this.waveTime * WONDER.WAVE_SPEED) * WONDER.WAVE_AMP * this.waveAmount;
  }

  /** Query solid geometry at a world point, accounting for column displacement. */
  isSolidAt(x: number, y: number): boolean {
    const col = Math.floor(x / this.tile);
    const off = this.columnOffset(col);
    const row = Math.floor((y - off) / this.tile);
    return this.isSolidTile(this.get(col, row));
  }

  tileAt(x: number, y: number): { col: number; row: number; tile: number } {
    const col = Math.floor(x / this.tile);
    const off = this.columnOffset(col);
    const row = Math.floor((y - off) / this.tile);
    return { col, row, tile: this.get(col, row) };
  }

  tileTop(col: number, row: number) {
    return row * this.tile + this.columnOffset(col);
  }
  tileBottom(col: number, row: number) {
    return (row + 1) * this.tile + this.columnOffset(col);
  }

  // ---------------------------------------------------------------- collision
  /**
   * Integrates a body by (vx, vy) * dt with axis-separated AABB resolution.
   * Sets onGround / hitCeiling / hitWall flags and collects tiles struck from below.
   */
  moveAndCollide(b: KinematicBody, dt: number) {
    b.hitCeiling = false;
    b.hitWall = 0;
    b.ceilingTiles.length = 0;
    const wasOnGround = b.onGround;
    b.onGround = false;

    // ---- horizontal
    let nx = b.x + b.vx * dt;
    if (b.vx !== 0) {
      const edgeX = b.vx > 0 ? nx + b.w : nx;
      const samples = this.samplesY(b);
      const STEP = 26; // max auto step-up height (wave column deltas are < 24px)
      const stepLine = b.y + b.h - STEP;
      let blockedHigh = false;
      let blockedLow = false;
      let lowTop = Infinity;
      for (const sy of samples) {
        if (this.isSolidAt(edgeX, sy)) {
          if (sy < stepLine) blockedHigh = true;
          else {
            blockedLow = true;
            const { col, row } = this.tileAt(edgeX, sy);
            lowTop = Math.min(lowTop, this.tileTop(col, row));
          }
        }
      }
      const canStep = wasOnGround && blockedLow && !blockedHigh && lowTop >= stepLine && lowTop < b.y + b.h;
      if (canStep) {
        // walk up small ledges (wiggling terrain) instead of stopping dead
        b.y = lowTop - b.h;
      } else if (blockedHigh || blockedLow) {
        const col = Math.floor(edgeX / this.tile);
        nx = b.vx > 0 ? col * this.tile - b.w - 0.01 : (col + 1) * this.tile + 0.01;
        b.hitWall = b.vx > 0 ? 1 : -1;
        b.vx = 0;
      }
    }
    b.x = nx;

    // ---- vertical
    let ny = b.y + b.vy * dt;
    const samplesX = this.samplesX(b);
    if (b.vy >= 0) {
      // falling / standing: find highest surface intersecting the bottom edge
      const bottom = ny + b.h;
      let best = Infinity;
      for (const sx of samplesX) {
        if (this.isSolidAt(sx, bottom)) {
          const { col, row } = this.tileAt(sx, bottom);
          best = Math.min(best, this.tileTop(col, row));
        }
      }
      if (best !== Infinity) {
        ny = best - b.h;
        b.vy = 0;
        b.onGround = true;
      }
    } else {
      const top = ny;
      let best = -Infinity;
      for (const sx of samplesX) {
        if (this.isSolidAt(sx, top)) {
          const { col, row, tile } = this.tileAt(sx, top);
          best = Math.max(best, this.tileBottom(col, row));
          b.ceilingTiles.push({ col, row });
          void tile;
        }
      }
      if (best !== -Infinity) {
        ny = best + 0.01;
        b.vy = 0;
        b.hitCeiling = true;
      }
    }
    b.y = ny;

    // ---- ground snapping: keeps bodies attached to wiggling terrain
    if (!b.onGround && wasOnGround && b.vy >= 0) {
      const snap = this.groundBelow(b, 24);
      if (snap !== null) {
        b.y = snap - b.h;
        b.onGround = true;
        b.vy = 0;
      }
    }
    // ---- push-out if terrain rose into the body (wave moving upward)
    if (b.onGround || wasOnGround) {
      const probe = b.y + b.h - 1;
      let best = Infinity;
      for (const sx of samplesX) {
        if (this.isSolidAt(sx, probe)) {
          const { col, row } = this.tileAt(sx, probe);
          best = Math.min(best, this.tileTop(col, row));
        }
      }
      if (best !== Infinity && best < b.y + b.h) {
        b.y = best - b.h;
        b.onGround = true;
      }
    }
  }

  /** Highest solid surface directly below the body within maxDist, or null. */
  groundBelow(b: KinematicBody, maxDist: number): number | null {
    let best = Infinity;
    const bottom = b.y + b.h;
    for (const sx of this.samplesX(b)) {
      for (let d = 0; d <= maxDist; d += 4) {
        const py = bottom + d;
        if (this.isSolidAt(sx, py)) {
          const { col, row } = this.tileAt(sx, py);
          best = Math.min(best, this.tileTop(col, row));
          break;
        }
      }
    }
    return best === Infinity ? null : best;
  }

  /** Is there solid geometry within `dist` px above the body's head? */
  ceilingAbove(b: KinematicBody, dist: number): boolean {
    for (const sx of this.samplesX(b)) {
      if (this.isSolidAt(sx, b.y - dist)) return true;
    }
    return false;
  }

  overlapsSolid(x: number, y: number, w: number, h: number): boolean {
    for (let sx = x + 1; sx < x + w; sx += Math.min(16, w - 2)) {
      for (let sy = y + 1; sy < y + h; sy += Math.min(16, h - 2)) {
        if (this.isSolidAt(sx, sy)) return true;
      }
      if (this.isSolidAt(sx, y + h - 1)) return true;
    }
    if (this.isSolidAt(x + w - 1, y + h - 1) || this.isSolidAt(x + w - 1, y + 1)) return true;
    return false;
  }

  private samplesX(b: KinematicBody): number[] {
    const out: number[] = [];
    const inset = 2;
    const n = Math.max(2, Math.ceil(b.w / 14));
    for (let i = 0; i < n; i++) out.push(b.x + inset + ((b.w - inset * 2) * i) / (n - 1));
    return out;
  }
  private samplesY(b: KinematicBody): number[] {
    const out: number[] = [];
    const inset = 3;
    const n = Math.max(2, Math.ceil(b.h / 14));
    for (let i = 0; i < n; i++) out.push(b.y + inset + ((b.h - inset * 2) * i) / (n - 1));
    return out;
  }

  // ---------------------------------------------------------------- block interactions
  bump(col: number, row: number) {
    const i = this.idx(col, row);
    this.bumps.set(i, -10);
  }

  breakBrick(col: number, row: number) {
    this.set(col, row, Tile.Empty);
    const cx = col * this.tile + 16;
    const cy = row * this.tile + this.columnOffset(col) + 16;
    for (let k = 0; k < 4; k++) {
      const p = this.scene.add.image(cx, cy, 'debris').setDepth(30);
      const vx = (k % 2 === 0 ? -1 : 1) * (80 + Math.random() * 100);
      const vy = k < 2 ? -420 : -260;
      this.scene.tweens.add({
        targets: p,
        x: cx + vx,
        y: cy + 300,
        angle: 360 * (k % 2 === 0 ? -1 : 1),
        alpha: 0,
        duration: 700,
        ease: 'Quad.easeIn',
        onUpdate: (tw) => {
          const t = tw.progress;
          p.y = cy + vy * t * 0.7 + 900 * t * t; // fake parabola
        },
        onComplete: () => p.destroy(),
      });
    }
  }

  /** Iterate solid tiles overlapping a rectangle. */
  tilesInRect(x: number, y: number, w: number, h: number, cb: (col: number, row: number, tile: number) => void) {
    const c0 = Math.floor(x / this.tile);
    const c1 = Math.floor((x + w) / this.tile);
    for (let col = c0; col <= c1; col++) {
      const off = this.columnOffset(col);
      const r0 = Math.floor((y - off) / this.tile);
      const r1 = Math.floor((y + h - off) / this.tile);
      for (let row = r0; row <= r1; row++) {
        const t = this.get(col, row);
        if (t !== Tile.Empty) cb(col, row, t);
      }
    }
  }

  // ---------------------------------------------------------------- per-frame
  update(dt: number) {
    if (this.waveAmount > 0) this.waveTime += dt;
    for (const [i, v] of this.bumps) {
      const nv = v + 80 * dt;
      if (nv >= 0) this.bumps.delete(i);
      else this.bumps.set(i, nv);
    }
  }

  /** Sync tile images with displaced geometry. Only visible columns are touched. */
  syncVisuals(cam: Phaser.Cameras.Scene2D.Camera) {
    const c0 = Math.max(0, Math.floor(cam.worldView.x / this.tile) - 2);
    const c1 = Math.min(this.cols - 1, Math.ceil(cam.worldView.right / this.tile) + 2);
    for (let col = c0; col <= c1; col++) {
      const off = this.columnOffset(col);
      for (let row = 0; row < this.rows; row++) {
        const i = this.idx(col, row);
        const img = this.images.get(i);
        if (!img) continue;
        img.y = row * this.tile + off + (this.bumps.get(i) ?? 0);
      }
    }
  }

  // ---------------------------------------------------------------- level authoring helpers
  ground(c0: number, c1: number, topRow = 17) {
    for (let c = c0; c <= c1; c++) {
      this.set(c, topRow, Tile.Grass);
      for (let r = topRow + 1; r < this.rows; r++) this.set(c, r, Tile.Dirt);
    }
  }
  pipe(col: number, height: number, groundRow = 17) {
    const top = groundRow - height;
    this.set(col, top, Tile.PipeTL);
    this.set(col + 1, top, Tile.PipeTR);
    for (let r = top + 1; r < groundRow; r++) {
      this.set(col, r, Tile.PipeBL);
      this.set(col + 1, r, Tile.PipeBR);
    }
  }
  bricks(row: number, c0: number, c1: number) {
    for (let c = c0; c <= c1; c++) this.set(c, row, Tile.Brick);
  }
  stairs(col: number, steps: number, dir: 1 | -1, groundRow = 17) {
    for (let s = 0; s < steps; s++) {
      const c = col + s * dir;
      for (let h = 0; h <= s; h++) this.set(c, groundRow - 1 - h, Tile.Hard);
    }
  }
}
