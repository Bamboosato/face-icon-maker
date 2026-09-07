const FACE_CENTER_LANDMARKS = [10, 152, 234, 454] as const;

export interface Landmark2D {
  x: number;
  y: number;
}

export interface NormalizedPoint {
  x: number;
  y: number;
}

export function selectClosestFaceLandmarks<T extends NormalizedPoint>(
  candidates: readonly (readonly T[])[],
  targetCenter: NormalizedPoint,
): readonly T[] | undefined {
  let closest: readonly T[] | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const center = getLandmarkCenter(candidate);

    if (!center) {
      continue;
    }

    const distance = Math.hypot(center.x - targetCenter.x, center.y - targetCenter.y);

    if (distance < closestDistance) {
      closest = candidate;
      closestDistance = distance;
    }
  }

  return closest;
}

function getLandmarkCenter<T extends NormalizedPoint>(landmarks: readonly T[]): Landmark2D | null {
  const points = FACE_CENTER_LANDMARKS.map((index) => landmarks[index]);

  if (!points.every(isValidPoint)) {
    return null;
  }

  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function isValidPoint(point: NormalizedPoint | undefined): point is NormalizedPoint {
  return Boolean(
    point &&
      Number.isFinite(point.x) &&
      Number.isFinite(point.y),
  );
}
