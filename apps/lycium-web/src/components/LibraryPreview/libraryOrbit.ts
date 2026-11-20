export const LIBRARY = {
  wallRadius: 48,
  cameraRadius: 30,
  eyeHeight: 1.65,
  pitchDegrees: 18,
  shelfHeight: 30.48,
  bays: 48,
  levels: 5,
  rowsPerLevel: 6,
  levelHeight: 6,
  defaultDuration: 120,
} as const;

export function wrapPhase(phase: number) {
  if (!Number.isFinite(phase)) return 0;
  return ((phase % 1) + 1) % 1;
}

export function libraryCameraPose(phase: number) {
  const angle = wrapPhase(phase) * Math.PI * 2;
  const sine = Math.sin(angle);
  const cosine = Math.cos(angle);
  const rise = (LIBRARY.wallRadius - LIBRARY.cameraRadius)
    * Math.tan(LIBRARY.pitchDegrees * Math.PI / 180);
  return {
    position: { x: sine * LIBRARY.cameraRadius, y: LIBRARY.eyeHeight, z: cosine * LIBRARY.cameraRadius },
    target: { x: sine * LIBRARY.wallRadius, y: LIBRARY.eyeHeight + rise, z: cosine * LIBRARY.wallRadius },
  };
}

export function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}
