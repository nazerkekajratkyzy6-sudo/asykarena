import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ASYQ_HALF, SAQA_HALF } from './physics';

/**
 * Геометрия асыка: сфера, смешанная с кубом (плоские грани, скруглённые рёбра),
 * талия по экватору, выемка на одной грани. Размеры — полуразмеры видимой модели.
 * Коллайдер физики остаётся простым боксом, поэтому на поведение броска это не влияет.
 */
function buildAsyqGeometry(hx: number, hy: number, hz: number): THREE.BufferGeometry {
  let g: THREE.BufferGeometry = new THREE.SphereGeometry(1, 56, 40);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const m = Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z));
    const t = 0.36; // доля «куба»: больше — плоские грани, меньше — круглее
    let x = v.x + (v.x / m - v.x) * t;
    let y = v.y + (v.y / m - v.y) * t;
    let z = v.z + (v.z / m - v.z) * t;
    // талия: по экватору заметно уже, концы массивнее — как у настоящего асыка
    const waist = 1 - 0.2 * (1 - y * y);
    x *= waist;
    z *= waist * (1 + 0.08 * y);
    // лёгкий бугорок на верхней части
    if (y > 0.4) { const b = (y - 0.4) * 0.35; x *= 1 + b * 0.4; z *= 1 + b * 0.4; }
    // выемка на передней грани (+z)
    if (z > 0.3) {
      const d2 = (x + 0.12) ** 2 + (y * 0.9) ** 2;
      z -= 0.1 * Math.exp(-d2 / 0.09) * Math.min(1, (z - 0.3) * 3);
    }
    pos.setXYZ(i, x * hx, y * hy, z * hz);
  }
  g.computeVertexNormals();
  return g;
}

/** Модель асыка: костяной блеск, сақа — тёплый красно-коричневый, нысана — золотистая. */
export function AsyqMesh({ saqa = false, highlight = false }: { saqa?: boolean; highlight?: boolean }) {
  const h = saqa ? SAQA_HALF : ASYQ_HALF;
  const geo = useMemo(() => buildAsyqGeometry(h[0] * 0.85, h[1] * 0.8, h[2] * 0.8), [h]);
  const mat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: saqa ? '#9c3d26' : highlight ? '#f2cb6a' : '#eadcb4',
    roughness: saqa ? 0.36 : 0.34,
    clearcoat: 0.7,
    clearcoatRoughness: 0.22,
    emissive: highlight ? '#4a2e00' : '#000000',
    emissiveIntensity: highlight ? 0.22 : 0,
  }), [saqa, highlight]);
  return <mesh geometry={geo} material={mat} castShadow receiveShadow />;
}

/** Лёгкая пыль, которая поднимается, когда сақа падает на землю. */
export interface DustHandle { burst(x: number, z: number, k: number): void }

export const Dust = forwardRef<DustHandle>(function Dust(_, ref) {
  const N = 16;
  const parts = useRef(Array.from({ length: N }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, s: 0.12 })));
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  useImperativeHandle(ref, () => ({
    burst(x, z, k) {
      parts.current.forEach(q => {
        const a = Math.random() * Math.PI * 2;
        const sp = (0.5 + Math.random() * 1.1) * k;
        q.p.set(x + Math.cos(a) * 0.12, 0.05, z + Math.sin(a) * 0.12);
        q.v.set(Math.cos(a) * sp, 0.6 + Math.random() * 1.1 * k, Math.sin(a) * sp);
        q.life = 1;
        q.s = 0.1 + Math.random() * 0.14;
      });
    },
  }));
  useFrame((_, dt) => {
    parts.current.forEach((q, i) => {
      const m = meshes.current[i];
      if (!m) return;
      if (q.life <= 0) { m.visible = false; return; }
      q.life -= dt * 0.9;
      q.v.y -= 2.2 * dt;
      q.v.multiplyScalar(0.97);
      q.p.addScaledVector(q.v, dt);
      if (q.p.y < 0.05) { q.p.y = 0.05; q.v.y = 0; }
      m.visible = true;
      m.position.copy(q.p);
      m.scale.setScalar(q.s * (1.5 - q.life * 0.5));
      (m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, q.life) * 0.45;
    });
  });
  return (
    <>
      {parts.current.map((_, i) => (
        <mesh key={i} ref={el => { meshes.current[i] = el; }} visible={false}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshBasicMaterial color="#e3cf9e" transparent depthWrite={false} />
        </mesh>
      ))}
    </>
  );
});

