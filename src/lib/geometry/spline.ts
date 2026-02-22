import * as THREE from 'three';
import { Point } from '../../types/track';

export function getCatmullRomPoints(points: Point[], isClosed: boolean, tension: number = 0.5, segments: number = 20): THREE.Vector3[] {
  if (points.length < 2) return [];

  const vectors = points.map(p => new THREE.Vector3(p.x, p.y, p.z));
  const curve = new THREE.CatmullRomCurve3(vectors, isClosed, 'catmullrom', tension);
  
  // Calculate number of points based on length to maintain consistent density
  // For now, just use a fixed multiplier of input points
  const pointCount = points.length * segments;
  
  // Use getSpacedPoints to ensure points are equidistant along the curve (arc length parameterization)
  // This is crucial for physics and analysis (like finding the longest straight)
  return curve.getSpacedPoints(pointCount);
}
