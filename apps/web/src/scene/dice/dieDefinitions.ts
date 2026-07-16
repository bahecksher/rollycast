import {
  BoxGeometry,
  type BufferGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  OctahedronGeometry,
  Quaternion,
  TetrahedronGeometry,
  Vector3,
} from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import type { SupportedDieType } from './dieTypes';
import type { DieFace } from './orientation';

export { SUPPORTED_DIE_TYPES, isSupportedDieType, type SupportedDieType } from './dieTypes';

const D6_SIZE = 1;
const D20_RADIUS = 0.62;
const POLY_RADIUS: Record<'d4' | 'd8' | 'd10' | 'd12', number> = {
  d4: 0.72,
  d8: 0.68,
  d10: 0.7,
  d12: 0.68,
};

/** Placement of a face's number, as a +Z-facing plane laid flat on that face. */
export interface FaceDecal {
  value: number;
  position: Vector3;
  quaternion: Quaternion;
}

export type ColliderDescriptor =
  | { kind: 'cuboid'; halfExtents: [number, number, number] }
  | { kind: 'hull'; points: Float32Array };

export interface DieDefinition {
  type: SupportedDieType;
  sides: number;
  faces: DieFace[];
  decals: FaceDecal[];
  collider: ColliderDescriptor;
  /** Center-to-face distance = resting height when a flat face is on the table. */
  inradius: number;
  /** Circumradius — used for spawn spacing. */
  radius: number;
  /** Uniform world size the die renders at. */
  size: number;
}

const PLANE_FORWARD = new Vector3(0, 0, 1);
const DECAL_LIFT = 0.002;

const GEOMETRY_CACHE = new Map<SupportedDieType, BufferGeometry>();

/** Shared, reused geometry per die type (spec §35 — reuse geometry/materials). */
export function getDieGeometry(type: SupportedDieType): BufferGeometry {
  let geometry = GEOMETRY_CACHE.get(type);
  if (!geometry) {
    geometry = buildGeometry(type);
    GEOMETRY_CACHE.set(type, geometry);
  }
  return geometry;
}

function buildGeometry(type: SupportedDieType): BufferGeometry {
  switch (type) {
    case 'd4':
      return new TetrahedronGeometry(POLY_RADIUS.d4, 0);
    case 'd6':
      return new BoxGeometry(D6_SIZE, D6_SIZE, D6_SIZE);
    case 'd8':
      return new OctahedronGeometry(POLY_RADIUS.d8, 0);
    case 'd10':
      return buildD10Geometry();
    case 'd12':
      return new DodecahedronGeometry(POLY_RADIUS.d12, 0);
    case 'd20':
      return buildD20Geometry();
  }
}

/** Pentagonal trapezohedron built as the dual of a regular pentagonal antiprism. */
function buildD10Geometry(): BufferGeometry {
  const count = 5;
  const height = 0.55;
  const top: Vector3[] = [];
  const bottom: Vector3[] = [];
  for (let i = 0; i < count; i += 1) {
    const topAngle = (i / count) * Math.PI * 2;
    const bottomAngle = topAngle + Math.PI / count;
    top.push(new Vector3(Math.cos(topAngle), height, Math.sin(topAngle)));
    bottom.push(new Vector3(Math.cos(bottomAngle), -height, Math.sin(bottomAngle)));
  }

  const dualPoints = [new Vector3(0, 1 / height, 0), new Vector3(0, -1 / height, 0)];
  const addDual = (a: Vector3, b: Vector3, c: Vector3) => {
    const centroid = new Vector3()
      .add(a)
      .add(b)
      .add(c)
      .multiplyScalar(1 / 3);
    const normal = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).normalize();
    if (normal.dot(centroid) < 0) normal.negate();
    dualPoints.push(normal.multiplyScalar(1 / normal.dot(centroid)));
  };
  for (let i = 0; i < count; i += 1) {
    const next = (i + 1) % count;
    const previous = (i + count - 1) % count;
    addDual(top[i]!, bottom[i]!, bottom[previous]!);
    addDual(top[i]!, top[next]!, bottom[i]!);
  }

  const geometry = new ConvexGeometry(dualPoints);
  geometry.computeBoundingSphere();
  const scale = POLY_RADIUS.d10 / (geometry.boundingSphere?.radius ?? 1);
  geometry.scale(scale, scale, scale);
  return geometry;
}

function buildD20Geometry(): IcosahedronGeometry {
  return new IcosahedronGeometry(D20_RADIUS, 0);
}

