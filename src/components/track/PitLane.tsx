import { useMemo } from 'react';
import { useTrackStore } from '../../store/useTrackStore';
import { getCatmullRomPoints } from '../../lib/geometry/spline';
import { buildCurvatureProfile, findStraightRuns, findBestStraight } from '../../lib/analysis/curvature';
import { generatePitLane } from '../../lib/analysis/pitPlacement';
import * as THREE from 'three';
import { Line, Text } from '@react-three/drei';

export function PitLane() {
  const { points, isClosed } = useTrackStore();

  const { pitData } = useMemo(() => {
    if (!isClosed || points.length < 3) return { pitData: null };
    
    const curvePoints = getCatmullRomPoints(points, true, 0.5, 20); 
    const curvature = buildCurvatureProfile(curvePoints);
    
    // Try to find a good straight first
    // With segments=20, minLen=10 is half the distance between control points
    let straights = findStraightRuns(curvature, 10, 0.2);
    let mainStraight;

    if (straights.length > 0) {
        // Sort by length descending to ensure we get the longest straight
        straights.sort((a, b) => b.len - a.len);
        mainStraight = straights[0];
    } else {
        // Fallback: Force a spot on the "straightest" part of the track
        // Look for a segment of 20 points (1 control point distance)
        mainStraight = findBestStraight(curvature, 20);
    }
    
    const data = generatePitLane(curvePoints, mainStraight);
    
    return { pitData: data };
  }, [points, isClosed]);

  const pitGeometry = useMemo(() => {
    if (!pitData) return null;
    
    const curve = new THREE.CatmullRomCurve3(pitData.centerLine, false);
    const shape = new THREE.Shape();
    const width = 2.5; 
    shape.moveTo(-width, 0);
    shape.lineTo(-width, 0.1);
    shape.lineTo(width, 0.1);
    shape.lineTo(width, 0);
    shape.lineTo(-width, 0);

    return new THREE.ExtrudeGeometry(shape, {
      extrudePath: curve,
      steps: pitData.centerLine.length * 2,
      bevelEnabled: false,
    });
  }, [pitData]);

  if (!pitData) return null;

  return (
    <group>
      {/* Pit Lane Asphalt */}
      {pitGeometry && (
        <mesh geometry={pitGeometry} receiveShadow castShadow>
             <meshStandardMaterial color="#1e293b" roughness={0.9} />
        </mesh>
      )}

      {/* Pit Lane Markings */}
      <Line
        points={pitData.centerLine}
        color="#ffffff"
        lineWidth={1}
        dashed
        dashScale={2}
        opacity={0.4}
        transparent
        position={[0, 0.11, 0]}
      />
      
      {/* Paddock Building */}
      {pitData.paddockRect && (
        <group 
            position={pitData.paddockRect.position} 
            rotation={[0, pitData.paddockRect.rotation - Math.PI / 2, 0]}
        >
            {/* Label */}
            <Text
                position={[0, 9, 0]}
                rotation={[0, 0, 0]} // Face same way as garages
                fontSize={3}
                color="#ffffff"
                anchorX="center"
                anchorY="middle"
            >
                PADDOCK
            </Text>

            {/* Main Building Block - Ground Floor (Garages) */}
            <mesh receiveShadow castShadow position={[0, 2, 0]}>
                <boxGeometry args={[pitData.paddockRect.width, 4, pitData.paddockRect.depth]} />
                <meshStandardMaterial color="#1e293b" roughness={0.2} metalness={0.5} />
            </mesh>

            {/* Second Floor (Hospitality) - Slightly smaller depth for terrace */}
            <mesh receiveShadow castShadow position={[0, 5.5, -1]}>
                <boxGeometry args={[pitData.paddockRect.width, 3, pitData.paddockRect.depth - 2]} />
                <meshStandardMaterial color="#334155" roughness={0.1} metalness={0.2} />
            </mesh>
            
            {/* Glass Facade for Hospitality */}
            <mesh position={[0, 5.5, pitData.paddockRect.depth/2 - 1.9]}>
                <planeGeometry args={[pitData.paddockRect.width * 0.98, 2.5]} />
                <meshStandardMaterial color="#60a5fa" roughness={0.0} metalness={0.9} opacity={0.6} transparent />
            </mesh>

            {/* Roof Structure */}
            <mesh position={[0, 7.1, 0]} rotation={[-Math.PI/2, 0, 0]}>
                <planeGeometry args={[pitData.paddockRect.width + 1, pitData.paddockRect.depth + 1]} />
                <meshStandardMaterial color="#0f172a" />
            </mesh>

            {/* Garage Doors */}
            {Array.from({ length: Math.floor(pitData.paddockRect.width / 5) }).map((_, i, arr) => {
                const x = (i - arr.length/2 + 0.5) * 5;
                return (
                    <group key={i} position={[x, 0, pitData.paddockRect.depth/2 + 0.1]}>
                        {/* Door Frame */}
                        <mesh position={[0, 1.5, 0]}>
                            <planeGeometry args={[3.8, 3.2]} />
                            <meshStandardMaterial color="#0f172a" />
                        </mesh>
                        {/* Door Panel */}
                        <mesh position={[0, 1.5, 0.05]}>
                            <planeGeometry args={[3.5, 3]} />
                            <meshStandardMaterial color="#cbd5e1" roughness={0.4} metalness={0.6} />
                        </mesh>
                        {/* Team Number/Logo placeholder */}
                        <mesh position={[0, 3.5, 0]}>
                            <planeGeometry args={[1, 0.5]} />
                            <meshBasicMaterial color={i % 2 === 0 ? "#ef4444" : "#3b82f6"} />
                        </mesh>
                    </group>
                );
            })}
        </group>
      )}
    </group>
  );
}
