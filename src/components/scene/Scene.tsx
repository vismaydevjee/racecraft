import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls, ContactShadows } from '@react-three/drei';
import { TrackRenderer } from '../track/TrackRenderer';
import { PitLane } from '../track/PitLane';
import { Grandstands } from '../track/Grandstands';
import { GhostCar } from '../track/GhostCar';
import { SpeedHeatmap } from '../track/SpeedHeatmap';
import { PlacementController } from '../interaction/PlacementController';
import { useTrackStore } from '../../store/useTrackStore';
import { useGameStore } from '../../store/useGameStore';
import { useState } from 'react';

export function Scene() {
  const [showHeatmap, setShowHeatmap] = useState(false);

  return (
    <div className="w-full h-screen bg-[#0a0f1e]">
      <Canvas
        camera={{ position: [0, 60, 60], fov: 40, far: 1000 }}
        shadows
        dpr={[1, 2]}
      >
        <color attach="background" args={['#0a0f1e']} />
        <fog attach="fog" args={['#0a0f1e', 100, 500]} />
        
        <ambientLight intensity={0.4} />
        <directionalLight 
          position={[50, 80, 50]} 
          intensity={1.5} 
          castShadow 
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0001}
          shadow-camera-left={-100}
          shadow-camera-right={100}
          shadow-camera-top={100}
          shadow-camera-bottom={-100}
        />
        
        <Environment preset="city" />
        
        <group position={[0, -0.1, 0]}>
            <TrackRenderer />
            <PitLane />
            <GhostCar />
            {showHeatmap && <SpeedHeatmap />}
            <PlacementController />
        </group>

        <ContactShadows 
            resolution={1024} 
            scale={500} 
            blur={2} 
            opacity={0.5} 
            far={20} 
            color="#000000" 
        />
        
        <OrbitControls 
          makeDefault 
          minPolarAngle={0} 
          maxPolarAngle={Math.PI / 2.2}
          minDistance={10}
          maxDistance={400}
          enabled={!useTrackStore((state) => state.isDragging)}
        />
        
        <gridHelper args={[500, 100, '#1e3a5a', '#0f1b2d']} position={[0, -0.2, 0]} />
      </Canvas>
      
      <UIOverlay showHeatmap={showHeatmap} setShowHeatmap={setShowHeatmap} />
    </div>
  );
}

function UIOverlay({ showHeatmap, setShowHeatmap }: { showHeatmap: boolean, setShowHeatmap: (v: boolean) => void }) {
  const { clearTrack, isClosed, points } = useTrackStore();
  const { speed, gear, maxSpeed, corneringStiffness, acceleration, braking, updatePhysics } = useGameStore();

  return (
    <>
      <div className="fixed top-5 left-5 text-[#4a7fa5] font-mono text-xs pointer-events-none select-none">
        <div className="text-[#6ba3c8] mb-1 font-bold tracking-widest">RACECRAFT</div>
        <div className="opacity-70 leading-relaxed space-y-1">
          <div>STATUS: {isClosed ? 'CIRCUIT CLOSED' : 'DESIGN MODE'}</div>
          <div>POINTS: {points.length}</div>
          {isClosed && (
            <div className="mt-2 text-[#8ac4e8]">
                <div>SPEED: {speed} km/h</div>
                <div>GEAR: {gear}</div>
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-[#4a7fa5]/20">
            CLICK — place point<br/>
            CLOSE — click start point<br/>
            DRAG — move points
          </div>
        </div>
      </div>
      
      {isClosed && (
          <div className="fixed top-5 right-5 w-64 bg-[#0a0f1e]/90 border border-[#4a7fa5]/30 p-4 font-mono text-xs text-[#4a7fa5] pointer-events-auto">
            <div className="text-[#6ba3c8] mb-3 font-bold">PHYSICS SETTINGS</div>
            
            <div className="space-y-3">
                <div>
                    <div className="flex justify-between mb-1">
                        <span>TOP SPEED</span>
                        <span>{maxSpeed} km/h</span>
                    </div>
                    <input 
                        type="range" min="100" max="450" step="10" 
                        value={maxSpeed}
                        onChange={(e) => updatePhysics({ maxSpeed: parseInt(e.target.value) })}
                        className="w-full accent-[#4a7fa5] bg-[#1e3a5a] h-1 appearance-none rounded"
                    />
                </div>

                <div>
                    <div className="flex justify-between mb-1">
                        <span>CORNERING</span>
                        <span>{Math.round(corneringStiffness * 100)}%</span>
                    </div>
                    <input 
                        type="range" min="0" max="1" step="0.05" 
                        value={corneringStiffness}
                        onChange={(e) => updatePhysics({ corneringStiffness: parseFloat(e.target.value) })}
                        className="w-full accent-[#4a7fa5] bg-[#1e3a5a] h-1 appearance-none rounded"
                    />
                </div>

                <div>
                    <div className="flex justify-between mb-1">
                        <span>ACCELERATION</span>
                        <span>{Math.round(acceleration * 100)}%</span>
                    </div>
                    <input 
                        type="range" min="0.1" max="1" step="0.05" 
                        value={acceleration}
                        onChange={(e) => updatePhysics({ acceleration: parseFloat(e.target.value) })}
                        className="w-full accent-[#4a7fa5] bg-[#1e3a5a] h-1 appearance-none rounded"
                    />
                </div>

                <div>
                    <div className="flex justify-between mb-1">
                        <span>BRAKING</span>
                        <span>{Math.round(braking * 100)}%</span>
                    </div>
                    <input 
                        type="range" min="0.1" max="1" step="0.05" 
                        value={braking}
                        onChange={(e) => updatePhysics({ braking: parseFloat(e.target.value) })}
                        className="w-full accent-[#4a7fa5] bg-[#1e3a5a] h-1 appearance-none rounded"
                    />
                </div>
            </div>
          </div>
      )}

      <div className="fixed bottom-5 right-5 flex gap-2 pointer-events-auto">
        {isClosed && (
            <button 
                onClick={() => setShowHeatmap(!showHeatmap)}
                className={`px-4 py-2 border font-mono text-xs transition-colors ${
                    showHeatmap 
                    ? 'bg-[#4a7fa5] text-[#0a0f1e] border-[#4a7fa5]' 
                    : 'bg-[#0f1b2d] text-[#4a7fa5] border-[#4a7fa5]/50 hover:bg-[#4a7fa5] hover:text-[#0a0f1e]'
                }`}
            >
                {showHeatmap ? 'HIDE HEATMAP' : 'SHOW HEATMAP'}
            </button>
        )}
        <button 
          onClick={clearTrack}
          className="px-4 py-2 bg-[#0f1b2d] border border-[#4a7fa5]/50 text-[#4a7fa5] font-mono text-xs hover:bg-[#4a7fa5] hover:text-[#0a0f1e] transition-colors"
        >
          CLEAR TRACK
        </button>
      </div>
    </>
  );
}
