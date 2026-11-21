import { LIBRARY } from "./libraryOrbit";

export type StudyAreaKind = "table" | "pod" | "lounge" | "sculptural" | "carrel" | "sofa" | "topChair";

export function libraryStudyAreas() {
  const styles: Array<{ kind: StudyAreaKind; offset: number; radius: number; footprint: number }> = [
    { kind: "table", offset: 0, radius: 41.8, footprint: 2.45 },
    { kind: "pod", offset: 0.4, radius: 37.5, footprint: 1.4 },
    { kind: "lounge", offset: 0.88, radius: 35.5, footprint: 2.6 },
    { kind: "sculptural", offset: 0.5, radius: 43.2, footprint: 2.15 },
  ];
  const areas = Array.from({ length: 12 }, (_, zone) => styles.map((style) => ({
    ...style,
    kind: style.kind === "lounge" && zone % 2 === 0 ? "sofa" as const : style.kind,
    angle: (zone + style.offset) / 12 * Math.PI * 2,
  }))).flat();
  const pods = Array.from({ length: 12 }, (_, zone) => ({
    kind: "pod" as const,
    radius: 39,
    footprint: 1.4,
    angle: (zone + 0.65) / 12 * Math.PI * 2,
  }));
  const frontPods = Array.from({ length: 12 }, (_, zone) => ({
    kind: "pod" as const,
    radius: 35.2,
    footprint: 1.4,
    angle: (zone + 0.18) / 12 * Math.PI * 2,
  }));
  const orientations = [-1.1, 0.65, 1.6, -0.45, 0.15];
  const carrels = Array.from({ length: 12 }, (_, zone) => ({
    kind: "carrel" as const,
    radius: 44.5,
    footprint: 1.25,
    angle: (zone + 0.22) / 12 * Math.PI * 2,
  }));
  const nearAreas = Array.from({ length: 6 }, (_, index) => [
    { kind: "pod" as const, radius: 33.7, footprint: 1.4, angle: (index * 2 + 0.34) / 12 * Math.PI * 2 },
    { kind: "topChair" as const, radius: 41, footprint: 1.15, angle: (index * 2 + 0.25) / 12 * Math.PI * 2 },
  ]).flat();
  return [...areas, ...pods, ...frontPods, ...carrels, ...nearAreas].map((area, index) => ({
    ...area,
    rotation: area.angle + (area.kind === "pod" ? orientations[index % orientations.length] : 0),
  }));
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

export function libraryUtilityAreas() {
  const outerAreas = Array.from({ length: 12 }, (_, zone) => [
    { kind: "plant" as const, angle: (zone + 0.82) / 12 * Math.PI * 2, radius: 42.2, footprint: 0.7 },
    { kind: zone % 2 === 0 ? "cart" as const : "bin" as const, angle: (zone + 0.5) / 12 * Math.PI * 2, radius: 35, footprint: 0.8 },
  ]).flat();
  const nearPlants = Array.from({ length: 6 }, (_, index) => ({
    kind: "plant" as const, angle: (index * 2 + 0.04) / 12 * Math.PI * 2, radius: 33.2, footprint: 0.7,
  }));
  return [...outerAreas, ...nearPlants].map((area) => ({ ...area, rotation: area.angle + (area.kind === "cart" ? Math.PI / 5 : 0) }));
}
