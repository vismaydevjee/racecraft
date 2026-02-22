import { useMemo } from 'react';
import { useTrackStore } from '../../store/useTrackStore';
import { getCatmullRomPoints } from '../../lib/geometry/spline';
import { buildCurvatureProfile, findStraightRuns, findBestStraight } from '../../lib/analysis/curvature';
import { generatePitLane } from '../../lib/analysis/pitPlacement';
import * as THREE from 'three';
import { Line, Text } from '@react-three/drei';

function buildFlatStrip(centerLine: THREE.Vector3[], width: number): THREE.BufferGeometry | null {
  if (centerLine.length < 2) return null;

  const vertices: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < centerLine.length; i++) {
    const p = centerLine[i];
    const prev = centerLine[Math.max(0, i - 1)];
    const next = centerLine[Math.min(centerLine.length - 1, i + 1)];
    const tangent = new THREE.Vector3().subVectors(next, prev).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);

    const left = p.clone().add(normal.clone().multiplyScalar(width / 2));
    const right = p.clone().sub(normal.clone().multiplyScalar(width / 2));

    vertices.push(left.x, left.y, left.z);
    vertices.push(right.x, right.y, right.z);

    if (i < centerLine.length - 1) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function PitLane() {
  const { points, isClosed } = useTrackStore();

  const { pitData } = useMemo(() => {
    if (!isClosed || points.length < 3) return { pitData: null };

    const curvePoints = getCatmullRomPoints(points, true, 0.5, 20);
    const curvature = buildCurvatureProfile(curvePoints);

    let straights = findStraightRuns(curvature, 10, 0.2);
    let mainStraight;

    if (straights.length > 0) {
      straights.sort((a, b) => b.len - a.len);
      mainStraight = straights[0];
    } else {
      mainStraight = findBestStraight(curvature, 20);
    }

    return { pitData: generatePitLane(curvePoints, mainStraight) };
  }, [points, isClosed]);

  const pitGeometry = useMemo(() => {
    if (!pitData) return null;
    return buildFlatStrip(pitData.centerLine, 5);
  }, [pitData]);

  if (!pitData) return null;

  return (
    <group>
      {/* Pit Lane Asphalt */}
      {pitGeometry && (
        <mesh geometry={pitGeometry} receiveShadow castShadow position={[0, 0.05, 0]}>
          <meshStandardMaterial color="#1e293b" roughness={0.9} side={THREE.DoubleSide} />
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
        <group position={pitData.paddockRect.position} rotation={[0, pitData.paddockRect.rotation, 0]}>
          {/* Label */}
          <Text
            position={[0, 9.5, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
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

          {/* Second Floor (Hospitality) */}
          <mesh receiveShadow castShadow position={[0, 5.5, -1]}>
            <boxGeometry args={[pitData.paddockRect.width, 3, pitData.paddockRect.depth - 2]} />
            <meshStandardMaterial color="#334155" roughness={0.1} metalness={0.2} />
          </mesh>

          {/* Glass Facade for Hospitality */}
          <mesh position={[0, 5.5, pitData.paddockRect.depth / 2 - 1.9]}>
            <planeGeometry args={[pitData.paddockRect.width * 0.98, 2.5]} />
            <meshStandardMaterial color="#60a5fa" roughness={0.0} metalness={0.9} opacity={0.6} transparent />
          </mesh>

          {/* Roof Structure */}
          <mesh position={[0, 7.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[pitData.paddockRect.width + 1, pitData.paddockRect.depth + 1]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>

          {/* Garage Doors */}
          {Array.from({ length: Math.floor(pitData.paddockRect.width / 5) }).map((_, i, arr) => {
            const x = (i - arr.length / 2 + 0.5) * 5;
            return (
              <group key={i} position={[x, 0, pitData.paddockRect.depth / 2 + 0.1]}>
                <mesh position={[0, 1.5, 0]}>
                  <planeGeometry args={[3.8, 3.2]} />
                  <meshStandardMaterial color="#0f172a" />
                </mesh>
                <mesh position={[0, 1.5, 0.05]}>
                  <planeGeometry args={[3.5, 3]} />
                  <meshStandardMaterial color="#cbd5e1" roughness={0.4} metalness={0.6} />
                </mesh>
                <mesh position={[0, 3.5, 0]}>
                  <planeGeometry args={[1, 0.5]} />
                  <meshBasicMaterial color={i % 2 === 0 ? '#ef4444' : '#3b82f6'} />
                </mesh>
              </group>
            );
          })}
        </group>
      )}
    </group>
  );
}
