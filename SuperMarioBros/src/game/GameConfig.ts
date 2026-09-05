import Phaser from 'phaser';
import { WORLD } from './config/Constants';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';

export const createGame = (parent: HTMLElement) =>
  new Phaser.Game({
    type: Phaser.AUTO, // WebGL preferred (required for the Wonder post-FX); Canvas fallback still plays
    parent,
    width: WORLD.VIEW_W,
    height: WORLD.VIEW_H,
    backgroundColor: '#5ec4ff',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    fps: { target: 60, forceSetTimeOut: false, smoothStep: true },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, GameScene, UIScene],
  });
