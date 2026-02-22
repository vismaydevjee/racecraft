import { useMemo, useState, useRef } from 'react';
import { useTrackStore } from '../../store/useTrackStore';
import { getCatmullRomPoints } from '../../lib/geometry/spline';
import * as THREE from 'three';
import { useThree, ThreeEvent } from '@react-three/fiber';

export function TrackRenderer() {
  const { points, isClosed } = useTrackStore();

  const curvePoints = useMemo(() => {
    if (points.length < 2) return [];
    return getCatmullRomPoints(points, isClosed);
  }, [points, isClosed]);

  return (
    <group>
      {/* Control Points */}
      {points.map((point, index) => (
        <DraggablePoint 
            key={point.id} 
            point={point} 
            index={index} 
            isStart={index === 0}
            isClosed={isClosed}
            pointCount={points.length}
        />
      ))}

      {/* The Track Line (Preview) */}
      {!isClosed && curvePoints.length > 0 && (
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={curvePoints.length}
              array={new Float32Array(curvePoints.flatMap(p => [p.x, p.y, p.z]))}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#4a7fa5" />
        </line>
      )}
      
      {/* Track Surface (Mesh) - Only when closed */}
      {isClosed && curvePoints.length > 0 && (
         <TrackMesh curvePoints={curvePoints} />
      )}
    </group>
  );
}

function DraggablePoint({ point, index, isStart, isClosed, pointCount }: { point: any, index: number, isStart: boolean, isClosed: boolean, pointCount: number }) {
    const { updatePoint, setIsDragging, closeTrack } = useTrackStore();
    const [active, setActive] = useState(false);
    const { camera } = useThree();

    const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        
        // If clicking start point and track is open with enough points, close it
        if (isStart && !isClosed && pointCount > 2) {
            closeTrack();
            return;
        }

        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        setActive(true);
        setIsDragging(true);
    };

    const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        setActive(false);
        setIsDragging(false);
    };

    const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
        if (!active) return;
        e.stopPropagation();
        
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2(
            (e.clientX / window.innerWidth) * 2 - 1,
            -(e.clientY / window.innerHeight) * 2 + 1
        ), camera);
        
        const target = new THREE.Vector3();
        ray.ray.intersectPlane(plane, target);
        
        if (target) {
            updatePoint(point.id, { x: target.x, z: target.z });
        }
    };

    return (
        <mesh 
            position={[point.x, point.y, point.z]}
            onPointerOver={() => document.body.style.cursor = 'grab'}
            onPointerOut={() => document.body.style.cursor = 'default'}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerMove={handlePointerMove}
        >
            <sphereGeometry args={[active ? 1.2 : 0.8, 16, 16]} />
            <meshStandardMaterial 
                color={active ? "#ffffff" : (isStart && !isClosed ? "#8ac4e8" : "#4a7fa5")} 
                emissive={active ? "#ffffff" : (isStart && !isClosed ? "#4a7fa5" : "#000000")}
                emissiveIntensity={active ? 0.8 : 0.5}
            />
        </mesh>
    );
}

function TrackMesh({ curvePoints }: { curvePoints: THREE.Vector3[] }) {
  const { geometry, kerbGeometry } = useMemo(() => {
    // Custom mesh generation for perfect flatness
    const trackWidth = 8;
    const kerbWidth = 1.5;
    
    // Arrays for BufferGeometry
    const vertices: number[] = [];
    const indices: number[] = [];
    const uvs: number[] = [];
    
    const kVertices: number[] = [];
    const kIndices: number[] = [];
    
    const curve = new THREE.CatmullRomCurve3(curvePoints, true);
    // Use fewer points for performance but enough for smoothness
    const points = curve.getSpacedPoints(curvePoints.length * 8); 
    
    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const tangent = curve.getTangentAt(i / points.length).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();
        
        // Track Vertices (Left and Right)
        const pL = p.clone().add(binormal.clone().multiplyScalar(trackWidth / 2));
        const pR = p.clone().sub(binormal.clone().multiplyScalar(trackWidth / 2));
        
        vertices.push(pL.x, pL.y, pL.z);
        vertices.push(pR.x, pR.y, pR.z);
        
        uvs.push(0, i / points.length);
        uvs.push(1, i / points.length);
        
        // Kerb Vertices
        // Left Kerb
        const kLL = pL.clone().add(binormal.clone().multiplyScalar(kerbWidth));
        kVertices.push(kLL.x, kLL.y, kLL.z); // Outer
        kVertices.push(pL.x, pL.y, pL.z);    // Inner (Track edge)
        
        // Right Kerb
        const kRR = pR.clone().sub(binormal.clone().multiplyScalar(kerbWidth));
        kVertices.push(pR.x, pR.y, pR.z);     // Inner (Track edge)
        kVertices.push(kRR.x, kRR.y, kRR.z);  // Outer

        // Indices
        if (i < points.length - 1) {
            const base = i * 2;
            // Track Quad
            indices.push(base, base + 1, base + 2);
            indices.push(base + 1, base + 3, base + 2);
            
            // Kerb Quads (Left)
            const kBase = i * 4;
            kIndices.push(kBase, kBase + 1, kBase + 4);
            kIndices.push(kBase + 1, kBase + 5, kBase + 4);
            
            // Kerb Quads (Right)
            kIndices.push(kBase + 2, kBase + 3, kBase + 6);
            kIndices.push(kBase + 3, kBase + 7, kBase + 6);
        } else {
            // Close the loop
            const base = i * 2;
            indices.push(base, base + 1, 0);
            indices.push(base + 1, 1, 0);
            
            const kBase = i * 4;
            kIndices.push(kBase, kBase + 1, 0);
            kIndices.push(kBase + 1, 1, 0);
            
            kIndices.push(kBase + 2, kBase + 3, 2);
            kIndices.push(kBase + 3, 3, 2);
        }
    }
    
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    
    const kGeo = new THREE.BufferGeometry();
    kGeo.setAttribute('position', new THREE.Float32BufferAttribute(kVertices, 3));
    kGeo.setIndex(kIndices);
    kGeo.computeVertexNormals();
    
    return { geometry: geo, kerbGeometry: kGeo };
  }, [curvePoints]);

  return (
    <group>
      {/* Asphalt */}
      <mesh geometry={geometry} receiveShadow castShadow position={[0, 0.02, 0]}>
        <meshStandardMaterial color="#334155" roughness={0.7} metalness={0.1} side={THREE.DoubleSide} />
      </mesh>
      
      {/* Kerbs */}
      <mesh geometry={kerbGeometry} receiveShadow position={[0, 0.03, 0]}>
         <meshStandardMaterial color="#ef4444" roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
      
      {/* Wireframe Overlay */}
      <mesh geometry={geometry} position={[0, 0.04, 0]}>
         <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.05} />
      </mesh>
    </group>
  );
}
