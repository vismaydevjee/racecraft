import { ThreeEvent, useThree } from '@react-three/fiber';
import { useTrackStore } from '../../store/useTrackStore';
import * as THREE from 'three';
import { useState, useRef } from 'react';
import { Line } from '@react-three/drei';

export function PlacementController() {
  const { addPoint, points, isClosed, closeTrack } = useTrackStore();
  const [hoverPos, setHoverPos] = useState<THREE.Vector3 | null>(null);
  const [isSnappingToStart, setIsSnappingToStart] = useState(false);

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (isClosed) {
      setHoverPos(null);
      setIsSnappingToStart(false);
      return;
    }

    const point = e.point;
    
    // Check distance to start point for closing
    if (points.length >= 3) {
      const startPoint = points[0];
      const startVec = new THREE.Vector3(startPoint.x, startPoint.y, startPoint.z);
      const dist = point.distanceTo(startVec);
      
      if (dist < 5) { // Snap radius
        setHoverPos(startVec);
        setIsSnappingToStart(true);
        document.body.style.cursor = 'pointer';
        return;
      }
    }

    setHoverPos(point);
    setIsSnappingToStart(false);
    document.body.style.cursor = 'crosshair';
  };

  const handlePointerOut = () => {
    setHoverPos(null);
    setIsSnappingToStart(false);
    document.body.style.cursor = 'default';
  };

  const handleClick = (e: ThreeEvent<PointerEvent>) => {
    if (isClosed) return;
    e.stopPropagation();

    if (isSnappingToStart) {
      closeTrack();
      setHoverPos(null);
      setIsSnappingToStart(false);
    } else {
      addPoint({
        x: e.point.x,
        y: 0,
        z: e.point.z
      });
    }
  };

  return (
    <group>
      {/* Raycast Plane */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, -0.01, 0]} 
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
        visible={false}
      >
        <planeGeometry args={[1000, 1000]} />
        <meshBasicMaterial color="red" wireframe />
      </mesh>

      {/* Preview Line */}
      {!isClosed && points.length > 0 && hoverPos && (
        <Line
          points={[
            [points[points.length - 1].x, points[points.length - 1].y, points[points.length - 1].z],
            [hoverPos.x, hoverPos.y, hoverPos.z]
          ]}
          color={isSnappingToStart ? "#ef4444" : "#4a7fa5"}
          lineWidth={2}
          dashed
          dashScale={2}
        />
      )}

      {/* Snap Indicator */}
      {isSnappingToStart && hoverPos && (
        <mesh position={hoverPos}>
          <ringGeometry args={[1.5, 2, 32]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}
      
      {/* Cursor Indicator */}
      {!isClosed && hoverPos && !isSnappingToStart && (
         <mesh position={hoverPos}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshBasicMaterial color="#4a7fa5" transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}
