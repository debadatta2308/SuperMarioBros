import Phaser from 'phaser';
import { FIXED_DT, FIXED_STEP_MS, GAME_EVENTS, MAX_FRAME_MS, Tile, WORLD } from '../config/Constants';
import { World } from '../world/World';
import { InputManager } from '../input/InputManager';
import { AudioManager } from '../audio/AudioManager';
import { PlayerController, PlayerContext } from '../player/PlayerController';
import { WonderManager } from '../wonder/WonderManager';
import { Enemy, Item, ItemKind, overlaps } from '../entities/Entities';
import { ALL_BADGES } from '../badges/Badges';
import type { IBadge } from '../badges/IBadge';
import type { PowerUpId } from '../powerups/PowerUps';

export interface HudData {
  coins: number;
  deaths: number;
  powerUp: string;
  badge: string;
  badgeDesc: string;
  wonder: string;
  wonderTime: number;
  fps: number;
  vx: number;
  vy: number;
  onGround: boolean;
  muted: boolean;
  won: boolean;
}

export class GameScene extends Phaser.Scene {
  private world!: World;
  private inputMgr!: InputManager;
  private audio!: AudioManager;
  private player!: PlayerController;
  private wonder!: WonderManager;
  private enemies: Enemy[] = [];
  private items: Item[] = [];
  private seed!: Item;
  private flowerPos = { x: 0, y: 0 };
  private questionContents = new Map<number, ItemKind>();
  private parallax: { sprite: Phaser.GameObjects.TileSprite; factor: number }[] = [];
  private accumulator = 0;
  private coins = 0;
  private deaths = 0;
  private won = false;
  private wonderCompleted = false;
  private badgeIndex = 0;
  private badgeFactory: (() => IBadge)[] = ALL_BADGES;
  private spawn = { x: 3 * 32 + 12, y: 17 * 32 };
  private dustPool: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('Game');
  }

  create() {
    this.audio = new AudioManager();
    const unlock = () => this.audio.unlock();
    this.input.on('pointerdown', unlock);
    this.input.keyboard!.on('keydown', unlock);

    this.buildParallax();
    this.world = new World(this);
    this.buildLevel();

    const ctx: PlayerContext = {
      scene: this,
      world: this.world,
      audio: this.audio,
      hitEnemiesInRect: (x, y, w, h, source) => this.hitEnemiesInRect(x, y, w, h, source),
      onBlockHit: (col, row, tile, strong) => this.onBlockHit(col, row, tile, strong),
      spawnDust: (x, y, color) => this.spawnDust(x, y, color),
      onPlayerDied: () => this.respawn(),
      onPowerUpChanged: (id) => this.onPowerUpChanged(id),
    };
    this.player = new PlayerController(ctx, this.spawn.x, this.spawn.y);
    this.equipBadge(0);

    this.wonder = new WonderManager(this, this.world, this.audio);
    this.wonder.on('start', () => this.game.events.emit(GAME_EVENTS.TOAST, '✿ WONDER ✿', 0xffe66d));
    this.wonder.on('active', () => this.seed.sprite.setVisible(true));
    this.wonder.on('end', () => this.seed.sprite.setVisible(false));

    this.inputMgr = new InputManager(this);
    const kb = this.input.keyboard!;
    kb.on('keydown-B', () => this.equipBadge((this.badgeIndex + 1) % this.badgeFactory.length));
    kb.on('keydown-M', () => this.audio.toggleMute());
    kb.on('keydown-R', () => this.restart());
    // debug power-up hotkeys
    kb.on('keydown-ONE', () => this.player.setPowerUp('small'));
    kb.on('keydown-TWO', () => this.player.setPowerUp('elephant'));
    kb.on('keydown-THREE', () => this.player.setPowerUp('drill'));

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.world.widthPx, this.world.heightPx);
    cam.startFollow(this.player.sprite, true, 0.12, 0.1, 0, 40);
    cam.setDeadzone(80, 60);
    cam.setBackgroundColor(0x5ec4ff);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.audio.destroy());
    // UI scene boots one tick later — defer the intro toast so it isn't lost
    this.time.delayedCall(150, () => this.game.events.emit(GAME_EVENTS.TOAST, 'Find the Wonder Flower!  (click to enable audio)', 0xffffff));
  }

  // ---------------------------------------------------------------- level authoring
  private buildLevel() {
    const w = this.world;
    const G = 17 * 32; // ground surface y

    // --- section 1: intro
    w.ground(0, 29);
    w.bricks(13, 10, 14);
    w.set(12, 13, Tile.Question);
    this.questionContents.set(w.idx(12, 13), 'elephant');
    this.coinRow(16, 19, 12);
    this.addEnemy(22 * 32, G);
    this.addEnemy(27 * 32, G);

    // --- pit
    w.ground(34, 59);
    w.pipe(40, 2);
    w.pipe(50, 3);
    this.coinRow(41, 42, 13);
    this.addEnemy(45 * 32, G);
    this.addEnemy(56 * 32, G);

    // --- section 2: bricks + stairs
    w.ground(64, 94);
    w.bricks(12, 70, 76);
    w.set(73, 12, Tile.Question);
    this.questionContents.set(w.idx(73, 12), 'drill');
    this.coinRow(66, 68, 14);
    w.stairs(85, 4, 1);
    w.stairs(92, 4, -1);
    this.coinRow(87, 90, 10);
    this.addEnemy(79 * 32, G);

    // --- section 3: Wonder flower + pipes
    w.ground(98, 129);
    this.addItem('checkpoint', 99 * 32 + 16, G);
    w.set(104, 15, Tile.Hard);
    w.set(104, 16, Tile.Hard);
    this.flowerPos = { x: 104 * 32 + 16, y: 15 * 32 - 6 };
    this.addItem('flower', this.flowerPos.x, this.flowerPos.y);
    w.pipe(111, 3);
    w.pipe(117, 3);
    w.pipe(123, 2);
    this.addEnemy(108 * 32, G);
    this.addEnemy(120 * 32, G);
    this.coinRow(113, 115, 12);

    // --- section 4: wiggle pipe gauntlet + seed
    w.ground(134, 174);
    w.pipe(139, 3);
    w.pipe(146, 3);
    w.pipe(153, 2);
    w.pipe(159, 3);
    w.bricks(12, 165, 170);
    this.coinRow(165, 170, 10);
    this.addEnemy(150 * 32, G);
    this.addEnemy(157 * 32, G);
    this.addEnemy(168 * 32, G);
    this.seed = this.addItem('seed', 172 * 32 + 16, 13 * 32 + 24);
    this.seed.sprite.setVisible(false);

    // --- section 5: drill demo + goal
    w.ground(178, WORLD.COLS - 1);
    w.set(184, 13, Tile.Question);
    this.questionContents.set(w.idx(184, 13), 'coin');
    for (let c = 189; c <= 197; c++) w.set(c, 13, Tile.Hard); // low ceiling for Drill (UP + JUMP)
    this.coinRow(190, 196, 15);
    w.bricks(13, 199, 201);
    w.stairs(205, 6, 1);
    this.addEnemy(187 * 32, G);
    this.addEnemy(202 * 32, G);
    this.addItem('flag', 218 * 32 + 16, G);
  }

  private coinRow(c0: number, c1: number, row: number) {
    for (let c = c0; c <= c1; c++) this.addItem('coin', c * 32 + 16, row * 32 + 26);
  }
  private addEnemy(x: number, groundY: number) {
    this.enemies.push(new Enemy(this, this.world, x, groundY));
  }
  private addItem(kind: ItemKind, x: number, y: number, emerge = false) {
    const it = new Item(this, this.world, kind, x, y, emerge);
    this.items.push(it);
    return it;
  }

  private buildParallax() {
    const add = (key: string, factor: number, y: number, h: number, depth: number) => {
      const s = this.add.tileSprite(0, y, WORLD.VIEW_W, h, key).setOrigin(0).setScrollFactor(0).setDepth(depth);
      this.parallax.push({ sprite: s, factor });
      return s;
    };
    add('bg_sky', 0, 0, 540, -10);
    add('bg_clouds', 0.08, 10, 240, -9);
    add('bg_far', 0.2, 0, 540, -8);
    add('bg_mid', 0.45, 0, 540, -7);
    add('bg_near', 0.7, 0, 540, -6);
  }

  // ---------------------------------------------------------------- badges
  private equipBadge(i: number) {
    this.badgeIndex = i;
    this.player.clearBadges();
    this.player.equipBadge(this.badgeFactory[i]());
    const b = this.player.badges[0];
    this.game.events.emit(GAME_EVENTS.TOAST, `Badge: ${b.name}`, 0x9be7ff);
  }

  // ---------------------------------------------------------------- frame loop
  update(_time: number, delta: number) {
    this.inputMgr.pollFrame();
    this.wonder.update(delta);

    if (!this.wonder.isFrozen && !this.won) {
      this.accumulator += Math.min(delta, MAX_FRAME_MS);
      while (this.accumulator >= FIXED_STEP_MS) {
        this.fixedStep(FIXED_DT);
        this.accumulator -= FIXED_STEP_MS;
      }
    }

    const cam = this.cameras.main;
    this.world.syncVisuals(cam);
    for (const p of this.parallax) {
      p.sprite.tilePositionX = cam.scrollX * p.factor;
      p.sprite.tilePositionY = (cam.scrollY - 100) * p.factor * 0.3;
    }
    this.emitHud();
  }

  /** Deterministic 60 Hz simulation step. */
  private fixedStep(dt: number) {
    const input = this.inputMgr.snapshot();
    this.world.update(dt);
    this.player.update(dt, input);

    const wonderActive = this.wonder.isActive;
    for (const e of this.enemies) e.update(dt, wonderActive);
    this.enemies = this.enemies.filter((e) => !e.destroyed);

    for (const it of this.items) it.update(dt);
    this.items = this.items.filter((it) => !it.collected || it.kind === 'flag' || it.kind === 'checkpoint' || it === this.seed);

    if (this.player.dead) return;
    const pb = this.player.body;

    // ---- enemies
    if (!this.player.burrowed) {
      for (const e of this.enemies) {
        if (!e.alive || !overlaps(pb, e.body)) continue;
        const stomp = pb.vy > 0 && pb.y + pb.h - e.body.y < 16 + pb.vy * dt;
        if (stomp) {
          e.stomp();
          this.player.bounce(input);
          this.audio.play('stomp');
          this.spawnDust(e.body.x + e.body.w / 2, e.body.y + e.body.h, 0xffffff);
        } else {
          this.player.hurt();
        }
      }
    }

    // ---- items
    for (const it of this.items) {
      if (it.collected || it.emerging > 0) continue;
      if (it.kind === 'seed' && !this.wonder.isActive) continue;
      if (!overlaps(pb, it.body)) continue;
      this.collect(it, input);
    }

    // ---- pit death
    if (pb.y > this.world.heightPx + 40) this.player.die();
  }

  private collect(it: Item, input: { jumpHeld: boolean }) {
    void input;
    switch (it.kind) {
      case 'coin':
        this.coins++;
        this.audio.play('coin');
        break;
      case 'elephant':
        this.player.setPowerUp('elephant');
        this.audio.play('powerup');
        this.game.events.emit(GAME_EVENTS.TOAST, 'Elephant Mario! Press Z/K to trunk whip', 0xd8d8ff);
        break;
      case 'drill':
        this.player.setPowerUp('drill');
        this.audio.play('powerup');
        this.game.events.emit(GAME_EVENTS.TOAST, 'Drill Mario! DOWN+JUMP / UP+JUMP to burrow', 0xc8ffd8);
        break;
      case 'flower':
        this.wonder.start();
        break;
      case 'seed': {
        if (this.wonder.state !== 'active') return;
        this.wonderCompleted = true;
        this.wonder.end();
        this.game.events.emit(GAME_EVENTS.TOAST, 'Wonder Seed collected!', 0xffb347);
        // burst effect (seed sprite is reused, so don't destroy it)
        for (let i = 0; i < 12; i++) this.spawnDust(it.body.x + Math.random() * it.body.w, it.body.y + Math.random() * it.body.h, 0xffe66d);
        return;
      }
      case 'checkpoint':
        if (this.spawn.x !== it.body.x + it.body.w / 2) {
          this.spawn = { x: it.body.x + it.body.w / 2, y: it.body.y + it.body.h };
          this.audio.play('coin');
          this.game.events.emit(GAME_EVENTS.TOAST, 'Checkpoint!', 0x4fa3ff);
        }
        it.collected = true;
        return;
      case 'flag':
        this.won = true;
        this.audio.play('goal');
        this.game.events.emit(GAME_EVENTS.TOAST, 'COURSE CLEAR!  Press R to play again', 0xfff05a);
        this.cameras.main.zoomTo(1.25, 1200, 'Sine.easeInOut');
        break;
    }
    it.collect();
  }

  // ---------------------------------------------------------------- context callbacks
  private hitEnemiesInRect(x: number, y: number, w: number, h: number, _source: 'whip' | 'stomp') {
    let n = 0;
    const rect = { x, y, w, h, vx: 0, vy: 0, onGround: false, hitCeiling: false, hitWall: 0, ceilingTiles: [] };
    for (const e of this.enemies) {
      if (!e.alive || !overlaps(rect, e.body)) continue;
      e.whipped(this.player.facing);
      this.audio.play('stomp');
      n++;
    }
    return n;
  }

  private onBlockHit(col: number, row: number, tile: number, strong: boolean) {
    switch (tile) {
      case Tile.Brick:
        if (strong) {
          this.world.breakBrick(col, row);
          this.audio.play('break');
          this.cameras.main.shake(80, 0.003);
        } else {
          this.world.bump(col, row);
          this.audio.play('bump');
        }
        break;
      case Tile.Question: {
        this.world.set(col, row, Tile.Used);
        this.world.bump(col, row);
        const kind = this.questionContents.get(this.world.idx(col, row)) ?? 'coin';
        const cx = col * 32 + 16;
        const top = this.world.tileTop(col, row);
        if (kind === 'coin') {
          this.coins++;
          this.audio.play('coin');
          const c = this.add.image(cx, top - 4, 'coin').setOrigin(0.5, 1).setDepth(25);
          this.tweens.add({ targets: c, y: top - 90, duration: 350, ease: 'Quad.easeOut', yoyo: true, onComplete: () => c.destroy() });
        } else {
          this.audio.play('bump');
          this.addItem(kind, cx, top + 30, true);
        }
        break;
      }
      case Tile.Hard:
      case Tile.Used:
      case Tile.PipeTL:
      case Tile.PipeTR:
        this.audio.play('bump');
        break;
    }
  }

  private spawnDust(x: number, y: number, color: number) {
    let img = this.dustPool.pop();
    if (!img) img = this.add.image(0, 0, 'dust').setDepth(19);
    img.setPosition(x, y).setTint(color).setAlpha(0.8).setScale(0.6 + Math.random() * 0.6).setVisible(true).setActive(true);
    this.tweens.add({
      targets: img,
      x: x + (Math.random() - 0.5) * 40,
      y: y - 10 - Math.random() * 20,
      alpha: 0,
      scale: 0.1,
      duration: 350 + Math.random() * 200,
      onComplete: () => {
        img!.setVisible(false);
        this.dustPool.push(img!);
      },
    });
  }

  private onPowerUpChanged(_id: PowerUpId) {
    // hook for HUD / analytics; HUD polls each frame
  }

  private respawn() {
    this.deaths++;
    this.wonder.reset();
    this.seed.sprite.setVisible(false);
    // died mid-Wonder → restore the flower so the event can be re-attempted
    if (!this.wonderCompleted && !this.items.some((i) => i.kind === 'flower' && !i.collected)) {
      this.addItem('flower', this.flowerPos.x, this.flowerPos.y);
    }
    this.player.respawn(this.spawn.x, this.spawn.y);
    this.cameras.main.flash(200, 0, 0, 0);
  }

  private restart() {
    this.enemies = [];
    this.items = [];
    this.parallax = [];
    this.dustPool = [];
    this.questionContents.clear();
    this.coins = 0;
    this.won = false;
    this.wonderCompleted = false;
    this.accumulator = 0;
    this.spawn = { x: 3 * 32 + 12, y: 17 * 32 };
    this.cameras.main.setZoom(1);
    this.scene.restart();
  }

  private emitHud() {
    const b = this.player.body;
    const badge = this.player.badges[0];
    const data: HudData = {
      coins: this.coins,
      deaths: this.deaths,
      powerUp: this.player.powerUp.name,
      badge: badge?.name ?? 'None',
      badgeDesc: badge?.description ?? '',
      wonder: this.wonder.state,
      wonderTime: this.wonder.elapsedSeconds,
      fps: this.game.loop.actualFps,
      vx: b.vx,
      vy: b.vy,
      onGround: b.onGround,
      muted: this.audio.muted,
      won: this.won,
    };
    this.game.events.emit(GAME_EVENTS.HUD, data);
  }
}
