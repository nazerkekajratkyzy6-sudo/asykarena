import { useRef, useState, type MutableRefObject } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Arena, AsyqMesh, LimitLine, TargetRing } from './Scene';
import type { DemoConfig } from './lesson';
import { CameraRig } from './Trainer';
import { ASYQ_HALF, SAQA_START } from './physics';

// Демонстрация — учебная схема по ключевым кадрам, а не физическая симуляция.
// Теперь её можно вести: пауза, перемотка, переход между этапами и скорость.
export const DEMO_STEP_START = [0, 7, 14, 21];
export const DEMO_LENGTH = 30;
const SPEEDS = [0.5, 1, 2];

interface Ctl { playing: boolean; speed: number; seek: number | null }

function stageOf(t: number) {
  let s = 0;
  for (let i = 0; i < DEMO_STEP_START.length; i++) if (t >= DEMO_STEP_START[i]) s = i;
  return s;
}

function fmt(t: number) {
  const s = Math.floor(t);
  return `0:${String(s).padStart(2, '0')}`;
}

function DemoContent({ cfg, ctl, onStep, onTime, onEnd }: {
  cfg: DemoConfig;
  ctl: MutableRefObject<Ctl>;
  onStep: (i: number) => void;
  onTime: (t: number) => void;
  onEnd: () => void;
}) {
  const T = cfg.target;
  const aimAngle = Math.atan2(T.x - SAQA_START[0], -(T.z - SAQA_START[2]));
  const arc = 0.5 + Math.abs(T.z) * 0.15;
  const fly = 0.7 + Math.abs(T.z) * 0.08;
  const push = cfg.knock ? 1.4 : 0.9;
  const tc = useRef(0);
  const stepRef = useRef(-1);
  const lastQ = useRef(-1);
  const saqa = useRef<THREE.Group>(null);
  const target = useRef<THREE.Group>(null);
  const guide = useRef<THREE.Mesh>(null);
  const power = useRef<THREE.Group>(null);
  const powerFill = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);

  useFrame((_, dt) => {
    const c = ctl.current;
    if (c.seek !== null) { tc.current = c.seek; c.seek = null; }
    else if (c.playing) {
      tc.current += dt * c.speed;
      if (tc.current >= DEMO_LENGTH) { tc.current = DEMO_LENGTH; c.playing = false; onEnd(); }
    }
    const t = tc.current;
    const q = Math.floor(t * 4);
    if (q !== lastQ.current) { lastQ.current = q; onTime(t); }
    const step = stageOf(t);
    if (step !== stepRef.current) { stepRef.current = step; onStep(step); }

    const s = saqa.current!, g = target.current!;
    // 1. Сақа ставится на линию
    const drop = Math.min(1, t / 1.6);
    const restY = SAQA_START[1];
    s.position.set(SAQA_START[0], restY + (1 - drop) * (1 - drop) * 1.2, SAQA_START[2]);
    s.rotation.set(0, aimAngle * Math.min(1, Math.max(0, (t - 8) / 2)) * -1, 0);
    ring.current!.visible = t < 7 && Math.sin(t * 6) > -0.3;

    // 2. Линия прицеливания растёт к цели
    const gl = Math.max(0, Math.min(1, (t - 7.5) / 3));
    guide.current!.visible = t >= 7.5 && t < 25;
    const fullLen = Math.hypot(T.x, T.z);
    guide.current!.scale.set(1, Math.max(0.001, gl * fullLen), 1);
    guide.current!.position.set(Math.sin(aimAngle) * gl * fullLen / 2, 0.02, -Math.cos(aimAngle) * gl * fullLen / 2);
    guide.current!.rotation.set(-Math.PI / 2, 0, -aimAngle);

    // 3. Индикатор силы
    const pw = Math.max(0, Math.min(cfg.power, ((t - 15) / 3) * cfg.power));
    power.current!.visible = t >= 14.5 && t < 25;
    powerFill.current!.scale.set(1, Math.max(0.001, pw), 1);
    powerFill.current!.position.y = pw * 0.6 - 0.6;

    // 4. Бросок по параболе и удар по цели
    const ft = (t - 22) / fly;
    if (ft > 0) {
      const k = Math.min(1, ft);
      const x = SAQA_START[0] + (T.x - SAQA_START[0]) * k;
      const z = SAQA_START[2] + (T.z + 0.25 - SAQA_START[2]) * k;
      const y = restY + Math.sin(Math.PI * k) * arc;
      s.position.set(x, y, z);
      s.rotation.x = -k * Math.PI * 3;
      if (k === 1) {
        const after = Math.min(1, (t - 22 - fly) / 1.6);
        const e = 1 - (1 - after) * (1 - after);
        s.position.set(T.x + Math.sin(aimAngle) * e * 0.15, restY, T.z + 0.25 - Math.cos(aimAngle) * e * 0.15);
        s.rotation.x = -Math.PI * 3 - e * 1.2;
        g.position.set(T.x + Math.sin(aimAngle) * e * push, ASYQ_HALF[1], T.z - Math.cos(aimAngle) * e * push);
        g.rotation.y = e * 2.2;
      }
    } else {
      g.position.set(T.x, ASYQ_HALF[1], T.z);
      g.rotation.set(0, 0, 0);
    }
  });

  return (
    <>
      <TargetRing x={T.x} z={T.z} r={cfg.ring} />
      {cfg.limit && <LimitLine x={T.x} z={T.z - cfg.limit} />}
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[SAQA_START[0], 0.01, SAQA_START[2]]}>
        <ringGeometry args={[0.42, 0.52, 40]} />
        <meshBasicMaterial color="#2f6f9f" />
      </mesh>
      <mesh ref={guide}>
        <planeGeometry args={[0.07, 1]} />
        <meshBasicMaterial color="#c8902e" />
      </mesh>
      <group ref={power} position={[0.9, 0.7, 0]}>
        <mesh>
          <boxGeometry args={[0.16, 1.24, 0.04]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh ref={powerFill} position={[0, -0.6, 0.03]}>
          <boxGeometry args={[0.12, 1.2, 0.02]} />
          <meshBasicMaterial color="#d08a2a" />
        </mesh>
      </group>
      <group ref={saqa}><AsyqMesh saqa /></group>
      <group ref={target}><AsyqMesh highlight /></group>
      {cfg.others.map((o, i) => (
        <group key={i} position={[o.x, ASYQ_HALF[1], o.z]}><AsyqMesh /></group>
      ))}
    </>
  );
}

