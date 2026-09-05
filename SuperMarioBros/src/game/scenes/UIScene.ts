import Phaser from 'phaser';
import { GAME_EVENTS, WORLD } from '../config/Constants';
import type { HudData } from './GameScene';

export class UIScene extends Phaser.Scene {
  private coinText!: Phaser.GameObjects.Text;
  private powerText!: Phaser.GameObjects.Text;
  private badgeText!: Phaser.GameObjects.Text;
  private wonderText!: Phaser.GameObjects.Text;
  private debugText!: Phaser.GameObjects.Text;
  private toast!: Phaser.GameObjects.Text;
  private toastTween?: Phaser.Tweens.Tween;

  constructor() {
    super('UI');
  }

  create() {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: '"Press Start 2P", "Courier New", monospace',
      fontSize: '14px',
      color: '#ffffff',
      stroke: '#1b1b3a',
      strokeThickness: 4,
    };
    const panel = this.add.rectangle(0, 0, WORLD.VIEW_W, 46, 0x000000, 0.25).setOrigin(0);
    panel.setDepth(0);
    this.coinText = this.add.text(16, 14, '', style);
    this.powerText = this.add.text(200, 14, '', style);
    this.badgeText = this.add.text(470, 14, '', { ...style, color: '#9be7ff' });
    this.wonderText = this.add.text(WORLD.VIEW_W - 16, 14, '', { ...style, color: '#ffe66d' }).setOrigin(1, 0);
    this.debugText = this.add
      .text(16, WORLD.VIEW_H - 14, '', { ...style, fontSize: '11px', color: '#d0d0ff', strokeThickness: 3 })
      .setOrigin(0, 1);

    this.toast = this.add
      .text(WORLD.VIEW_W / 2, 120, '', { ...style, fontSize: '22px', strokeThickness: 6, align: 'center' })
      .setOrigin(0.5)
      .setAlpha(0);

    this.game.events.on(GAME_EVENTS.HUD, this.onHud, this);
    this.game.events.on(GAME_EVENTS.TOAST, this.onToast, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(GAME_EVENTS.HUD, this.onHud, this);
      this.game.events.off(GAME_EVENTS.TOAST, this.onToast, this);
    });
  }

  private onHud(d: HudData) {
    this.coinText.setText(`◉ ${String(d.coins).padStart(3, '0')}   ✕ ${d.deaths}`);
    this.powerText.setText(`${d.powerUp}`);
    this.badgeText.setText(`BADGE: ${d.badge}  [B]`);
    const w = d.wonder === 'idle' ? '' : d.wonder === 'freeze' ? '✿ WONDER...' : d.wonder === 'active' ? `✿ WONDER ${d.wonderTime.toFixed(1)}s` : '✿ ending';
    this.wonderText.setText(w);
    this.debugText.setText(
      `FPS ${d.fps.toFixed(0)}  vx ${d.vx.toFixed(0)}  vy ${d.vy.toFixed(0)}  ${d.onGround ? 'GROUND' : 'AIR'}  ${d.muted ? '[MUTED]' : '[M] mute'}  [R] restart`
    );
  }

  private onToast(msg: string, color = 0xffffff) {
    this.toast.setText(msg).setColor('#' + color.toString(16).padStart(6, '0'));
    this.toastTween?.stop();
    this.toast.setAlpha(0).setScale(0.6);
    this.toastTween = this.tweens.add({
      targets: this.toast,
      alpha: 1,
      scale: 1,
      duration: 220,
      ease: 'Back.easeOut',
      hold: 1800,
      yoyo: true,
    });
  }
}