/** Процедурная фактура: мелкий шум и редкие штрихи травы (работает офлайн, без внешних файлов). */
function groundTexture(seed: number, tone: [number, number]) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 512, 512);
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 6000; i++) {
    const v = tone[0] + Math.floor(rnd() * (tone[1] - tone[0]));
    g.fillStyle = `rgba(${v},${v},${v},0.55)`;
    g.fillRect(rnd() * 512, rnd() * 512, 1 + rnd() * 3, 1 + rnd() * 3);
  }
  g.lineWidth = 1.2;
  g.lineCap = 'round';
  for (let i = 0; i < 380; i++) {
    const x = rnd() * 512, y = rnd() * 512;
    g.strokeStyle = `rgba(120,118,96,${0.15 + rnd() * 0.25})`;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (rnd() - 0.5) * 7, y - 2 - rnd() * 5);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Горный массив: неровный купол с каменным цветом и снежной шапкой (без конусов). */
function massifGeometry(seed: number) {
  const g = new THREE.IcosahedronGeometry(1, 5);
  const p = g.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(p.count * 3);
  const rock = new THREE.Color('#8fa3ba');
  const snow = new THREE.Color('#f5f8fc');
  const c = new THREE.Color();
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const y = Math.max(0, v.y);
    const ang = Math.atan2(v.z, v.x);
    const jag = 1 + 0.14 * Math.sin(ang * 5 + seed) + 0.08 * Math.sin(ang * 11 + seed * 2) * Math.cos(y * 6 + seed);
    const shrink = 1 - y * 0.18;
    p.setXYZ(i, v.x * jag * shrink, y * (0.92 + 0.14 * Math.sin(ang * 4 + seed)), v.z * jag * shrink);
    const t = THREE.MathUtils.smoothstep(y, 0.58, 0.86);
    c.copy(rock).lerp(snow, t);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function Mountains() {
  const peaks = useMemo(() => {
    const arr: { x: number; z: number; h: number; r: number; seed: number }[] = [];
    const seed = [0.2, 0.7, 0.4, 0.9, 0.1, 0.6, 0.3, 0.8, 0.5, 0.15, 0.65, 0.35];
    for (let i = 0; i < 12; i++) {
      const x = -110 + i * 20 + seed[i] * 6;
      arr.push({ x, z: -105 - seed[(i + 3) % 12] * 20, h: 13 + seed[i] * 12, r: 22 + seed[(i + 5) % 12] * 12, seed: i * 1.7 });
    }
    return arr;
  }, []);
  const geos = useMemo(() => peaks.map(p => massifGeometry(p.seed)), [peaks]);
  return (
    <group>
      {peaks.map((p, i) => (
        <mesh key={i} geometry={geos[i]} position={[p.x, 0, p.z]} scale={[p.r, p.h, p.r]}>
          <meshStandardMaterial vertexColors roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function Yurt({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.4, 2.4, 2.2, 40]} />
        <meshStandardMaterial color="#fbf8f1" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[2.43, 2.43, 0.28, 40]} />
        <meshStandardMaterial color="#b0442c" roughness={0.8} />
      </mesh>
      <mesh position={[0, 2.85, 0]} castShadow>
        <coneGeometry args={[2.6, 1.4, 40]} />
        <meshStandardMaterial color="#f3ede0" roughness={0.9} />
      </mesh>
      <mesh position={[0, 3.6, 0]}>
        <cylinderGeometry args={[0.35, 0.35, 0.15, 16]} />
        <meshStandardMaterial color="#8a5a33" />
      </mesh>
      <mesh position={[0, 0.75, 2.38]}>
        <boxGeometry args={[0.9, 1.5, 0.1]} />
        <meshStandardMaterial color="#8a5a33" roughness={0.8} />
      </mesh>
    </group>
  );
}

function ornamentTexture() {
  // Казахский орнамент (стилизованный қошқар мүйіз) для бордюра поля
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#b0442c';
  g.fillRect(0, 0, 256, 64);
  g.strokeStyle = '#f4e3c3';
  g.lineWidth = 5;
  g.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const cx = 32 + i * 64;
    g.beginPath();
    g.moveTo(cx, 54);
    g.lineTo(cx, 34);
    g.bezierCurveTo(cx, 14, cx - 22, 10, cx - 20, 26);
    g.bezierCurveTo(cx - 19, 34, cx - 10, 32, cx - 11, 26);
    g.moveTo(cx, 34);
    g.bezierCurveTo(cx, 14, cx + 22, 10, cx + 20, 26);
    g.bezierCurveTo(cx + 19, 34, cx + 10, 32, cx + 11, 26);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Окружение для мягкого отражённого света на асыках (встроенная комната, без загрузки файлов). */
function SoftEnvironment() {
  const scene = useThree(s => s.scene);
  const gl = useThree(s => s.gl);
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.5;
    return () => { scene.environment = null; env.dispose(); pm.dispose(); };
  }, [gl, scene]);
  return null;
}

export function Arena() {
  const tex = useMemo(() => {
    const orn = ornamentTexture();
    orn.repeat.set(5, 1);
    const steppe = groundTexture(7, [196, 255]);
    steppe.repeat.set(34, 26);
    const sand = groundTexture(19, [214, 255]);
    sand.repeat.set(5, 7);
    return { orn, steppe, sand };
  }, []);
  return (
    <group>
      <color attach="background" args={['#e3edf5']} />
      <fog attach="fog" args={['#e4ecf2', 40, 160]} />
      <SoftEnvironment />
      <hemisphereLight args={['#f4f9ff', '#c9ad7a', 0.75]} />
      {/* Основной свет: тёплое солнце сверху-справа с мягкими тенями */}
      <directionalLight
        position={[5, 11, 7]}
        intensity={2.0}
        color="#fff1d8"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-12}
      />
      {/* Холодный контровой свет сзади — объём и блик на краях асыков */}
      <directionalLight position={[-6, 6, -8]} intensity={0.55} color="#d4e6ff" />
      {/* Степь */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, -30]} receiveShadow>
        <planeGeometry args={[260, 200]} />
        <meshStandardMaterial color="#d9cd9e" map={tex.steppe} roughness={1} />
      </mesh>
      {/* Песочная площадка */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -3]} receiveShadow>
        <planeGeometry args={[7, 13]} />
        <meshStandardMaterial color="#efe0bd" map={tex.sand} roughness={1} />
      </mesh>
      {/* Бордюр с орнаментом */}
      {[-3.6, 3.6].map(x => (
        <mesh key={x} position={[x, 0.06, -3]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} receiveShadow>
          <planeGeometry args={[13, 0.36]} />
          <meshStandardMaterial map={tex.orn} roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 0.06, -9.6]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[7.56, 0.36]} />
        <meshStandardMaterial map={tex.orn} roughness={0.9} />
      </mesh>
      {/* Ату сызығы */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, 0.42]}>
        <planeGeometry args={[6.6, 0.06]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <Mountains />
      <Yurt position={[-14, 0, -32]} />
      <Yurt position={[17, 0, -44]} />
    </group>
  );
}

export function TargetRing({ x, z, r = 0.44 }: { x: number; z: number; r?: number }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[x, 0.008, z]}>
      <ringGeometry args={[r - 0.04, r + 0.04, 64]} />
      <meshBasicMaterial color="#c8902e" transparent opacity={0.9} />
    </mesh>
  );
}

/** Граница за нысаной (правило «control»): сақа не должен остановиться дальше неё */
export function LimitLine({ x, z, w = 2.4 }: { x: number; z: number; w?: number }) {
  return (
    <group position={[x, 0.009, z]}>
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[-w / 2 + (i + 0.5) * (w / 8), 0, 0]}>
          <planeGeometry args={[w / 8 - 0.08, 0.1]} />
          <meshBasicMaterial color="#b0442c" />
        </mesh>
      ))}
    </group>
  );
}
