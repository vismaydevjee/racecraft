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
      for (let i = 0; i < best.len; i++) {
        maskedCurvature[(best.start + i) % curvature.length] = 1.0;
      }
      const secondBest = findBestStraight(maskedCurvature, 12);
      straights = [best, secondBest];
    }

    const centroid = new THREE.Vector3();
    curvePoints.forEach((p) => centroid.add(p));
    centroid.divideScalar(curvePoints.length);

    const candidateStraights = straights.slice(1, 3);
    const standData: {
      position: THREE.Vector3;
      rotation: number;
      width: number;
      depth: number;
      height: number;
    }[] = [];

    candidateStraights.forEach((run) => {
      const segmentPoints: THREE.Vector3[] = [];
      for (let i = 0; i < run.len; i++) {
        segmentPoints.push(curvePoints[(run.start + i) % curvePoints.length]);
      }

      if (segmentPoints.length < 2) return;

      const start = segmentPoints[0];
      const end = segmentPoints[segmentPoints.length - 1];
      const tangent = new THREE.Vector3().subVectors(end, start).normalize();
      const leftNormal = new THREE.Vector3(-tangent.z, 0, tangent.x);

      const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
      const toCentroid = new THREE.Vector3().subVectors(centroid, center);
      // Place stands on the outside of the track and face them inwards.
      const isLeftInside = leftNormal.dot(toCentroid) > 0;
      const outwardNormal = isLeftInside ? leftNormal.clone().negate() : leftNormal;

      const moduleLength = 15;
      const totalLength = start.distanceTo(end);
      const count = Math.max(1, Math.floor((totalLength / moduleLength) * 0.7));
      const offsetDist = 14;

      for (let i = 0; i < count; i++) {
        const t = (i - count / 2 + 0.5) * moduleLength;
        const pos = center.clone().add(tangent.clone().multiplyScalar(t));
        const standPos = pos.add(outwardNormal.clone().multiplyScalar(offsetDist));

        standData.push({
          position: standPos,
          rotation: Math.atan2(tangent.x, tangent.z),
          width: moduleLength - 2,
          depth: 8,
          height: 6,
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

function GrandstandMesh({
  position,
  rotation,
  width,
  depth,
  height,
}: {
  position: THREE.Vector3;
  rotation: number;
  width: number;
  depth: number;
  height: number;
}) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    const steps = 4;
    const stepDepth = depth / steps;
    const stepHeight = height / steps;

    shape.moveTo(0, 0);
    for (let i = 1; i <= steps; i++) {
      shape.lineTo((i - 1) * stepDepth, i * stepHeight);
      shape.lineTo(i * stepDepth, i * stepHeight);
    }
    shape.lineTo(depth, 0);
    shape.lineTo(0, 0);

    const geo = new THREE.ExtrudeGeometry(shape, {
      steps: 1,
      depth: width,
      bevelEnabled: false,
    });

    geo.translate(-depth / 2, 0, -width / 2);
    return geo;
  }, [width, height, depth]);

  return (
    <group position={position} rotation={[0, rotation - Math.PI / 2, 0]}>
      {/* Flip so front rows face the track. */}
      <group rotation={[0, Math.PI, 0]}>
        <mesh geometry={geometry} receiveShadow castShadow>
          <meshStandardMaterial color="#cbd5e1" roughness={0.8} />
        </mesh>

        <mesh position={[0, 0.1, 0]} geometry={geometry}>
          <meshStandardMaterial color="#ef4444" roughness={0.9} polygonOffset polygonOffsetFactor={-1} />
        </mesh>

        <mesh position={[0, height + 1, 0]} rotation={[0.1, 0, 0]}>
          <boxGeometry args={[depth + 2, 0.2, width]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>

        <mesh position={[depth / 2 - 0.5, height / 2, width / 2 - 0.5]}>
          <cylinderGeometry args={[0.2, 0.2, height + 2]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
        <mesh position={[depth / 2 - 0.5, height / 2, -width / 2 + 0.5]}>
          <cylinderGeometry args={[0.2, 0.2, height + 2]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
      </group>
    </group>
  );
}
