import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { Point, TrackData } from '../types/track';

interface TrackState {
  points: Point[];
  isClosed: boolean;
  hoveredPointId: string | null;
  draggedPointId: string | null;
  isDragging: boolean;
  
  // Actions
  addPoint: (point: Omit<Point, 'id'>) => void;
  updatePoint: (id: string, pos: Partial<Point>) => void;
  removePoint: (id: string) => void;
  setHoveredPoint: (id: string | null) => void;
  setDraggedPoint: (id: string | null) => void;
  setIsDragging: (isDragging: boolean) => void;
  closeTrack: () => void;
  openTrack: () => void;
  clearTrack: () => void;
}

export const useTrackStore = create<TrackState>((set) => ({
  points: [],
  isClosed: false,
  hoveredPointId: null,
  draggedPointId: null,
  isDragging: false,

  addPoint: (point) => set((state) => {
    if (state.isClosed) return state;
    return {
      points: [...state.points, { ...point, id: uuidv4() }]
    };
  }),

  updatePoint: (id, pos) => set((state) => ({
    points: state.points.map((p) => p.id === id ? { ...p, ...pos } : p)
  })),

  removePoint: (id) => set((state) => ({
    points: state.points.filter((p) => p.id !== id)
  })),

  setHoveredPoint: (id) => set({ hoveredPointId: id }),
  setDraggedPoint: (id) => set({ draggedPointId: id }),
  setIsDragging: (isDragging) => set({ isDragging }),

  closeTrack: () => set({ isClosed: true }),
  openTrack: () => set({ isClosed: false }),
  clearTrack: () => set({ points: [], isClosed: false }),
}));
