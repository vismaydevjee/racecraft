import * as THREE from 'three';
import { StraightRun } from './curvature';

export interface PitLaneData {
  centerLine: THREE.Vector3[];
  entry: THREE.Vector3[];
  exit: THREE.Vector3[];
  side: 'left' | 'right';
  paddockRect: {
    position: THREE.Vector3;
    rotation: number;
    width: number;
    depth: number;
  } | null;
}

export function generatePitLane(
  points: THREE.Vector3[],
  straight: StraightRun,
  trackHalfWidth: number = 4
): PitLaneData | null {
  if (!straight || straight.len < 10) return null;

  const n = points.length;
  const straightIndices: number[] = [];
  for (let i = 0; i < straight.len; i++) {
    straightIndices.push((straight.start + i) % n);
  }

  const straightPoints = straightIndices.map((i) => points[i]);

  const centroid = new THREE.Vector3();
  points.forEach((p) => centroid.add(p));
  centroid.divideScalar(n);

  const midIdx = Math.floor(straightPoints.length / 2);
  const midPt = straightPoints[midIdx];
  const nextPt = straightPoints[Math.min(midIdx + 1, straightPoints.length - 1)] ?? midPt;

  const tangent = new THREE.Vector3().subVectors(nextPt, midPt).normalize();
  const leftNormal = new THREE.Vector3(-tangent.z, 0, tangent.x);

  // Choose inside side (towards track centroid) for classic F1 pit layout.
  const toCentroid = new THREE.Vector3().subVectors(centroid, midPt);
  const chooseLeft = leftNormal.dot(toCentroid) >= 0;
  const side: 'left' | 'right' = chooseLeft ? 'left' : 'right';
  const sideVector = chooseLeft ? leftNormal : leftNormal.clone().negate();

  // Centerline offset from race line: track edge + gap + half pit lane width.
  const pitOffset = trackHalfWidth + 2 + 2.5;
  const pitPoints: THREE.Vector3[] = [];

  const taperLen = Math.max(2, Math.floor(straight.len * 0.2));

  straightPoints.forEach((p, i) => {
    let offset = pitOffset;

    if (i < taperLen) {
      const t = i / taperLen;
      offset = pitOffset * (t * t * (3 - 2 * t));
    } else if (i >= straight.len - taperLen) {
      const t = (straight.len - 1 - i) / taperLen;
      offset = pitOffset * Math.max(0, t * t * (3 - 2 * t));
    }

    const pPrev = straightPoints[Math.max(0, i - 1)];
    const pNext = straightPoints[Math.min(straightPoints.length - 1, i + 1)];
    const localTan = new THREE.Vector3().subVectors(pNext, pPrev).normalize();
    const localLeft = new THREE.Vector3(-localTan.z, 0, localTan.x);
    const localSide = chooseLeft ? localLeft : localLeft.clone().negate();

    pitPoints.push(p.clone().add(localSide.multiplyScalar(offset)));
  });

  const paddockDepth = 10;
  const paddockWidth = Math.max(24, straightPoints.length * 0.5);
  const paddockPos = midPt.clone().add(sideVector.clone().multiplyScalar(pitOffset + paddockDepth / 2 + 2));
  const rotation = Math.atan2(tangent.x, tangent.z);

  return {
    centerLine: pitPoints,
    entry: [],
    exit: [],
    side,
    paddockRect: {
      position: paddockPos,
      rotation,
      width: paddockWidth,
      depth: paddockDepth,
    },
  };
}
