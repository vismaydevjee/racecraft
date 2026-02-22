import { create } from 'zustand';

interface GameState {
  speed: number;
  gear: number;
  // Physics Settings
  maxSpeed: number;
  corneringStiffness: number;
  acceleration: number;
  braking: number;
  
  setTelemetry: (speed: number) => void;
  updatePhysics: (params: Partial<Omit<GameState, 'speed' | 'gear' | 'setTelemetry' | 'updatePhysics'>>) => void;
}

export const useGameStore = create<GameState>((set) => ({
  speed: 0,
  gear: 1,
  maxSpeed: 320, // km/h
  corneringStiffness: 0.5, // 0-1 (1 = F1 car, 0 = Truck)
  acceleration: 0.8, // 0-1
  braking: 0.9, // 0-1

  setTelemetry: (speed) => set({ 
      speed: Math.round(speed), 
      gear: Math.max(1, Math.min(8, Math.floor(speed / 40) + 1)) 
  }),
  
  updatePhysics: (params) => set((state) => ({ ...state, ...params })),
}));
