import Phaser from 'phaser';
import type { InputState } from '../config/Constants';
import { PHYSICS } from '../config/Constants';
import type { PlayerController } from '../player/PlayerController';

export type PowerUpId = 'small' | 'elephant' | 'drill';

export interface IPowerUp {
  readonly id: PowerUpId;
  readonly name: string;
  readonly texture: string;
  /** Multiplier applied to the base 24x40 hitbox. */
  readonly hitboxScale: number;

  onEnter(player: PlayerController): void;
  onExit(player: PlayerController): void;
  /** Return true if the power-up fully handled this step (default movement is skipped). */
  onUpdate(player: PlayerController, dt: number, input: InputState): boolean;
  onAction(player: PlayerController, input: InputState): void;
  /** Optional overlay rendering (trunk arc, drill sparks...). */
  render?(gfx: Phaser.GameObjects.Graphics, player: PlayerController): void;
}

// ------------------------------------------------------------------ Small
export class SmallPowerUp implements IPowerUp {
  readonly id = 'small';
  readonly name = 'Small Mario';
  readonly texture = 'mario_small';
  readonly hitboxScale = 1;
  onEnter() {}
  onExit() {}
  onUpdate() {
    return false;
  }
  onAction() {}
}

// ------------------------------------------------------------------ Elephant
/**
 * Elephant Mario: 1.5x hitbox, action key performs a forward trunk whip arc
 * that breaks bricks and defeats enemies.
 */
export class ElephantPowerUp implements IPowerUp {
  readonly id = 'elephant';
  readonly name = 'Elephant Mario';
  readonly texture = 'mario_elephant';
  readonly hitboxScale = 1.5;

  static readonly WHIP_FRAMES = 14;
  static readonly COOLDOWN_FRAMES = 8;
  private whipTimer = 0;
  private cooldown = 0;
  private whipFacing = 1;
  private hitTiles = new Set<number>();

  onEnter(player: PlayerController) {
    player.flashTint(0xd8d8ff);
  }
  onExit() {
    this.whipTimer = 0;
  }

  onUpdate(player: PlayerController) {
    if (this.cooldown > 0) this.cooldown--;
    if (this.whipTimer > 0) {
      this.whipTimer--;
      const rect = this.whipRect(player);
      // enemies
      player.ctx.hitEnemiesInRect(rect.x, rect.y, rect.w, rect.h, 'whip');
      // blocks
      player.ctx.world.tilesInRect(rect.x, rect.y, rect.w, rect.h, (col, row, tile) => {
        const key = row * 10000 + col;
        if (this.hitTiles.has(key)) return;
        this.hitTiles.add(key);
        player.ctx.onBlockHit(col, row, tile, true);
      });
      if (this.whipTimer === 0) this.cooldown = ElephantPowerUp.COOLDOWN_FRAMES;
    }
    return false;
  }

  onAction(player: PlayerController) {
    if (this.whipTimer > 0 || this.cooldown > 0 || player.burrowed) return;
    this.whipTimer = ElephantPowerUp.WHIP_FRAMES;
    this.whipFacing = player.facing;
    this.hitTiles.clear();
    player.ctx.audio.play('whip');
    // little forward lunge + anticipation stretch
    player.body.vx += this.whipFacing * 40;
    player.squashStretch(1.15, 0.9);
  }

  get isWhipping() {
    return this.whipTimer > 0;
  }

  private whipRect(player: PlayerController) {
    const b = player.body;
    const w = 52;
    const h = 40;
    const x = this.whipFacing > 0 ? b.x + b.w - 6 : b.x - w + 6;
    const y = b.y + b.h * 0.25;
    return { x, y, w, h };
  }

  render(gfx: Phaser.GameObjects.Graphics, player: PlayerController) {
    if (this.whipTimer <= 0) return;
    const b = player.body;
    const progress = 1 - this.whipTimer / ElephantPowerUp.WHIP_FRAMES;
    const ox = b.x + b.w / 2 + this.whipFacing * b.w * 0.35;
    const oy = b.y + b.h * 0.42;
    const sweep = Math.sin(progress * Math.PI); // 0→1→0
    const baseAngle = this.whipFacing > 0 ? -Math.PI * 0.6 : Math.PI * 1.6;
    const angle = baseAngle + this.whipFacing * sweep * Math.PI * 0.75;
    const len = 34 + sweep * 22;
    // trunk as thick tapered polyline
    gfx.lineStyle(10, 0x9aa0b8, 1);
    gfx.beginPath();
    gfx.moveTo(ox, oy);
    const mx = ox + Math.cos(angle) * len * 0.5;
    const my = oy + Math.sin(angle) * len * 0.5 + 6;
    const ex = ox + Math.cos(angle) * len;
    const ey = oy + Math.sin(angle) * len;
    gfx.lineTo(mx, my);
    gfx.lineTo(ex, ey);
    gfx.strokePath();
    gfx.fillStyle(0x7c8299, 1);
    gfx.fillCircle(ex, ey, 6);
    // impact arc
    gfx.lineStyle(3, 0xffffff, 0.6 * sweep);
    gfx.beginPath();
    gfx.arc(ox, oy, len + 6, baseAngle, angle, this.whipFacing < 0);
    gfx.strokePath();
  }
}

// ------------------------------------------------------------------ Drill
type BurrowMode = 'none' | 'floor' | 'ceiling';

