/**
 * "Memory constellation" — the hero 3D scene.
 *
 * Every glowing node is a past debugging session. A voice waveform ribbon "speaks" a symptom,
 * fires a pulse into the constellation and lights up the nearest memory (+ its repeat neighbour):
 * literally what Recall does. Every 4th utterance is a novel bug: the pulse drifts into empty space,
 * turns amber and fades — the graceful "no match".
 * Scroll drives the camera through Capture → Structure → Recall → No-match.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line, PerformanceMonitor } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { Line2 } from 'three-stdlib';
import { scrollState } from './scrollState';

/* ───────────── deterministic random ───────────── */
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VIOLET = new THREE.Color('#a78bfa');
const EMERALD = new THREE.Color('#34d399');
const AMBER = new THREE.Color('#fbbf24');
const WHITE = new THREE.Color('#ffffff');

const N_MEM = 22;
const WAVE_POINTS = 140;
const WAVE_Y = -2.15;
const WAVE_Z = 1.6;
const CYCLE = 7.2; // seconds per utterance
const MOUTH = new THREE.Vector3(0.6, WAVE_Y, WAVE_Z);

function useConstellation(dustCount: number) {
  return useMemo(() => {
    const r = mulberry32(42);
    const mem: THREE.Vector3[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N_MEM; i++) {
      const y = 1 - (i / (N_MEM - 1)) * 2;
      const rad = Math.sqrt(1 - y * y);
      const th = golden * i;
      const R = 2.6 + r() * 1.1;
      mem.push(new THREE.Vector3(Math.cos(th) * rad * R * 1.25, y * R * 0.62 + 0.35, Math.sin(th) * rad * R * 0.9));
    }
    // edges: each memory to its 2 nearest neighbours
    const edges: Array<[number, number]> = [];
    const seen = new Set<string>();
    mem.forEach((p, i) => {
      mem
        .map((q, j) => ({ j, d: p.distanceTo(q) }))
        .filter((x) => x.j !== i)
        .sort((a, b) => a.d - b.d)
        .slice(0, 2)
        .forEach(({ j }) => {
          const k = i < j ? `${i}-${j}` : `${j}-${i}`;
          if (!seen.has(k)) {
            seen.add(k);
            edges.push([i, j]);
          }
        });
    });
    const neighbour = mem.map((p, i) =>
      mem.map((q, j) => ({ j, d: j === i ? Infinity : p.distanceTo(q) })).sort((a, b) => a.d - b.d)[0].j,
    );
    const dust = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      const R = 3 + r() * 6;
      const th = r() * Math.PI * 2;
      const ph = Math.acos(2 * r() - 1);
      dust[i * 3] = Math.sin(ph) * Math.cos(th) * R * 1.4;
      dust[i * 3 + 1] = Math.cos(ph) * R * 0.55;
      dust[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * R - 1;
    }
    const tints = mem.map(() => (r() > 0.45 ? VIOLET.clone() : EMERALD.clone().lerp(VIOLET, 0.25)));
    return { mem, edges, neighbour, dust, tints };
  }, [dustCount]);
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** timeline helpers for one utterance cycle */
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function World({ dustCount, mobile }: { dustCount: number; mobile: boolean }) {
  const { mem, edges, neighbour, dust, tints } = useConstellation(dustCount);
  const group = useRef<THREE.Group>(null!);
  const inst = useRef<THREE.InstancedMesh>(null!);
  const halos = useRef<THREE.Points>(null!);
  const edgeGeo = useRef<THREE.BufferGeometry>(null!);
  const pulse = useRef<THREE.Mesh>(null!);
  const pulseMat = useRef<THREE.MeshBasicMaterial>(null!);
  const trail = useRef<THREE.Points>(null!);
  const ring = useRef<THREE.Mesh>(null!);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null!);
  const dustRef = useRef<THREE.Points>(null!);
  const waves = [useRef<Line2>(null!), useRef<Line2>(null!), useRef<Line2>(null!)];
  const tex = useMemo(glowTexture, []);
  const act = useMemo(() => new Float32Array(N_MEM), []);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), c: new THREE.Color(), v: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() }), []);
  const cycleState = useRef({ n: -1, target: 0, miss: false, curve: null as THREE.QuadraticBezierCurve3 | null, end: new THREE.Vector3(), fired: false });
  const trailPos = useMemo(() => new Float32Array(24 * 3), []);
  const waveBufs = useMemo(() => [0, 1, 2].map(() => new Float32Array(WAVE_POINTS * 3)), []);
  const { camera } = useThree();

  // initial wave points
  const wavePts = useMemo(() => Array.from({ length: WAVE_POINTS }, (_, i) => new THREE.Vector3(-3.5 + (i / (WAVE_POINTS - 1)) * 8.5, WAVE_Y, WAVE_Z)), []);
  const waveColors = useMemo(
    () => Array.from({ length: WAVE_POINTS }, (_, i) => VIOLET.clone().lerp(EMERALD, i / (WAVE_POINTS - 1)).multiplyScalar(1.6)),
    [],
  );

  const edgePositions = useMemo(() => {
    const a = new Float32Array(edges.length * 6);
    edges.forEach(([i, j], k) => {
      a.set([mem[i].x, mem[i].y, mem[i].z, mem[j].x, mem[j].y, mem[j].z], k * 6);
    });
    return a;
  }, [edges, mem]);
  const edgeColors = useMemo(() => new Float32Array(edges.length * 6), [edges]);
  const haloPositions = useMemo(() => new Float32Array(mem.flatMap((p) => [p.x, p.y, p.z])), [mem]);
  const haloColors = useMemo(() => new Float32Array(N_MEM * 3), []);

  // camera keyframes (position, lookAt) per scroll stage
  const keys = useMemo(() => {
    const hx = mobile ? 0 : -2.7; // desktop hero: constellation sits right of the headline
    return [
      { p: new THREE.Vector3(hx, 0.2, mobile ? 11 : 9.4), l: new THREE.Vector3(hx, -0.1, 0) },
      { p: new THREE.Vector3(3.2, -1.2, 7.4), l: new THREE.Vector3(0, -1.4, 0.6) },
      { p: new THREE.Vector3(-4.8, 1.8, 7.6), l: new THREE.Vector3(0, 0, 0) },
      { p: new THREE.Vector3(1.4, 0.9, 7.2), l: new THREE.Vector3(0, 0.3, 0) },
      { p: new THREE.Vector3(0, 3.4, 12), l: new THREE.Vector3(0, 0, 0) },
    ];
  }, [mobile]);
  const camTarget = useMemo(() => ({ p: new THREE.Vector3(), l: new THREE.Vector3(), lookNow: new THREE.Vector3(0, 0, 0) }), []);

  useEffect(() => {
    // static first frame for reduced motion
    camera.position.copy(keys[0].p);
    camera.lookAt(keys[0].l);
  }, [camera, keys]);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const reduced = scrollState.reducedMotion;
    const t = reduced ? 3.5 : state.clock.elapsedTime;

    /* camera along scroll keyframes */
    const sp = Math.min(0.9999, Math.max(0, scrollState.progress)) * (keys.length - 1);
    const k = Math.floor(sp);
    const f = smooth(0, 1, sp - k);
    camTarget.p.lerpVectors(keys[k].p, keys[k + 1].p, f);
    camTarget.l.lerpVectors(keys[k].l, keys[k + 1].l, f);
    camTarget.p.x += scrollState.pointerX * 0.45;
    camTarget.p.y += scrollState.pointerY * 0.3;
    const damp = reduced ? 1 : 1 - Math.exp(-dt * 2.6);
    camera.position.lerp(camTarget.p, damp);
    camTarget.lookNow.lerp(camTarget.l, damp);
    camera.lookAt(camTarget.lookNow);

    group.current.rotation.y = reduced ? 0.4 : t * 0.045;
    dustRef.current.rotation.y = -t * 0.012;

    /* utterance cycle */
    const n = Math.floor(t / CYCLE);
    const ct = t - n * CYCLE;
    const cs = cycleState.current;
    if (n !== cs.n) {
      cs.n = n;
      cs.miss = n % 4 === 3;
      cs.target = (n * 7 + 3) % N_MEM;
      cs.fired = false;
      if (cs.miss) {
        cs.end.set(-4.8 + (n % 2) * 9.6, 2.6, -2.5);
      } else {
        // world position of target node (group is rotating)
        cs.end.copy(mem[cs.target]).applyMatrix4(group.current.matrixWorld);
      }
      const mid = MOUTH.clone().lerp(cs.end, 0.5);
      mid.y += 2.2;
      mid.z += 1.2;
      cs.curve = new THREE.QuadraticBezierCurve3(MOUTH.clone(), mid, cs.end.clone());
    }
    if (!cs.miss) cs.end.copy(mem[cs.target]).applyMatrix4(group.current.matrixWorld);
    if (cs.curve && !cs.miss) cs.curve.v2.copy(cs.end);

    // speaking envelope 0..2.6s
    const speak = smooth(0.1, 0.7, ct) * (1 - smooth(2.0, 2.7, ct));
    const travel = smooth(2.6, 3.9, ct);
    const traveling = ct > 2.6 && ct < 3.95;

    /* waveform ribbons */
    waves.forEach((ref, wi) => {
      const line = ref.current;
      if (!line) return;
      const arr = waveBufs[wi];
      for (let i = 0; i < WAVE_POINTS; i++) {
        const x = -3.5 + (i / (WAVE_POINTS - 1)) * 8.5;
        const win = Math.exp(-(((x - 0.6) * 0.5) ** 2));
        const a = (0.06 + speak * (0.9 - wi * 0.22)) * win;
        const y =
          WAVE_Y +
          a * Math.sin(x * (2.2 + wi * 0.7) + t * (3.2 + wi)) * Math.cos(x * 0.9 - t * 1.3 + wi) +
          a * 0.35 * Math.sin(x * 6.1 + t * 7.0 + wi * 2);
        arr[i * 3] = x;
        arr[i * 3 + 1] = y;
        arr[i * 3 + 2] = WAVE_Z - wi * 0.12;
      }
      line.geometry.setPositions(arr);
      (line.material as THREE.Material & { opacity: number }).opacity = 0.35 + speak * 0.65 - wi * 0.08;
    });

    /* pulse travel */
    if (cs.curve) {
      const p = cs.curve.getPoint(travel);
      pulse.current.position.copy(p);
      const fade = cs.miss ? 1 - smooth(3.3, 3.95, ct) : 1;
      const vis = traveling ? fade : 0;
      pulse.current.scale.setScalar(0.001 + vis * (0.12 + 0.05 * Math.sin(t * 30)));
      pulseMat.current.color.copy(cs.miss ? VIOLET.clone().lerp(AMBER, smooth(2.9, 3.5, ct)) : WHITE).multiplyScalar(3);
      // trail
      for (let i = 23; i > 0; i--) trailPos.copyWithin(i * 3, (i - 1) * 3, (i - 1) * 3 + 3);
      trailPos[0] = p.x;
      trailPos[1] = p.y;
      trailPos[2] = p.z;
      const tg = trail.current.geometry as THREE.BufferGeometry;
      (tg.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (trail.current.material as THREE.PointsMaterial).opacity = vis * 0.8;
      (trail.current.material as THREE.PointsMaterial).color.copy(cs.miss ? AMBER : VIOLET);
    }

    /* arrival */
    if (ct >= 3.9 && !cs.fired) {
      cs.fired = true;
      if (!cs.miss) {
        act[cs.target] = 1;
        act[neighbour[cs.target]] = Math.max(act[neighbour[cs.target]], 0.6); // "you've hit this twice"
      }
    }
    const ringT = smooth(3.9, 5.4, ct);
    const showRing = ct >= 3.9 && ct < 5.4;
    ring.current.position.copy(cs.miss ? cs.end : cs.end);
    ring.current.quaternion.copy(camera.quaternion);
    ring.current.scale.setScalar(showRing ? 0.15 + ringT * (cs.miss ? 0.6 : 1.3) : 0.0001);
    ringMat.current.opacity = showRing ? (1 - ringT) * (cs.miss ? 0.5 : 0.9) : 0;
    ringMat.current.color.copy(cs.miss ? AMBER : EMERALD).multiplyScalar(2);

    /* node activations → instance colors / scales, halos, edges */
    for (let i = 0; i < N_MEM; i++) {
      act[i] = Math.max(0, act[i] - dt * (reduced ? 0 : 0.38));
      const a = act[i];
      const breathe = reduced ? 0 : 0.08 * Math.sin(t * 1.3 + i);
      tmp.s.setScalar(1 + a * 1.6 + breathe);
      tmp.m.compose(mem[i], tmp.q.identity(), tmp.s);
      inst.current.setMatrixAt(i, tmp.m);
      tmp.c.copy(tints[i]).lerp(EMERALD, a).multiplyScalar(1.1 + a * 3.2);
      inst.current.setColorAt(i, tmp.c);
      haloColors[i * 3] = tmp.c.r * (0.25 + a * 0.6);
      haloColors[i * 3 + 1] = tmp.c.g * (0.25 + a * 0.6);
      haloColors[i * 3 + 2] = tmp.c.b * (0.25 + a * 0.6);
    }
    inst.current.instanceMatrix.needsUpdate = true;
    if (inst.current.instanceColor) inst.current.instanceColor.needsUpdate = true;
    const hg = halos.current.geometry as THREE.BufferGeometry;
    (hg.attributes.color as THREE.BufferAttribute).needsUpdate = true;

    edges.forEach(([i, j], e) => {
      const a = Math.max(act[i], act[j]);
      const base = 0.13;
      for (let side = 0; side < 2; side++) {
        const c = side ? tints[j] : tints[i];
        const off = e * 6 + side * 3;
        edgeColors[off] = c.r * (base + a * 1.4) + a * 0.2;
        edgeColors[off + 1] = c.g * (base + a * 1.4) + a * 0.5;
        edgeColors[off + 2] = c.b * (base + a * 1.4) + a * 0.3;
      }
    });
    (edgeGeo.current.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  });

  return (
    <>
      <group ref={group}>
        <instancedMesh ref={inst} args={[undefined, undefined, N_MEM]}>
          <icosahedronGeometry args={[0.085, 2]} />
          <meshBasicMaterial toneMapped={false} />
        </instancedMesh>
        <points ref={halos}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[haloPositions, 3]} />
            <bufferAttribute attach="attributes-color" args={[haloColors, 3]} />
          </bufferGeometry>
          <pointsMaterial map={tex} size={0.7} sizeAttenuation vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </points>
        <lineSegments>
          <bufferGeometry ref={edgeGeo}>
            <bufferAttribute attach="attributes-position" args={[edgePositions, 3]} />
            <bufferAttribute attach="attributes-color" args={[edgeColors, 3]} />
          </bufferGeometry>
          <lineBasicMaterial vertexColors transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </lineSegments>
      </group>

      <points ref={dustRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[dust, 3]} />
        </bufferGeometry>
        <pointsMaterial map={tex} size={0.07} sizeAttenuation color="#8b93b8" transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>

      {waves.map((ref, i) => (
        <Line key={i} ref={ref} points={wavePts} vertexColors={waveColors} lineWidth={i === 0 ? 2.6 : 1.4} transparent opacity={0.6} toneMapped={false} />
      ))}

      <mesh ref={pulse}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial ref={pulseMat} toneMapped={false} />
      </mesh>
      <points ref={trail}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[trailPos, 3]} />
        </bufferGeometry>
        <pointsMaterial map={tex} size={0.22} sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </points>
      <mesh ref={ring}>
        <ringGeometry args={[0.9, 1, 64]} />
        <meshBasicMaterial ref={ringMat} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

export default function Scene({ mobile, reducedMotion }: { mobile: boolean; reducedMotion: boolean }) {
  const [dpr, setDpr] = useState(mobile ? 1 : 1.5);
  const [fx, setFx] = useState(!mobile);
  scrollState.reducedMotion = reducedMotion;
  return (
    <Canvas
      dpr={[1, dpr]}
      frameloop={reducedMotion ? 'demand' : 'always'}
      camera={{ position: [0, 0.3, 9.2], fov: 45, near: 0.1, far: 60 }}
      gl={{ antialias: false, powerPreference: 'high-performance', alpha: true }}
      style={{ position: 'absolute', inset: 0 }}
      aria-hidden
    >
      <PerformanceMonitor
        onDecline={() => {
          setDpr(1);
          setFx(false);
        }}
      />
      <World dustCount={mobile ? 120 : 320} mobile={mobile} />
      {fx && (
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur intensity={1.15} luminanceThreshold={0.18} luminanceSmoothing={0.25} radius={0.75} />
          <Vignette eskil={false} offset={0.25} darkness={0.75} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
