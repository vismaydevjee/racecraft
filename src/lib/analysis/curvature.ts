import * as THREE from 'three';

export function buildCurvatureProfile(points: THREE.Vector3[]): Float32Array {
  const n = points.length;
  const rawC = new Float32Array(n);
  
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];
    
    const ax = curr.x - prev.x;
    const ay = curr.z - prev.z; // Note: using z for y in 3D
    const bx = next.x - curr.x;
    const by = next.z - curr.z;
    
    const cross = Math.abs(ax * by - ay * bx);
    const lenA = Math.sqrt(ax * ax + ay * ay);
    const lenB = Math.sqrt(bx * bx + by * by);
    const denom = Math.pow(lenA + lenB || 1, 2);
    
    rawC[i] = cross / denom;
  }

  // Smoothing
  const K = 10;
  const sig = 7;
  const kern = new Float32Array(2 * K + 1);
  let ks = 0;
  
  for (let k = -K; k <= K; k++) {
    kern[k + K] = Math.exp(-(k * k) / (2 * sig * sig));
    ks += kern[k + K];
  }
  
  for (let k = 0; k < kern.length; k++) kern[k] /= ks;
  
  const smC = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (let k = -K; k <= K; k++) {
      v += rawC[(i + k + n) % n] * kern[k + K];
    }
    smC[i] = v;
  }
  
  // Normalize
  const sorted = Float32Array.from(smC).sort();
  const p95 = sorted[Math.floor(n * 0.95)] || 1e-6;
  const normC = new Float32Array(n);
  
  for (let i = 0; i < n; i++) {
    normC[i] = Math.min(smC[i] / p95, 1);
  }
  
  return normC;
}

export interface StraightRun {
  start: number;
  len: number;
}

export function findStraightRuns(normC: Float32Array, minLen: number = 8, threshold: number = 0.18): StraightRun[] {
  const n = normC.length;
  const doubled = Array.from({ length: n * 2 }, (_, i) => normC[i % n] <= threshold ? 1 : 0);
  const runs: StraightRun[] = [];
  
  let run = 0;
  let runStart = 0;
  
  for (let i = 0; i < n * 2; i++) {
    if (doubled[i]) {
      if (run === 0) runStart = i;
      run++;
    } else {
      if (run >= minLen && runStart < n) {
        runs.push({ start: runStart % n, len: run });
      }
      run = 0;
    }
  }
  
  if (run >= minLen && runStart < n) {
    runs.push({ start: runStart % n, len: run });
  }
  
  // Deduplicate
  const seen = new Set<number>();
  return runs
    .filter(r => {
      if (seen.has(r.start)) return false;
      seen.add(r.start);
      return true;
    })
    .sort((a, b) => b.len - a.len);
}

export function findBestStraight(normC: Float32Array, len: number): StraightRun {
    const n = normC.length;
    let bestStart = 0;
    let minCurvature = Infinity;

    for (let i = 0; i < n; i++) {
        let sum = 0;
        for (let j = 0; j < len; j++) {
            sum += normC[(i + j) % n];
        }
        if (sum < minCurvature) {
            minCurvature = sum;
            bestStart = i;
        }
    }
    return { start: bestStart, len: len };
}

export function findLongestStraight(normC: Float32Array, threshold: number = 0.3): StraightRun {
    const n = normC.length;
    let maxLen = 0;
    let bestStart = 0;
    
    // We need to handle wrapping, so iterate 2*n
    let currentLen = 0;
    let currentStart = 0;
    
    for (let i = 0; i < n * 2; i++) {
        const val = normC[i % n];
        if (val <= threshold) {
            if (currentLen === 0) currentStart = i;
            currentLen++;
        } else {
            if (currentLen > maxLen) {
                maxLen = currentLen;
                bestStart = currentStart;
            }
            currentLen = 0;
        }
    }
    
    // Check last run
    if (currentLen > maxLen) {
        maxLen = currentLen;
        bestStart = currentStart;
    }
    
    // Normalize start index
    return { start: bestStart % n, len: Math.min(maxLen, n) }; // Cap at n
}