/**
 * Drill Mario: DOWN + JUMP burrows into the floor, UP + JUMP burrows into the
 * ceiling. While burrowed the player is invulnerable to ground enemies and
 * travels through the terrain; press JUMP to pop out.
 */
export class DrillPowerUp implements IPowerUp {
  readonly id = 'drill';
  readonly name = 'Drill Mario';
  readonly texture = 'mario_drill';
  readonly hitboxScale = 1;

  mode: BurrowMode = 'none';
  private anchorRow = 0;
  private particleTimer = 0;

  onEnter(player: PlayerController) {
    player.flashTint(0xc8ffd8);
  }
  onExit(player: PlayerController) {
    if (this.mode !== 'none') this.surface(player, false);
  }

  onUpdate(player: PlayerController, dt: number, input: InputState) {
    const b = player.body;
    const world = player.ctx.world;

    if (this.mode === 'none') {
      // enter floor
      if (b.onGround && input.down && input.jumpPressed) {
        const g = world.tileAt(b.x + b.w / 2, b.y + b.h + 2);
        if (world.isSolidTile(g.tile)) {
          this.enter(player, 'floor', g.row);
          return true;
        }
      }
      // enter ceiling
      if (input.up && (b.hitCeiling || (input.jumpPressed && world.ceilingAbove(b, 6)))) {
        const c = world.tileAt(b.x + b.w / 2, b.y - 4);
        if (world.isSolidTile(c.tile)) {
          this.enter(player, 'ceiling', c.row);
          return true;
        }
      }
      return false;
    }

    // ---- burrowed movement
    const dir = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    const speed = input.sprint ? PHYSICS.RUN_SPEED : PHYSICS.RUN_SPEED * 0.7;
    b.vx = dir * speed;
    if (dir !== 0) player.facing = dir as 1 | -1;
    b.vy = 0;
    const nx = b.x + b.vx * dt;
    const cx = nx + b.w / 2;
    const col = Math.floor(cx / world.tile);
    const inside = world.isSolidTile(world.get(col, this.anchorRow));
    if (inside) {
      b.x = nx;
    } else {
      b.vx = 0;
    }
    // follow the (possibly waving) terrain
    const colNow = Math.floor((b.x + b.w / 2) / world.tile);
    if (this.mode === 'floor') b.y = world.tileTop(colNow, this.anchorRow) - b.h * 0.35;
    else b.y = world.tileBottom(colNow, this.anchorRow) - b.h * 0.65;

    // dirt particles
    this.particleTimer -= dt;
    if (this.particleTimer <= 0 && Math.abs(b.vx) > 0) {
      this.particleTimer = 0.05;
      player.ctx.spawnDust(b.x + b.w / 2, this.mode === 'floor' ? b.y + b.h * 0.35 : b.y + b.h * 0.65, 0x8b5a2b);
    }

    if (input.jumpPressed) {
      this.surface(player, true);
      return true;
    }
    if (!inside && dir !== 0) {
      // reached end of terrain: pop out
      this.surface(player, false);
    }
    return true;
  }

  onAction() {}

  private enter(player: PlayerController, mode: BurrowMode, row: number) {
    this.mode = mode;
    this.anchorRow = row;
    player.burrowed = true;
    player.body.vy = 0;
    player.body.onGround = false;
    player.isJumping = false;
    player.sprite.setAlpha(0.55);
    player.ctx.audio.play('drill');
    player.squashStretch(1.3, 0.7);
    for (let i = 0; i < 6; i++) player.ctx.spawnDust(player.body.x + Math.random() * player.body.w, mode === 'floor' ? player.body.y + player.body.h : player.body.y, 0x8b5a2b);
  }

  private surface(player: PlayerController, launch: boolean) {
    const b = player.body;
    const world = player.ctx.world;
    const col = Math.floor((b.x + b.w / 2) / world.tile);
    if (this.mode === 'floor') {
      b.y = world.tileTop(col, this.anchorRow) - b.h - 0.5;
      b.vy = launch ? PHYSICS.JUMP_VELOCITY : -260;
      if (launch) {
        player.isJumping = true;
        player.squashStretch(0.8, 1.3);
      }
    } else {
      b.y = world.tileBottom(col, this.anchorRow) + 0.5;
      b.vy = 60;
    }
    this.mode = 'none';
    player.burrowed = false;
    player.sprite.setAlpha(1);
    player.ctx.audio.play('drill');
    for (let i = 0; i < 6; i++) player.ctx.spawnDust(b.x + Math.random() * b.w, b.y + b.h, 0x8b5a2b);
  }

  render(gfx: Phaser.GameObjects.Graphics, player: PlayerController) {
    if (this.mode === 'none') return;
    const b = player.body;
    const t = player.ctx.scene.time.now / 60;
    const cx = b.x + b.w / 2;
    const cy = this.mode === 'floor' ? b.y + b.h * 0.35 : b.y + b.h * 0.65;
    gfx.fillStyle(0xffffff, 0.35 + 0.25 * Math.sin(t));
    gfx.fillEllipse(cx, cy, b.w + 10, 10);
  }
}

export const createPowerUp = (id: PowerUpId): IPowerUp => {
  switch (id) {
    case 'elephant':
      return new ElephantPowerUp();
    case 'drill':
      return new DrillPowerUp();
    default:
      return new SmallPowerUp();
  }
};
