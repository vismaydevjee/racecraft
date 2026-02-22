import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState, useEffect } from 'react';
import { useTrackStore } from '../../store/useTrackStore';
import { useGameStore } from '../../store/useGameStore';
import { getCatmullRomPoints } from '../../lib/geometry/spline';
import { buildCurvatureProfile } from '../../lib/analysis/curvature';
import * as THREE from 'three';
import { Trail } from '@react-three/drei';

export function GhostCar() {
  const { points, isClosed } = useTrackStore();
  const { setTelemetry, maxSpeed, corneringStiffness, acceleration, braking } = useGameStore();
  const carRef = useRef<THREE.Group>(null);
  const [currentSpeedFactor, setCurrentSpeedFactor] = useState(0);
  const [spawned, setSpawned] = useState(false);
  
  // State for position to drive the trail
  const progress = useRef(0);
  const speed = useRef(0); 

  const { path, totalLength, speedFactors } = useMemo(() => {
    if (!isClosed || points.length < 3) return { path: null, totalLength: 0, speedFactors: [] };
    
    const curvePoints = getCatmullRomPoints(points, true, 0.5, 20); 
    const curve = new THREE.CatmullRomCurve3(curvePoints, true);
    const curvature = buildCurvatureProfile(curvePoints);
    
    // Speed factors based on curvature
    // corneringStiffness affects how much we slow down
    // 1.0 = minimal slowdown (high grip), 0.0 = max slowdown (low grip)
    // Base formula: factor = 1 - curvature^2 * (1 - stiffness)
    const factors = new Float32Array(curvature.length);
    for(let i=0; i<curvature.length; i++) {
        const t = curvature[i];
        // Map stiffness 0..1 to a corner factor 0.2..0.8
        // If stiffness is 1 (F1), we keep 80% speed in corners
        // If stiffness is 0 (Truck), we keep 20% speed
        const minCornerSpeed = 0.2 + (corneringStiffness * 0.6);
        
        // t is 0 (straight) to 1 (sharp turn)
        // factor should be 1.0 (straight) to minCornerSpeed (sharp)
        factors[i] = 1 - (t * t * (1 - minCornerSpeed));
    }

    return { 
        path: curve, 
        totalLength: curve.getLength(),
        speedFactors: factors
    };
  }, [points, isClosed, corneringStiffness]);

  // Reset when track closes
  useEffect(() => {
      if (isClosed && path) {
          progress.current = 0;
          speed.current = 0;
          setSpawned(true);
      } else {
          setSpawned(false);
      }
  }, [isClosed, path]);

  useFrame((state, delta) => {
    if (!path || !carRef.current || totalLength === 0 || !spawned) return;

    // 1. Determine target speed factor based on current position
    const sampleIdx = Math.floor(progress.current * speedFactors.length) % speedFactors.length;
    const targetFactor = speedFactors[sampleIdx] || 1;
    
    // Convert maxSpeed (km/h) -> world units / second.
    // The previous calculation used km/h directly as units/sec, which made the
    // numbers physically inconsistent even if the displayed telemetry looked right.
    const KMH_TO_MPS = 1000 / 3600;
    const MPS_TO_KMH = 3600 / 1000;
    // 1 world unit ~= 1.8 meters, tuned to keep current lap pacing close to prior behavior.
    const WORLD_UNITS_PER_METER = 1.8;
    const maxGameSpeed = maxSpeed * KMH_TO_MPS * WORLD_UNITS_PER_METER;
    
    const targetSpeed = maxGameSpeed * targetFactor;
    
    // 2. Smoothly interpolate speed (Physics)
    // Acceleration: 0.8 -> 80 units/sec^2
    // Braking: 0.9 -> 150 units/sec^2
    const isAccelerating = targetSpeed > speed.current;
    
    // Map 0-1 settings to actual physics values
    const accelRate = 20 + (acceleration * 100); // 20..120
    const brakeRate = 40 + (braking * 200);      // 40..240
    
    const rate = isAccelerating ? accelRate : brakeRate;
    
    // Apply delta
    const change = rate * delta;
    
    if (isAccelerating) {
        speed.current = Math.min(targetSpeed, speed.current + change);
    } else {
        speed.current = Math.max(targetSpeed, speed.current - change);
    }
    
    // 3. Move car
    const moveStep = (delta * speed.current) / totalLength;
    progress.current = (progress.current + moveStep) % 1;

    // 4. Update Transform
    const position = path.getPointAt(progress.current);
    const tangent = path.getTangentAt(progress.current).normalize();
    
    carRef.current.position.copy(position);
    
    // Align to track
    const targetLookAt = position.clone().add(tangent);
    carRef.current.lookAt(targetLookAt);
    
    // Update Telemetry
    // Convert game units back to km/h for display
    const kmh = (speed.current / WORLD_UNITS_PER_METER) * MPS_TO_KMH;
    setTelemetry(kmh); 
    setCurrentSpeedFactor(speed.current / maxGameSpeed);
  });

  if (!path || !spawned) return null;

  const speedColor = new THREE.Color().setHSL(0.6, 1, 0.5).lerp(new THREE.Color('#ef4444'), 1 - (currentSpeedFactor - 0.2) / 0.8);

  return (
    <group>
        <group ref={carRef}>
            <Trail
                width={2}
                length={12}
                color={speedColor}
                attenuation={(t) => t * t}
            >
                {/* Car Body */}
                <group position={[0, 0.3, 0]}>
                    <mesh castShadow position={[0, 0, 0]}>
                        <boxGeometry args={[0.8, 0.4, 2.2]} />
                        <meshStandardMaterial color={speedColor} roughness={0.2} metalness={0.8} />
                    </mesh>
                    <mesh position={[0, 0.4, -0.9]}>
                        <boxGeometry args={[1.4, 0.1, 0.4]} />
                        <meshStandardMaterial color={speedColor} />
                    </mesh>
                    <mesh position={[0, -0.1, 1.0]}>
                        <boxGeometry args={[1.4, 0.1, 0.4]} />
                        <meshStandardMaterial color={speedColor} />
                    </mesh>
                    <mesh position={[0, 0.25, 0.2]}>
                        <sphereGeometry args={[0.25, 16, 16]} />
                        <meshBasicMaterial color="white" toneMapped={false} />
                    </mesh>
                    <pointLight color={speedColor} distance={10} intensity={2} position={[0, 0.5, -1]} />
                </group>
            </Trail>
        </group>
    </group>
  );
}
