export interface Point {
  x: number;
  y: number;
  z: number;
  id: string;
}

export interface TrackSegment {
  points: Point[];
  length: number;
  curvature: number[];
}

export interface TrackData {
  points: Point[];
  isClosed: boolean;
  tension: number;
  width: number;
}
