import { PhaserGame } from './components/PhaserGame';

const controls = [
  ['← → / A D', 'Run'],
  ['Shift / J', 'Sprint (420 px/s)'],
  ['Space / W', 'Jump — hold for height'],
  ['Z / K', 'Action: Trunk whip'],
  ['↓ + Jump', 'Drill: burrow floor'],
  ['↑ + Jump', 'Drill: burrow ceiling'],
  ['Hold Jump (falling)', 'Parachute Cap glide'],
  ['B / M / R', 'Badge · Mute · Restart'],
];

const specs = [
  ['Run / Sprint', '280 / 420 px/s'],
  ['Ground accel / friction', '1200 / 1400 px/s²'],
  ['Air accel', '800 px/s²'],
  ['Jump velocity', '-620 px/s'],
  ['Gravity rise / fall', '1400 / 2200 px/s²'],
  ['Terminal velocity', '700 px/s'],
  ['Coyote / Jump buffer', '6 / 5 frames'],
  ['Wonder wave', 'sin(x·0.05 + t·3)·16'],
];

export default function App() {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,#1e2a5a_0%,#0b0f24_60%,#05070f_100%)] text-slate-100">
      <header className="mx-auto flex max-w-6xl items-end justify-between px-6 pt-8 pb-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.3em] text-sky-300/80 uppercase">Phaser 3 · TypeScript · WebGL</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight md:text-4xl">
            <span className="bg-gradient-to-r from-yellow-300 via-pink-400 to-sky-300 bg-clip-text text-transparent">Wonder</span>{' '}
            Platformer
          </h1>
        </div>
        <p className="hidden text-right text-sm text-slate-400 md:block">
          Fixed-step 60 Hz kinematic controller
          <br />
          GLSL post-FX · procedural chiptune
        </p>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-16">
        <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start">
          <div className="w-full flex-1">
            <PhaserGame />
            <p className="mt-3 text-center text-xs text-slate-400">
              Click the game to focus & enable audio. Collect the <span className="text-pink-300">Wonder Flower</span> to mutate the
              stage, then grab the <span className="text-amber-300">Wonder Seed</span> to restore it.
            </p>
          </div>

          <aside className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:w-72 lg:grid-cols-1">
            <section className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <h2 className="mb-3 text-xs font-bold tracking-widest text-sky-300 uppercase">Controls</h2>
              <ul className="space-y-1.5 text-sm">
                {controls.map(([k, v]) => (
                  <li key={k} className="flex items-center justify-between gap-3">
                    <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-slate-200 ring-1 ring-white/10">{k}</kbd>
                    <span className="text-right text-slate-300">{v}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <h2 className="mb-3 text-xs font-bold tracking-widest text-pink-300 uppercase">Kinematics @ 60 Hz</h2>
              <ul className="space-y-1.5 text-sm">
                {specs.map(([k, v]) => (
                  <li key={k} className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">{k}</span>
                    <span className="font-mono text-[12px] text-slate-100">{v}</span>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>

        <section className="mt-10 grid gap-4 md:grid-cols-4">
          {[
            ['Wonder Flower', 'A 200 ms freeze, chromatic-aberration & hue-shift shader, BGM tempo jump to 168 BPM, and a live sine-wave displacement of every tile — with collision evaluated against the displaced geometry.'],
            ['Elephant Mario', 'Hitbox scales to 1.5×. Z/K swings a forward trunk arc that shatters bricks and launches enemies.'],
            ['Drill Mario', 'DOWN+JUMP burrows into floors, UP+JUMP into ceilings. Fully invulnerable while underground; JUMP to erupt.'],
            ['Badge System', 'IBadge with onJump / onUpdate / onCollision hooks. Parachute Cap caps fall speed at 120 px/s while JUMP is held. Press B to swap.'],
          ].map(([t, d]) => (
            <div key={t} className="rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-transparent p-4">
              <h3 className="font-bold text-amber-200">{t}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-300">{d}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