function makeD6(): DieDefinition {
  const half = D6_SIZE / 2;
  // Opposite faces sum to 7 (standard); any consistent mapping is correct.
  const layout: Array<{ normal: Vector3; value: number }> = [
    { normal: new Vector3(0, 1, 0), value: 1 },
    { normal: new Vector3(0, -1, 0), value: 6 },
    { normal: new Vector3(1, 0, 0), value: 2 },
    { normal: new Vector3(-1, 0, 0), value: 5 },
    { normal: new Vector3(0, 0, 1), value: 3 },
    { normal: new Vector3(0, 0, -1), value: 4 },
  ];
  return {
    type: 'd6',
    sides: 6,
    faces: layout.map((f) => ({ value: f.value, normal: f.normal.clone() })),
    decals: layout.map((f) => ({
      value: f.value,
      position: f.normal.clone().multiplyScalar(half + DECAL_LIFT),
      quaternion: new Quaternion().setFromUnitVectors(PLANE_FORWARD, f.normal),
    })),
    collider: { kind: 'cuboid', halfExtents: [half, half, half] },
    inradius: half,
    radius: Math.sqrt(3) * half,
    size: D6_SIZE,
  };
}

function makeD20(): DieDefinition {
  const geometry = buildD20Geometry();
  const position = geometry.getAttribute('position');
  const triangleCount = position.count / 3;

  const faces: DieFace[] = [];
  const decals: FaceDecal[] = [];
  let inradius = D20_RADIUS;

  for (let i = 0; i < triangleCount; i += 1) {
    const a = new Vector3().fromBufferAttribute(position, i * 3);
    const b = new Vector3().fromBufferAttribute(position, i * 3 + 1);
    const c = new Vector3().fromBufferAttribute(position, i * 3 + 2);
    const centroid = new Vector3()
      .add(a)
      .add(b)
      .add(c)
      .multiplyScalar(1 / 3);
    const normal = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).normalize();
    if (normal.dot(centroid) < 0) normal.negate();
    inradius = centroid.length();

    const value = i + 1;
    faces.push({ value, normal: normal.clone() });
    decals.push({
      value,
      position: centroid.add(normal.clone().multiplyScalar(DECAL_LIFT)),
      quaternion: new Quaternion().setFromUnitVectors(PLANE_FORWARD, normal),
    });
  }

  const points = Float32Array.from(position.array);
  geometry.dispose();

  return {
    type: 'd20',
    sides: 20,
    faces,
    decals,
    collider: { kind: 'hull', points },
    inradius,
    radius: D20_RADIUS,
    size: D20_RADIUS * 2,
  };
}

function makeRegularPolyhedron(type: 'd4' | 'd8' | 'd10' | 'd12', sides: number): DieDefinition {
  const source = buildGeometry(type);
  const geometry = source.index ? source.toNonIndexed() : source;
  const position = geometry.getAttribute('position');
  const groups: Array<{ normal: Vector3; centroid: Vector3; triangles: number }> = [];

  for (let i = 0; i < position.count; i += 3) {
    const a = new Vector3().fromBufferAttribute(position, i);
    const b = new Vector3().fromBufferAttribute(position, i + 1);
    const c = new Vector3().fromBufferAttribute(position, i + 2);
    const centroid = new Vector3()
      .add(a)
      .add(b)
      .add(c)
      .multiplyScalar(1 / 3);
    const normal = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).normalize();
    if (normal.dot(centroid) < 0) normal.negate();
    const distance = normal.dot(centroid);
    const group = groups.find(
      (candidate) =>
        candidate.normal.dot(normal) > 0.9999 &&
        Math.abs(candidate.normal.dot(candidate.centroid) - distance) < 0.001,
    );
    if (group) {
      group.centroid
        .multiplyScalar(group.triangles)
        .add(centroid)
        .multiplyScalar(1 / (group.triangles + 1));
      group.triangles += 1;
    } else {
      groups.push({ normal, centroid, triangles: 1 });
    }
  }

  const faces: DieFace[] = [];
  const decals: FaceDecal[] = [];
  groups.forEach((group, index) => {
    const value = index + 1;
    faces.push({ value, normal: group.normal.clone() });
    decals.push({
      value,
      position: group.centroid.clone().add(group.normal.clone().multiplyScalar(DECAL_LIFT)),
      quaternion: new Quaternion().setFromUnitVectors(PLANE_FORWARD, group.normal),
    });
  });

  const points = Float32Array.from(position.array);
  const inradius = Math.abs(groups[0]?.normal.dot(groups[0].centroid) ?? 0.4);
  if (geometry !== source) geometry.dispose();
  source.dispose();
  const radius = POLY_RADIUS[type];
  return {
    type,
    sides,
    faces,
    decals,
    collider: { kind: 'hull', points },
    inradius,
    radius,
    size: radius * 2,
  };
}

const REGISTRY: Record<SupportedDieType, DieDefinition> = {
  d4: makeRegularPolyhedron('d4', 4),
  d6: makeD6(),
  d8: makeRegularPolyhedron('d8', 8),
  d10: makeRegularPolyhedron('d10', 10),
  d12: makeRegularPolyhedron('d12', 12),
  d20: makeD20(),
};

export function getDieDefinition(type: SupportedDieType): DieDefinition {
  return REGISTRY[type];
}
