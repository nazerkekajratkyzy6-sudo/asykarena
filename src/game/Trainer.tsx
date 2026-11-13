import { memo, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { Physics, RigidBody, CuboidCollider, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { Arena, AsyqMesh, Dust, LimitLine, TargetRing, type DustHandle } from './Scene';
import { ASYQ_HALF, PHYS, SAQA_HALF, SAQA_START, launchVelocity, type TargetSetup, type ThrowRecord } from './physics';

export type View = 'back' | 'top' | 'side';

export function CameraRig({ view = 'back' }: { view?: View }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;
    const portrait = aspect < 0.75;
    if (view === 'top') {
      // Жоғарыдан: бағыт пен ауытқуды талдауға ыңғайлы
      cam.fov = portrait ? 62 : 50;
      cam.position.set(0, portrait ? 13 : 10.5, -3.1);
      cam.lookAt(0, 0, -3.2);
    } else if (view === 'side') {
      // Бүйірден: сақаның ұшу доғасы мен күші көрінеді
      cam.fov = portrait ? 64 : 48;
      cam.position.set(portrait ? 8.5 : 7, 2.2, -3);
      cam.lookAt(0, 0.3, -3.2);
    } else if (portrait) { cam.fov = 66; cam.position.set(0, 3.2, 5.6); cam.lookAt(0, 0, -4.5); }
    else if (aspect < 1.1) { cam.fov = 52; cam.position.set(0, 2.4, 4.6); cam.lookAt(0, 0, -5.6); }
    else { cam.fov = 46; cam.position.set(0, 2.6, 5.2); cam.lookAt(0, 0, -6); }
    cam.updateProjectionMatrix();
  }, [camera, size, view]);
  return null;
}

type Phase = 'ready' | 'aiming' | 'flying' | 'done';

interface RoundProps {
  setup: TargetSetup;
  enabled: boolean;
  showGuide: boolean;
  meter: React.RefObject<HTMLDivElement>;
  onResult: (r: ThrowRecord) => void;
  onPhase: (p: Phase) => void;
}

const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const MAX_ANGLE = (65 * Math.PI) / 180;
const PULL_FULL = 2.0;
// Попадание засчитывается только при реальном контакте (есть сила контакта).
// Событие «начало столкновения» в Rapier может прийти и от упреждающего (speculative) контакта без касания,
// поэтому его не используем.
const CONTACT_MIN = 0.5;
// Нейтральный тон-мэппинг сохраняет естественные цвета костяного асыка и степи
const GL_OPTS = { antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.0 };

