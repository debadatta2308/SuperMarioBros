import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import { createGame } from '../game/GameConfig';

export function PhaserGame() {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!hostRef.current || gameRef.current) return;
    gameRef.current = createGame(hostRef.current);
    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <div
      ref={hostRef}
      tabIndex={0}
      className="aspect-[16/9] w-full max-w-[960px] overflow-hidden rounded-xl border border-white/10 bg-sky-400 shadow-[0_0_60px_rgba(80,120,255,0.35)] outline-none"
    />
  );
}
