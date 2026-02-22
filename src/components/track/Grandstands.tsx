import { useMemo } from 'react';
import { useTrackStore } from '../../store/useTrackStore';
import { getCatmullRomPoints } from '../../lib/geometry/spline';
import { buildCurvatureProfile, findStraightRuns, findBestStraight } from '../../lib/analysis/curvature';
import * as THREE from 'three';

export function Grandstands() {
  const { points, isClosed } = useTrackStore();

  const stands = useMemo(() => {
    if (!isClosed || points.length < 3) return [];
    
    const curvePoints = getCatmullRomPoints(points, true, 0.5, 10);
    const curvature = buildCurvatureProfile(curvePoints);
    
    let straights = findStraightRuns(curvature, 10, 0.25); 
    
    if (straights.length < 2) {
        const best = findBestStraight(curvature, 15);
        const maskedCurvature = Float32Array.from(curvature);
        for(let i=0; i<best.len; i++) {
            maskedCurvature[(best.start + i) % curvature.length] = 1.0;
        }
        const secondBest = findBestStraight(maskedCurvature, 12);
        straights = [best, secondBest];
    }
    
    const candidateStraights = straights.slice(1, 3);
    
    const standData: any[] = [];
    
    candidateStraights.forEach(run => {
        const segmentPoints = [];
        for(let i=0; i<run.len; i++) {
            segmentPoints.push(curvePoints[(run.start + i) % curvePoints.length]);
        }
        
        if (segmentPoints.length < 2) return;

        const start = segmentPoints[0];
        const end = segmentPoints[segmentPoints.length - 1];
        const tangent = new THREE.Vector3().subVectors(end, start).normalize();
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
        
        const moduleLength = 15; // Longer modules
        const totalLength = start.distanceTo(end);
        const count = Math.floor(totalLength / moduleLength * 0.7);
        
        const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        const offsetDist = 12; // Further back for larger stands
        
        for(let i=0; i<count; i++) {
            const t = (i - count/2 + 0.5) * moduleLength;
            const pos = center.clone().add(tangent.clone().multiplyScalar(t));
            const standPos = pos.add(normal.clone().multiplyScalar(offsetDist));
            
            // Determine if we are on the inside or outside?
            // Normal points "Left" relative to forward.
            // We want the stand to face the track.
            // If normal points Left, the stand is on the Left. It should face Right.
            // My geometry has front at X=0 (Left edge).
            // So we need to rotate it PI around Y?
            // Let's assume standard orientation and fix if needed.
            
            standData.push({
                position: standPos,
                rotation: Math.atan2(tangent.x, tangent.z),
                width: moduleLength - 2,
                depth: 8,
                height: 6
            });
        }
    });
    
    return standData;
  }, [points, isClosed]);

  return (
    <group>
      {stands.map((stand, i) => (
        <GrandstandMesh key={i} {...stand} />
      ))}
    </group>
  );
}

function GrandstandMesh({ position, rotation, width, depth, height }: any) {
    const geometry = useMemo(() => {
        const shape = new THREE.Shape();
        // Stepped profile
        const steps = 4;
        const stepDepth = depth / steps;
        const stepHeight = height / steps;

        shape.moveTo(0, 0); // Front bottom
        for(let i=1; i<=steps; i++) {
            shape.lineTo((i-1)*stepDepth, i*stepHeight); // Rise
            shape.lineTo(i*stepDepth, i*stepHeight);     // Run
        }
        shape.lineTo(depth, 0); // Back bottom
        shape.lineTo(0, 0);     // Close

        const extrudeSettings = {
            steps: 1,
            depth: width, // Extrude along the length (Z)
            bevelEnabled: false
        };

        const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        
        // Center the geometry
        // X is depth, Z is width (length)
        // We want the "Front" (X=0) to be facing the track.
        // If the stand is on the Left of the track, it faces Right (+X).
        // Our shape goes from 0 to depth (+X). So the low part is at 0.
        // If we center it, X goes from -depth/2 to +depth/2.
        // Low part is at -depth/2.
        // If stand is on Left, it faces Right. So low part should be at +X (closest to track)?
        // No, if stand is on Left, track is to the Right.
        // So low part should be on Right (+X).
        // My shape has low part at 0 (Left).
        // So I need to flip it or rotate.
        // Let's just rotate the whole group 180 if needed.
        // For now, let's center it.
        geo.translate(-depth/2, 0, -width/2);
        
        return geo;
    }, [width, height, depth]);

    return (
        <group position={position} rotation={[0, rotation - Math.PI/2, 0]}> 
            {/* Rotated -90 deg because normal is perpendicular to tangent? 
                Wait, rotation passed is atan2(tangent).
                If tangent is North (0), rotation is 0.
                Stand length is along Z (North). Correct.
                Stand depth is along X.
                If normal is West (-1,0,0). Stand is on West.
                Track is East.
                Stand should face East (+X).
                My shape: Low part at 0. High part at depth.
                Centered: Low part at -depth/2. High part at +depth/2.
                So High part is at +X (East).
                So it faces West (Away from track).
                So I need to rotate PI around Y.
            */}
            <group rotation={[0, Math.PI, 0]}>
                {/* Concrete Base */}
                <mesh geometry={geometry} receiveShadow castShadow>
                    <meshStandardMaterial color="#cbd5e1" roughness={0.8} />
                </mesh>
                
                {/* Seats (colored stripes) */}
                <mesh position={[0, 0.1, 0]} geometry={geometry}>
                     <meshStandardMaterial color="#ef4444" roughness={0.9} polygonOffset polygonOffsetFactor={-1} />
                </mesh>

                {/* Roof */}
                <mesh position={[0, height + 1, 0]} rotation={[0.1, 0, 0]}>
                    <boxGeometry args={[depth + 2, 0.2, width]} />
                    <meshStandardMaterial color="#f8fafc" />
                </mesh>
                
                {/* Roof Pillars */}
                <mesh position={[depth/2 - 0.5, height/2, width/2 - 0.5]}>
                    <cylinderGeometry args={[0.2, 0.2, height+2]} />
                    <meshStandardMaterial color="#94a3b8" />
                </mesh>
                <mesh position={[depth/2 - 0.5, height/2, -width/2 + 0.5]}>
                    <cylinderGeometry args={[0.2, 0.2, height+2]} />
                    <meshStandardMaterial color="#94a3b8" />
                </mesh>
            </group>
        </group>
    );
}