function Round({ setup, enabled, showGuide, meter, onResult, onPhase }: RoundProps) {
  const saqa = useRef<RapierRigidBody>(null);
  const target = useRef<RapierRigidBody>(null);
  const phase = useRef<Phase>('ready');
  const hit = useRef(false);
  const neighborHit = useRef(false);
  const aim = useRef({ dx: 0, dz: -1, power: 0 });
  const trail = useRef<[number, number, number][]>([]);
  const flyT = useRef(0);
  const restT = useRef(0);
  const aimGroup = useRef<THREE.Group>(null);
  const aimBar = useRef<THREE.Mesh>(null);
  const pulse = useRef<THREE.Mesh>(null);
  const [shownTrail, setShownTrail] = useState<[number, number, number][] | null>(null);
  const { camera, gl } = useThree();
  const dust = useRef<DustHandle>(null);

  const setPhase = (p: Phase) => { phase.current = p; onPhase(p); };

  useEffect(() => {
    const el = gl.domElement;
    const ray = new THREE.Raycaster();
    const hitPoint = new THREE.Vector3();
    const toGround = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.ray.intersectPlane(ground, hitPoint) ? hitPoint.clone() : null;
    };
    const setMeter = (p: number, deg: number, visible: boolean) => {
      const m = meter.current;
      if (!m) return;
      m.style.opacity = visible ? '1' : '0';
      (m.querySelector('.fill') as HTMLElement).style.width = `${Math.round(p * 100)}%`;
      (m.querySelector('.val') as HTMLElement).textContent = `${Math.round(p * 100)}%`;
      (m.querySelector('.deg') as HTMLElement).textContent =
        Math.abs(deg) < 0.5 ? 'тура алға' : `${Math.abs(deg).toFixed(1)}° ${deg > 0 ? 'оңға' : 'солға'}`;
    };
    const down = (e: PointerEvent) => {
      if (!enabled || phase.current !== 'ready') return;
      const p = toGround(e);
      if (!p) return;
      if (Math.hypot(p.x - SAQA_START[0], p.z - SAQA_START[2]) > 1.25) return;
      el.setPointerCapture(e.pointerId);
      setPhase('aiming');
      aim.current.power = 0;
      move(e);
    };
    const move = (e: PointerEvent) => {
      if (phase.current !== 'aiming') return;
      const p = toGround(e);
      if (!p) return;
      let px = SAQA_START[0] - p.x, pz = SAQA_START[2] - p.z; // направление броска = против направления оттягивания
      const len = Math.hypot(px, pz);
      if (len < 0.05) { aim.current.power = 0; setMeter(0, 0, true); return; }
      let ang = Math.atan2(px, -pz); // 0 = прямо вперёд (−z), + вправо
      ang = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, ang));
      px = Math.sin(ang); pz = -Math.cos(ang);
      const power = Math.min(1, len / PULL_FULL);
      aim.current = { dx: px, dz: pz, power };
      setMeter(power, (ang * 180) / Math.PI, true);
    };
    const up = (e: PointerEvent) => {
      if (phase.current !== 'aiming') return;
      try { el.releasePointerCapture(e.pointerId); } catch { /* */ }
      setMeter(aim.current.power, 0, false);
      if (aim.current.power < 0.06 || !saqa.current) { setPhase('ready'); return; }
      const v = launchVelocity(aim.current.dx, aim.current.dz, aim.current.power);
      saqa.current.wakeUp();
      saqa.current.setLinvel(v.lin, true);
      saqa.current.setAngvel(v.ang, true);
      trail.current = [];
      flyT.current = 0;
      restT.current = 0;
      setPhase('flying');
    };
    const cancel = () => { if (phase.current === 'aiming') { setPhase('ready'); setMeter(0, 0, false); } };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
    };
  }, [camera, gl, enabled, meter]);

  useFrame((state, dt) => {
    if (pulse.current) {
      const vis = phase.current === 'ready' && enabled;
      pulse.current.visible = vis;
      const s = 1 + 0.12 * Math.sin(state.clock.elapsedTime * 4);
      pulse.current.scale.set(s, s, s);
    }
    if (aimGroup.current) {
      const a = phase.current === 'aiming' && aim.current.power > 0;
      aimGroup.current.visible = a;
      if (a) {
        aimGroup.current.rotation.y = -Math.atan2(aim.current.dx, -aim.current.dz);
        const L = 1.2 + aim.current.power * 6;
        aimBar.current!.scale.set(1, L, 1);
        aimBar.current!.position.z = -L / 2 - 0.3;
        const m = aimBar.current!.material as THREE.MeshBasicMaterial;
        m.color.setHSL(0.12 - aim.current.power * 0.12, 0.75, 0.5);
      }
    }
    if (phase.current !== 'flying' || !saqa.current || !target.current) return;
    flyT.current += dt;
    const p = saqa.current.translation();
    if (trail.current.length < 900) trail.current.push([p.x, p.y, p.z]);
    const lv = saqa.current.linvel();
    const tv = target.current.linvel();
    const still = Math.hypot(lv.x, lv.y, lv.z) < 0.08 && Math.hypot(tv.x, tv.y, tv.z) < 0.08;
    restT.current = still ? restT.current + dt : 0;
    if ((restT.current > 0.45 && flyT.current > 0.4) || flyT.current > 7 || p.y < -3) {
      const tp = target.current.translation();
      const intended = Math.atan2(setup.target.x - SAQA_START[0], -(setup.target.z - SAQA_START[2]));
      const actual = Math.atan2(aim.current.dx, -aim.current.dz);
      const rec: ThrowRecord = {
        hit: hit.current,
        neighborHit: neighborHit.current,
        power: aim.current.power,
        aimErrorDeg: ((actual - intended) * 180) / Math.PI,
        trail: trail.current.slice(),
        end: [p.x, p.y, p.z],
        target: setup.target,
        targetMoved: Math.hypot(tp.x - setup.target.x, tp.z - setup.target.z),
      };
      if (p.y < 0.4) dust.current?.burst(p.x, p.z, Math.min(1, Math.hypot(lv.x, lv.z) / 5 + 0.3));
      setPhase('done');
      setShownTrail(rec.trail.length > 1 ? rec.trail : null);
      onResult(rec);
    }
  });

  const t = setup.target;
  return (
    <>
      <Dust ref={dust} />
      <TargetRing x={t.x} z={t.z} r={setup.ring} />
      {setup.limit && <LimitLine x={t.x} z={t.z - setup.limit} />}
      {showGuide && (
        <Line points={[[SAQA_START[0], 0.02, SAQA_START[2]], [t.x, 0.02, t.z]]} color="#c8902e" lineWidth={2} dashed dashSize={0.18} gapSize={0.14} />
      )}
      {shownTrail && <Line points={shownTrail} color="#2f6f9f" lineWidth={3} />}
      <mesh ref={pulse} rotation-x={-Math.PI / 2} position={[SAQA_START[0], 0.01, SAQA_START[2]]}>
        <ringGeometry args={[0.42, 0.5, 40]} />
        <meshBasicMaterial color="#2f6f9f" transparent opacity={0.7} />
      </mesh>
      <group ref={aimGroup} position={[SAQA_START[0], 0.03, SAQA_START[2]]} visible={false}>
        <mesh ref={aimBar} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.08, 1]} />
          <meshBasicMaterial color="#e0a030" transparent opacity={0.85} />
        </mesh>
      </group>

      <RigidBody type="fixed" colliders={false} position={[0, -0.5, 0]}>
        <CuboidCollider args={[40, 0.5, 40]} friction={PHYS.groundFriction} restitution={PHYS.groundRestitution} />
      </RigidBody>

      <RigidBody ref={saqa} name="saqa" colliders={false} ccd position={SAQA_START}
        linearDamping={PHYS.linearDamping} angularDamping={PHYS.angularDamping}>
        <CuboidCollider args={SAQA_HALF} density={PHYS.saqaDensity} friction={PHYS.bodyFriction} restitution={PHYS.bodyRestitution} />
        <AsyqMesh saqa />
      </RigidBody>

      <RigidBody ref={target} name="target" colliders={false} ccd position={[t.x, ASYQ_HALF[1] + 0.01, t.z]}
        linearDamping={PHYS.linearDamping} angularDamping={PHYS.angularDamping}
        onContactForce={e => { if (e.other.rigidBodyObject?.name === 'saqa' && e.totalForceMagnitude > CONTACT_MIN) hit.current = true; }}>
        <CuboidCollider args={ASYQ_HALF} density={PHYS.asyqDensity} friction={PHYS.bodyFriction} restitution={PHYS.bodyRestitution} />
        <AsyqMesh highlight />
      </RigidBody>

      {setup.neighbors.map((n, i) => (
        <RigidBody key={i} name="neighbor" colliders={false} ccd position={[n.x, ASYQ_HALF[1] + 0.01, n.z]}
          linearDamping={PHYS.linearDamping} angularDamping={PHYS.angularDamping}
          onContactForce={e => { if (e.other.rigidBodyObject?.name === 'saqa' && e.totalForceMagnitude > CONTACT_MIN) neighborHit.current = true; }}>
          <CuboidCollider args={ASYQ_HALF} density={PHYS.asyqDensity} friction={PHYS.bodyFriction} restitution={PHYS.bodyRestitution} />
          <AsyqMesh />
        </RigidBody>
      ))}
    </>
  );
}

