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
  trackWidth: number = 4
): PitLaneData | null {
  if (!straight || straight.len < 10) return null;

  const n = points.length;
  const straightIndices: number[] = [];
  for (let i = 0; i < straight.len; i++) {
    straightIndices.push((straight.start + i) % n);
  }
  
  const straightPoints = straightIndices.map(i => points[i]);
  
  // Calculate centroid to determine "inward" vs "outward"
  const centroid = new THREE.Vector3();
  points.forEach(p => centroid.add(p));
  centroid.divideScalar(n);
  
  // Determine side (heuristic: check middle of straight)
  const midIdx = Math.floor(straightPoints.length / 2);
  const midPt = straightPoints[midIdx];
  const nextPt = straightPoints[midIdx + 1] || straightPoints[midIdx];
  
  const tangent = new THREE.Vector3().subVectors(nextPt, midPt).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x); // Left normal
  
  // Check which side faces away from centroid (outward)
  const toCentroid = new THREE.Vector3().subVectors(centroid, midPt);
  const dot = normal.dot(toCentroid);
  
  // If dot > 0, normal points INWARD. We usually want pits on the INWARD side (F1 style) or OUTWARD?
  // The prompt says "Pit lane automatically placed". Let's put it on the INWARD side usually, 
  // but the prototype put it on the "outward" side relative to the centroid?
  // Let's stick to the prototype logic: "chosen=leftScore>=rightScore?'outward':'inward';"
  // Actually prototype logic was complex. Let's simplify: Pits usually go on the INSIDE of the track relative to the paddock.
  // Let's place it on the side closer to the centroid (Inward) for now as it's safer for "grandstands on outside".
  
  const side = dot > 0 ? 'left' : 'right'; // Left is inward
  const sideVector = dot > 0 ? normal : normal.clone().negate();
  
  // Generate Pit Centerline
  // Main track half-width is approx 4. Pit lane half-width is approx 4.
  // We need enough gap. 
  // trackWidth param is typically half-width (4).
  // Offset = trackWidth (4) + Gap (2) + PitHalfWidth (4) = 10
  const pitOffset = trackWidth + 6; 
  const pitPoints: THREE.Vector3[] = [];
  
  // Taper logic
  const taperLen = Math.floor(straight.len * 0.2);
  
  straightPoints.forEach((p, i) => {
    let offset = pitOffset;
    
    // Taper in/out
    if (i < taperLen) {
      const t = i / taperLen;
      offset = pitOffset * (t * t * (3 - 2 * t)); // Smoothstep
    } else if (i > straight.len - taperLen) {
      const t = (straight.len - i) / taperLen;
      offset = pitOffset * (t * t * (3 - 2 * t));
    }
    
    // Calculate local normal
    const pPrev = straightPoints[Math.max(0, i - 1)];
    const pNext = straightPoints[Math.min(straightPoints.length - 1, i + 1)];
    const tan = new THREE.Vector3().subVectors(pNext, pPrev).normalize();
    const nor = new THREE.Vector3(-tan.z, 0, tan.x);
    if (dot < 0) nor.negate(); // Ensure it points to the chosen side
    
    const pitPt = p.clone().add(nor.multiplyScalar(offset));
    pitPoints.push(pitPt);
  });

  // Paddock Rect
  const paddockDepth = 10;
  const paddockWidth = straightPoints.length * 0.5; // Rough approximation
  const paddockPos = midPt.clone().add(sideVector.clone().multiplyScalar(pitOffset + paddockDepth / 2 + 2));
  const rotation = Math.atan2(tangent.x, tangent.z); // Check rotation

  return {
    centerLine: pitPoints,
    entry: [], // Todo: smooth connectors
    exit: [],
    side,
    paddockRect: {
      position: paddockPos,
      rotation,
      width: paddockWidth,
      depth: paddockDepth
    }
  };
}
