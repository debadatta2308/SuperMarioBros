import Phaser from 'phaser';
import { Tile, WORLD } from '../config/Constants';

/**
 * Generates every texture procedurally so the project is fully self-contained.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.makeTiles();
    this.makeCharacters();
    this.makeItems();
    this.makeBackgrounds();
    this.scene.start('Game');
    this.scene.launch('UI');
  }

  private g() {
    return this.make.graphics({ x: 0, y: 0 }, false);
  }

  // ---------------------------------------------------------------- tiles
  private makeTiles() {
    const T = WORLD.TILE;
    // grass
    let g = this.g();
    g.fillStyle(0x8a5a2b).fillRect(0, 0, T, T);
    g.fillStyle(0x5cc24a).fillRect(0, 0, T, 10);
    g.fillStyle(0x7fe06a).fillRect(0, 0, T, 4);
    g.fillStyle(0x3f9a35);
    for (let i = 0; i < 4; i++) g.fillRect(i * 8 + 2, 8, 4, 4);
    g.fillStyle(0x6f4522);
    for (let i = 0; i < 5; i++) g.fillRect((i * 13) % T, 14 + ((i * 7) % 14), 4, 3);
    g.generateTexture(`tile_${Tile.Grass}`, T, T);
    // dirt
    g = this.g();
    g.fillStyle(0x8a5a2b).fillRect(0, 0, T, T);
    g.fillStyle(0x6f4522);
    for (let i = 0; i < 7; i++) g.fillRect((i * 11) % T, (i * 9) % T, 5, 3);
    g.fillStyle(0x9d6b38);
    for (let i = 0; i < 5; i++) g.fillRect((i * 17 + 5) % T, (i * 13 + 4) % T, 3, 3);
    g.generateTexture(`tile_${Tile.Dirt}`, T, T);
    // brick
    g = this.g();
    g.fillStyle(0xc4602e).fillRect(0, 0, T, T);
    g.fillStyle(0x7a3414);
    g.fillRect(0, 15, T, 2);
    g.fillRect(0, 31, T, 1);
    g.fillRect(15, 0, 2, 15);
    g.fillRect(7, 17, 2, 15);
    g.fillRect(23, 17, 2, 15);
    g.fillStyle(0xe07a44).fillRect(0, 0, T, 2);
    g.generateTexture(`tile_${Tile.Brick}`, T, T);
    // question
    g = this.g();
    g.fillStyle(0xf2b52e).fillRect(0, 0, T, T);
    g.fillStyle(0xfff0a8).fillRect(2, 2, T - 4, 3);
    g.fillStyle(0xa86a12).fillRect(0, T - 3, T, 3).fillRect(T - 3, 0, 3, T);
    g.fillStyle(0x7a4a08);
    // "?" glyph
    g.fillRect(10, 7, 12, 3).fillRect(19, 9, 3, 6).fillRect(14, 14, 7, 3).fillRect(14, 16, 3, 5).fillRect(14, 23, 3, 3);
    g.generateTexture(`tile_${Tile.Question}`, T, T);
    // used
    g = this.g();
    g.fillStyle(0x8f5a2f).fillRect(0, 0, T, T);
    g.fillStyle(0x5e3b1c).fillRect(0, T - 3, T, 3).fillRect(T - 3, 0, 3, T);
    g.fillStyle(0xa7703c).fillRect(2, 2, T - 4, 2);
    g.generateTexture(`tile_${Tile.Used}`, T, T);
    // hard
    g = this.g();
    g.fillStyle(0xb8b8c8).fillRect(0, 0, T, T);
    g.fillStyle(0xe8e8f4).fillRect(0, 0, T, 4).fillRect(0, 0, 4, T);
    g.fillStyle(0x6c6c80).fillRect(0, T - 4, T, 4).fillRect(T - 4, 0, 4, T);
    g.fillStyle(0x9a9aae).fillRect(8, 8, T - 16, T - 16);
    g.generateTexture(`tile_${Tile.Hard}`, T, T);
    // pipes
    const pipe = (key: string, top: boolean, left: boolean) => {
      const gg = this.g();
      gg.fillStyle(0x1f9d3a).fillRect(0, 0, T, T);
      if (top) {
        gg.fillStyle(0x27b846).fillRect(0, 0, T, T);
        gg.fillStyle(0x0f6b25).fillRect(0, T - 4, T, 4);
        gg.fillStyle(0x7fe08a).fillRect(0, 2, T, 3);
        if (left) gg.fillStyle(0x0f6b25).fillRect(0, 0, 3, T);
        else gg.fillStyle(0x0f6b25).fillRect(T - 3, 0, 3, T);
        gg.fillStyle(0xb8ffbf).fillRect(left ? 6 : 4, 6, 4, T - 12);
      } else {
        if (left) {
          gg.fillStyle(0x0f6b25).fillRect(0, 0, 3, T);
          gg.fillStyle(0x7fe08a).fillRect(9, 0, 4, T);
          gg.fillStyle(0x0f6b25).fillRect(T - 2, 0, 2, T);
        } else {
          gg.fillStyle(0x0f6b25).fillRect(T - 5, 0, 5, T);
          gg.fillStyle(0x156f2a).fillRect(0, 0, 4, T);
        }
      }
      gg.generateTexture(key, T, T);
    };
    pipe(`tile_${Tile.PipeTL}`, true, true);
    pipe(`tile_${Tile.PipeTR}`, true, false);
    pipe(`tile_${Tile.PipeBL}`, false, true);
    pipe(`tile_${Tile.PipeBR}`, false, false);

    // particles
    g = this.g();
    g.fillStyle(0xc4602e).fillRect(0, 0, 12, 12);
    g.fillStyle(0x7a3414).fillRect(0, 9, 12, 3);
    g.generateTexture('debris', 12, 12);
    g = this.g();
    g.fillStyle(0xffffff).fillCircle(4, 4, 4);
    g.generateTexture('dust', 8, 8);
  }

  // ---------------------------------------------------------------- characters
  private makeCharacters() {
    const W = 24;
    const H = 40;
    // small mario (facing right)
    let g = this.g();
    g.fillStyle(0x2244cc).fillRect(5, 22, 14, 12); // overalls
    g.fillStyle(0xe52521).fillRect(4, 14, 16, 9); // shirt
    g.fillStyle(0xf6c9a0).fillRect(6, 6, 13, 9); // face
    g.fillStyle(0xe52521).fillRect(3, 2, 17, 5).fillRect(8, 0, 12, 3); // cap
    g.fillStyle(0x5a2d0c).fillRect(4, 7, 3, 6); // hair
    g.fillStyle(0x222222).fillRect(15, 8, 2, 3); // eye
    g.fillStyle(0x5a2d0c).fillRect(12, 12, 7, 2); // moustache
    g.fillStyle(0xf6c9a0).fillRect(1, 20, 4, 5).fillRect(19, 20, 4, 5); // hands
    g.fillStyle(0x5a2d0c).fillRect(4, 34, 7, 6).fillRect(13, 34, 7, 6); // shoes
    g.fillStyle(0xf7d31c).fillRect(9, 26, 2, 2).fillRect(14, 26, 2, 2); // buttons
    g.generateTexture('mario_small', W, H);

    // elephant mario (grey skin, trunk, red cap) – same canvas, scaled 1.5x at runtime
    g = this.g();
    g.fillStyle(0x9aa0b8).fillRect(2, 8, 20, 26); // body
    g.fillStyle(0x2244cc).fillRect(5, 22, 14, 12); // overalls
    g.fillStyle(0xe52521).fillRect(4, 16, 16, 7); // shirt
    g.fillStyle(0x9aa0b8).fillRect(0, 6, 8, 8).fillRect(17, 6, 7, 8); // ears
    g.fillStyle(0xc7cbe0).fillRect(1, 8, 4, 4).fillRect(19, 8, 4, 4); // inner ear
    g.fillStyle(0x9aa0b8).fillRect(6, 5, 13, 10); // head
    g.fillStyle(0xe52521).fillRect(3, 1, 17, 5).fillRect(8, 0, 12, 2); // cap
    g.fillStyle(0x222222).fillRect(15, 8, 2, 3); // eye
    g.fillStyle(0x7c8299).fillRect(16, 12, 7, 4).fillRect(20, 14, 4, 6); // trunk
    g.fillStyle(0xfff4e0).fillRect(13, 14, 2, 3); // tusk
    g.fillStyle(0x5a2d0c).fillRect(3, 34, 8, 6).fillRect(13, 34, 8, 6); // shoes
    g.generateTexture('mario_elephant', W, H);

    // drill mario (green drill helmet)
    g = this.g();
    g.fillStyle(0x2244cc).fillRect(5, 22, 14, 12);
    g.fillStyle(0x2ec27e).fillRect(4, 14, 16, 9);
    g.fillStyle(0xf6c9a0).fillRect(6, 8, 13, 7);
    g.fillStyle(0x6f7a8a).fillRect(3, 4, 18, 5); // helmet band
    g.fillStyle(0x9aa7b8).fillTriangle(12, -2, 4, 5, 20, 5); // drill cone
    g.fillStyle(0xd8dee8).fillRect(11, 0, 2, 5);
    g.fillStyle(0x222222).fillRect(15, 10, 2, 3);
    g.fillStyle(0x5a2d0c).fillRect(12, 13, 7, 2);
    g.fillStyle(0xf6c9a0).fillRect(1, 20, 4, 5).fillRect(19, 20, 4, 5);
    g.fillStyle(0x5a2d0c).fillRect(4, 34, 7, 6).fillRect(13, 34, 7, 6);
    g.generateTexture('mario_drill', W, H);

    // goomba-like "Goombrat"
    g = this.g();
    g.fillStyle(0x8b4a1e).fillEllipse(14, 12, 28, 22);
    g.fillStyle(0xf6c9a0).fillRect(5, 15, 18, 8);
    g.fillStyle(0x3a1d08).fillRect(2, 22, 10, 6).fillRect(16, 22, 10, 6);
    g.fillStyle(0xffffff).fillRect(7, 8, 5, 7).fillRect(16, 8, 5, 7);
    g.fillStyle(0x111111).fillRect(9, 10, 2, 4).fillRect(17, 10, 2, 4);
    g.fillStyle(0x3a1d08).fillRect(6, 6, 6, 2).fillRect(16, 6, 6, 2);
    g.generateTexture('goomba', 28, 28);

    // parachute cap canopy
    g = this.g();
    g.fillStyle(0xe52521).fillEllipse(24, 14, 48, 26);
    g.fillStyle(0xffffff).fillRect(10, 4, 6, 14).fillRect(32, 4, 6, 14);
    g.lineStyle(1, 0xdddddd, 1);
    g.lineBetween(4, 16, 24, 30);
    g.lineBetween(44, 16, 24, 30);
    g.lineBetween(24, 16, 24, 30);
    g.generateTexture('parachute', 48, 30);
  }

  // ---------------------------------------------------------------- items
  private makeItems() {
    let g = this.g();
    // elephant fruit
    g.fillStyle(0x3a7d2c).fillRect(12, 0, 4, 8);
    g.fillStyle(0xb7a6ff).fillCircle(14, 17, 11);
    g.fillStyle(0x8a73e6).fillCircle(9, 15, 4).fillCircle(18, 20, 4);
    g.fillStyle(0xffffff).fillCircle(10, 12, 2);
    g.generateTexture('fruit_elephant', 28, 28);
    // drill mushroom
    g = this.g();
    g.fillStyle(0x2ec27e).fillEllipse(14, 11, 28, 20);
    g.fillStyle(0xffffff).fillCircle(8, 10, 4).fillCircle(19, 8, 3);
    g.fillStyle(0xf6f0dc).fillRect(7, 17, 14, 11);
    g.fillStyle(0x9aa7b8).fillTriangle(14, -1, 9, 6, 19, 6);
    g.generateTexture('fruit_drill', 28, 28);
    // coin
    g = this.g();
    g.fillStyle(0xf7d31c).fillCircle(10, 10, 10);
    g.fillStyle(0xffef8a).fillCircle(10, 10, 7);
    g.fillStyle(0xd9a80b).fillRect(8, 5, 4, 10);
    g.generateTexture('coin', 20, 20);
    // wonder flower
    g = this.g();
    g.fillStyle(0x3a7d2c).fillRect(13, 18, 4, 14);
    const petals = [0xff5fa2, 0x8ee1ff, 0xfff05a, 0xb98bff, 0x7dff9a, 0xffa15a];
    petals.forEach((c, i) => {
      const a = (i / petals.length) * Math.PI * 2;
      g.fillStyle(c).fillCircle(16 + Math.cos(a) * 9, 14 + Math.sin(a) * 9, 6);
    });
    g.fillStyle(0xffffff).fillCircle(16, 14, 6);
    g.fillStyle(0x222222).fillCircle(14, 13, 1.5).fillCircle(18, 13, 1.5);
    g.generateTexture('wonder_flower', 32, 32);
    // wonder seed
    g = this.g();
    g.fillStyle(0xfff05a).fillTriangle(14, 0, 2, 20, 26, 20);
    g.fillStyle(0xffb347).fillEllipse(14, 18, 24, 18);
    g.fillStyle(0xffffff).fillCircle(10, 16, 3);
    g.fillStyle(0x222222).fillCircle(11, 18, 1.5).fillCircle(17, 18, 1.5);
    g.generateTexture('wonder_seed', 28, 28);
    // flag
    g = this.g();
    g.fillStyle(0xe8e8f4).fillRect(14, 0, 4, 160);
    g.fillStyle(0xf7d31c).fillCircle(16, 4, 6);
    g.fillStyle(0xe52521).fillTriangle(18, 10, 18, 50, 50, 30);
    g.fillStyle(0xffffff).fillCircle(28, 30, 5);
    g.generateTexture('flag', 56, 160);
    // checkpoint
    g = this.g();
    g.fillStyle(0xe8e8f4).fillRect(12, 0, 3, 64);
    g.fillStyle(0x4fa3ff).fillTriangle(15, 4, 15, 28, 34, 16);
    g.generateTexture('checkpoint', 36, 64);
  }

  // ---------------------------------------------------------------- parallax backgrounds
  private makeBackgrounds() {
    const W = 960;
    const H = 540;
    // sky gradient
    let g = this.g();
    for (let i = 0; i < H; i += 4) {
      const t = i / H;
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(new Phaser.Display.Color(0x5e, 0xc4, 0xff), new Phaser.Display.Color(0xd8, 0xf0, 0xff), 100, Math.floor(t * 100));
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b)).fillRect(0, i, W, 4);
    }
    g.generateTexture('bg_sky', W, H);

    // tileable hills helper (period = width so it wraps seamlessly)
    const hills = (key: string, width: number, base: number, amp: number, freq: number, color: number, color2: number) => {
      const gg = this.g();
      gg.fillStyle(color);
      gg.beginPath();
      gg.moveTo(0, H);
      for (let x = 0; x <= width; x += 6) {
        const y = base + Math.sin((x / width) * Math.PI * 2 * freq) * amp + Math.sin((x / width) * Math.PI * 2 * freq * 2.7) * amp * 0.35;
        gg.lineTo(x, y);
      }
      gg.lineTo(width, H);
      gg.closePath();
      gg.fillPath();
      gg.fillStyle(color2);
      gg.beginPath();
      gg.moveTo(0, H);
      for (let x = 0; x <= width; x += 6) {
        const y = base + 60 + Math.sin((x / width) * Math.PI * 2 * freq + 1.7) * amp * 0.8;
        gg.lineTo(x, y);
      }
      gg.lineTo(width, H);
      gg.closePath();
      gg.fillPath();
      gg.generateTexture(key, width, H);
    };
    hills('bg_far', 960, 300, 60, 2, 0x9fd4ef, 0x8cc5e6);
    hills('bg_mid', 960, 360, 50, 3, 0x6fb56a, 0x5ea35a);
    hills('bg_near', 960, 430, 30, 4, 0x3f8f3f, 0x357f36);

    // clouds
    g = this.g();
    const cloud = (x: number, y: number, s: number) => {
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(x, y, 18 * s).fillCircle(x + 22 * s, y - 8 * s, 22 * s).fillCircle(x + 48 * s, y, 18 * s);
      g.fillRect(x, y, 48 * s, 16 * s);
    };
    cloud(60, 80, 1);
    cloud(360, 140, 0.7);
    cloud(600, 60, 1.2);
    cloud(820, 170, 0.8);
    g.generateTexture('bg_clouds', 960, 240);
  }
}