/**
 * Демонстрация с управлением. playKey — смена ключа перезапускает сцену с нуля.
 */
export function Demo({ cfg, playKey, onStep, onTime }: { cfg: DemoConfig; playKey: number; onStep: (i: number) => void; onTime: (t: number) => void }) {
  const ctl = useRef<Ctl>({ playing: true, speed: 1, seek: null });
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const cur = stageOf(t);

  const handleTime = (x: number) => { setT(x); onTime(x); };
  const handleEnd = () => setPlaying(false);
  const seekTo = (x: number) => { ctl.current.seek = Math.max(0, Math.min(DEMO_LENGTH, x)); setT(x); };
  const toggle = () => {
    const c = ctl.current;
    if (!c.playing && t >= DEMO_LENGTH) seekTo(0);
    c.playing = !c.playing;
    setPlaying(c.playing);
  };
  const changeSpeed = (s: number) => { ctl.current.speed = s; setSpeed(s); };

  return (
    <div className="stage">
      <Canvas shadows="soft" dpr={[1, 1.75]} camera={{ position: [0, 2.9, 3.4], fov: 50, near: 0.1, far: 300 }}
        gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.0 }}>
        <CameraRig />
        <Arena />
        <DemoContent key={playKey} cfg={cfg} ctl={ctl} onStep={onStep} onTime={handleTime} onEnd={handleEnd} />
      </Canvas>
      <div className="demo-ctl" role="group" aria-label="Демонстрацияны басқару">
        <button className="dc-btn" onClick={() => seekTo(cur > 0 ? DEMO_STEP_START[cur - 1] : 0)} aria-label="Алдыңғы қадам">⏮</button>
        <button className="dc-btn main" onClick={toggle}>{playing ? 'Пауза' : 'Ойнату'}</button>
        <button className="dc-btn" onClick={() => seekTo(cur < DEMO_STEP_START.length - 1 ? DEMO_STEP_START[cur + 1] : DEMO_LENGTH)} aria-label="Келесі қадам">⏭</button>
        <input className="dc-range" type="range" min={0} max={DEMO_LENGTH} step={0.05} value={t}
          onChange={e => seekTo(+e.target.value)} aria-label="Уақыт" />
        <span className="dc-time">{fmt(t)} / {fmt(DEMO_LENGTH)}</span>
        <span className="dc-speed">
          {SPEEDS.map(s => (
            <button key={s} className={speed === s ? 'on' : ''} onClick={() => changeSpeed(s)}>{s}×</button>
          ))}
        </span>
      </div>
    </div>
  );
}

