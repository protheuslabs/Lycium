import { LIBRARY } from "./libraryOrbit";

export type StudyAreaKind = "table" | "pod" | "lounge" | "sculptural";

export function libraryStudyAreas() {
  const styles: Array<{ kind: StudyAreaKind; offset: number; radius: number; footprint: number }> = [
    { kind: "table", offset: 0, radius: 41.8, footprint: 2.45 },
    { kind: "pod", offset: 0.4, radius: 37.5, footprint: 1.4 },
    { kind: "lounge", offset: 0.88, radius: 35.5, footprint: 2.6 },
    { kind: "sculptural", offset: 0.5, radius: 43.2, footprint: 2.15 },
  ];
  return Array.from({ length: 12 }, (_, zone) => styles.map((style) => ({
    ...style,
    angle: (zone + style.offset) / 12 * Math.PI * 2,
  }))).flat();
}

export function libraryWallDisplays() {
  return Array.from({ length: LIBRARY.levels }, (_, level) =>
    Array.from({ length: LIBRARY.bays / 3 }, (_, index) =>
      [1, 2, 3].map((row) => ({
        angle: (index * 3 + 1.5) / LIBRARY.bays * Math.PI * 2,
        radius: LIBRARY.wallRadius - 0.85,
        height: level * LIBRARY.levelHeight + row * 0.87 + 0.32,
        variant: (index * 3 + level * 7 + row) % 12,
      })),
    ).flat(),
  ).flat();
}