export interface TrainerProps {
  setup: TargetSetup;
  roundKey: string | number;
  seriesKey?: string | number;
  enabled: boolean;
  showGuide: boolean;
  onResult: (r: ThrowRecord) => void;
  onPhase?: (p: Phase) => void;
}

const VIEWS: { id: View; t: string }[] = [
  { id: 'back', t: 'Артынан' },
  { id: 'top', t: 'Жоғарыдан' },
  { id: 'side', t: 'Бүйірден' },
];

export const Trainer = memo(function Trainer({ setup, roundKey, seriesKey, enabled, showGuide, onResult, onPhase }: TrainerProps) {
  const meter = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>('back');
  const [hist, setHist] = useState<{ pts: [number, number, number][]; hit: boolean }[]>([]);
  const cb = useRef({ onResult, onPhase });
  cb.current = { onResult, onPhase };
  useEffect(() => { setHist([]); }, [seriesKey]);
  const handlers = useMemo(() => ({
    onResult: (r: ThrowRecord) => {
      if (r.trail.length > 1) setHist(h => [...h, { pts: r.trail, hit: r.hit }].slice(-5));
      cb.current.onResult(r);
    },
    onPhase: (p: Phase) => cb.current.onPhase?.(p),
  }), []);
  return (
    <div className="stage">
      <Canvas shadows="soft" gl={GL_OPTS} dpr={[1, 1.75]} camera={{ position: [0, 2.9, 3.4], fov: 50, near: 0.1, far: 300 }}>
        <CameraRig view={view} />
        <Arena />
        {/* Алдыңғы лақтырыстардың іздері: салыстыру үшін (жасыл — тиді, қызыл — тимеді) */}
        {hist.map((h, i) => (
          <Line key={i} points={h.pts} color={h.hit ? '#2e8b57' : '#b0442c'} lineWidth={2}
            transparent opacity={0.25 + 0.12 * (i + 1 - hist.length + 5) / 5} />
        ))}
        <Suspense fallback={null}>
          <Physics key={roundKey} gravity={[0, -9.81, 0]}>
            <Round setup={setup} enabled={enabled} showGuide={showGuide} meter={meter} {...handlers} />
          </Physics>
        </Suspense>
      </Canvas>
      <div className="meter" ref={meter} style={{ opacity: 0 }}>
        <div className="meter-row"><span>Күш</span><b className="val">0%</b></div>
        <div className="bar"><div className="fill" /></div>
        <div className="meter-row"><span>Бағыт</span><b className="deg">тура алға</b></div>
      </div>
      <div className="view-switch" role="group" aria-label="Камера">
        {VIEWS.map(v => (
          <button key={v.id} className={view === v.id ? 'on' : ''} onClick={() => setView(v.id)}>{v.t}</button>
        ))}
      </div>
    </div>
  );
});
