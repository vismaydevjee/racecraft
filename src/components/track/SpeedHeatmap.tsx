import { useMemo } from 'react';
import { useTrackStore } from '../../store/useTrackStore';
import { getCatmullRomPoints } from '../../lib/geometry/spline';
import { buildCurvatureProfile } from '../../lib/analysis/curvature';
import * as THREE from 'three';
import { Line } from '@react-three/drei';

export function SpeedHeatmap() {
  const { points, isClosed } = useTrackStore();

  const { segments } = useMemo(() => {
    if (!isClosed || points.length < 3) return { segments: [] };
    
    const curvePoints = getCatmullRomPoints(points, true, 0.5, 20);
    const curvature = buildCurvatureProfile(curvePoints);
    
    // Calculate speeds for coloring
    // Same logic as GhostCar
    const speeds = new Float32Array(curvature.length);
    for(let i=0; i<curvature.length; i++) {
        // curvature is 0..1
        // 1 = sharpest turn (slow), 0 = straight (fast)
        // Use the HTML logic: factor = 1 - t*t*(1-cornerFactor)
        // cornerFactor ~ 0.55
        const t = curvature[i];
        const factor = 1 - t*t*(1 - 0.55);
        speeds[i] = factor;
    }

    // Create colored segments
    const segs = [];
    for(let i=0; i<curvePoints.length - 1; i++) {
        const p1 = curvePoints[i];
        const p2 = curvePoints[i+1];
        const speed = speeds[i];
        
        // Color map: Red (slow) -> Yellow -> Green/Blue (fast)
        // speed factor is roughly 0.5 to 1.0
        const color = new THREE.Color();
        if (speed > 0.88) color.setHSL(0.6, 0.8, 0.6); // Blue/Cyan (Fast)
        else if (speed > 0.75) color.setHSL(0.25, 0.8, 0.5); // Green/Yellow
        else if (speed > 0.62) color.setHSL(0.1, 0.9, 0.5); // Orange
        else color.setHSL(0.0, 0.9, 0.5); // Red (Slow)

        segs.push({
            points: [p1, p2],
            color: color
        });
    }

    return { segments: segs };
  }, [points, isClosed]);

  if (segments.length === 0) return null;

  return (
    <group position={[0, 0.05, 0]}>
      {segments.map((seg, i) => (
        <Line
            key={i}
            points={seg.points}
            color={seg.color}
            lineWidth={4}
            transparent
            opacity={0.6}
        />
      ))}
    </group>
  );
}
