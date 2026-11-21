import * as THREE from "three";
import { addRepeatedObjects, box, cylinder } from "./libraryGeometry";
import { libraryStudyAreas, type StudyAreaKind } from "./libraryLayout";
import type { LibraryMaterials } from "./libraryMaterials";
import { scaleTextureUVs } from "./libraryTextureScale";

function openBook(group: THREE.Group, materials: LibraryMaterials, x: number, y: number, z: number) {
  for (const side of [-1, 1]) {
    const page = box(group, materials.paper, [0.2, 0.025, 0.3], [x + side * 0.1, y, z]);
    page.rotation.z = side * 0.08;
  }
}

function deskLamp(group: THREE.Group, materials: LibraryMaterials, x: number, y: number, z: number) {
  cylinder(group, materials.brass, 0.1, 0.025, [x, y, z]);
  cylinder(group, materials.brass, 0.015, 0.35, [x, y + 0.18, z]);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.15, 16, 1, true), materials.teal);
  shade.position.set(x, y + 0.38, z);
  group.add(shade);
}

function deskChair(materials: LibraryMaterials) {
  const group = new THREE.Group();
  box(group, materials.upholstery, [0.5, 0.11, 0.5], [0, 0.47, 0], 0.05);
  const back = box(group, materials.upholstery, [0.5, 0.5, 0.1], [0, 0.77, 0.23], 0.04);
  back.rotation.x = -0.09;
  for (const x of [-0.19, 0.19]) for (const z of [-0.19, 0.19]) {
    box(group, materials.wood, [0.045, 0.44, 0.045], [x, 0.22, z]);
  }
  return group;
}

function readingTable(materials: LibraryMaterials) {
  const group = new THREE.Group();
  box(group, materials.rugBlue, [3.7, 0.02, 2.9], [0, 0.02, 0], 0.01);
  box(group, materials.wood, [3.6, 0.1, 1.4], [0, 0.76, 0], 0.045);
  for (const x of [-1.5, 1.5]) for (const z of [-0.5, 0.5]) {
    box(group, materials.wood, [0.09, 0.71, 0.09], [x, 0.355, z]);
  }
  for (const x of [-1.15, 0, 1.15]) for (const z of [-1.1, 1.1]) {
    const chair = deskChair(materials);
    chair.position.set(x, 0, z);
    chair.rotation.y = z < 0 ? Math.PI : 0;
    group.add(chair);
  }
  for (const x of [-1.1, 1.1]) {
    deskLamp(group, materials, x, 0.83, 0);
    openBook(group, materials, x, 0.84, -0.4);
  }
  box(group, materials.black, [0.45, 0.025, 0.32], [0, 0.835, 0.3], 0.01);
  const display = box(group, materials.black, [0.45, 0.29, 0.025], [0, 0.98, 0.43], 0.01);
  display.rotation.x = -0.14;
  return group;
}

function studyPod(materials: LibraryMaterials) {
  const group = new THREE.Group();
  const innerRadius = 1.21;
  const seatOffset = 0.16;
  const backCenter = 0.73;
  const backDepth = 0.16;
  // Wrap the full desktop arc; leave the entry on the seat's front-right side.
  const start = Math.PI / 2;
  const end = Math.PI * 2 + Math.acos((seatOffset + backCenter + backDepth / 2) / innerRadius);
  const shell = new THREE.Shape();
  shell.absarc(0, 0, 1.3, start, end, false);
  shell.lineTo(Math.cos(end) * innerRadius, Math.sin(end) * innerRadius);
  shell.absarc(0, 0, innerRadius, end, start, true);
  shell.closePath();
  const geometry = new THREE.ExtrudeGeometry(shell, { depth: 1.45, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.018, bevelThickness: 0.018, curveSegments: 24 });
  geometry.rotateX(-Math.PI / 2);
  scaleTextureUVs(geometry, 1 / 0.6, 1 / 0.6);
  const screen = new THREE.Mesh(geometry, materials.felt);
  screen.position.y = 0.06;
  group.add(screen);
  cylinder(group, materials.rug, 1.35, 0.025, [0, 0.015, 0], 48);
  const workspace = new THREE.Group();
  workspace.rotation.y = Math.PI / 2;
  group.add(workspace);
  const seating = new THREE.Group();
  seating.position.z = seatOffset;
  workspace.add(seating);
  box(seating, materials.ochre, [1.55, 0.18, 0.67], [0, 0.49, 0.4], 0.08);
  box(seating, materials.ochre, [1.55, 0.66, backDepth], [0, 0.85, backCenter], 0.07);
  for (const x of [-0.66, 0.66]) {
    box(seating, materials.black, [0.045, 0.38, 0.045], [x, 0.23, 0.5]);
  }
  const desktopProfile = new THREE.Shape();
  desktopProfile.absarc(0, 0, innerRadius, 0, Math.PI, false);
  desktopProfile.closePath();
  const desktopGeometry = new THREE.ExtrudeGeometry(desktopProfile, { depth: 0.075, bevelEnabled: false, curveSegments: 32 });
  desktopGeometry.rotateX(-Math.PI / 2);
  const desktop = new THREE.Mesh(desktopGeometry, materials.whiteboard);
  desktop.position.y = 0.73;
  workspace.add(desktop);
  openBook(workspace, materials, 0, 0.82, -0.45);
  box(workspace, materials.black, [0.13, 0.025, 0.08], [0.47, 0.82, -0.52], 0.01);
  return group;
}

function armchair(materials: LibraryMaterials) {
  const group = new THREE.Group();
  box(group, materials.upholstery, [0.9, 0.28, 0.84], [0, 0.43, 0], 0.1);
  const back = box(group, materials.upholstery, [0.9, 0.8, 0.23], [0, 0.85, 0.35], 0.1);
  back.rotation.x = -0.16;
  for (const x of [-0.5, 0.5]) {
    box(group, materials.upholstery, [0.18, 0.46, 0.88], [x, 0.62, 0.02], 0.08);
    for (const z of [-0.26, 0.3]) cylinder(group, materials.wood, 0.035, 0.27, [x * 0.8, 0.14, z]);
  }
  const cushion = box(group, materials.ochre, [0.42, 0.38, 0.16], [0.15, 0.76, 0.17], 0.07);
  cushion.rotation.z = 0.2;
  box(group, materials.upholstery, [0.7, 0.22, 0.53], [0, 0.28, -1], 0.1);
  for (const x of [-0.24, 0.24]) for (const z of [-1.15, -0.85]) cylinder(group, materials.wood, 0.025, 0.18, [x, 0.1, z]);
  return group;
}

function readingLounge(materials: LibraryMaterials) {
  const group = new THREE.Group();
  cylinder(group, materials.rug, 2.5, 0.025, [0, 0.015, -0.2], 64);
  for (const side of [-1, 1]) {
    const chair = armchair(materials);
    chair.position.set(side * 1.15, 0.03, 0.25);
    chair.rotation.y = side * 0.18;
    group.add(chair);
  }
  cylinder(group, materials.wood, 0.4, 0.065, [0, 0.6, 0]);
  cylinder(group, materials.brass, 0.035, 0.55, [0, 0.3, 0]);
  cylinder(group, materials.brass, 0.25, 0.025, [0, 0.04, 0]);
  openBook(group, materials, 0, 0.65, 0);
  cylinder(group, materials.black, 0.22, 0.04, [1.95, 0.05, 0.65]);
  cylinder(group, materials.brass, 0.023, 1.75, [1.95, 0.92, 0.65]);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 0.4, 24, 1, true), materials.paper);
  shade.position.set(1.95, 1.84, 0.65);
  group.add(shade);
  return group;
}

function studyCarrel(materials: LibraryMaterials) {
  const group = new THREE.Group();
  box(group, materials.wood, [1.35, 0.065, 0.78], [0, 0.76, 0.15], 0.025);
  box(group, materials.felt, [1.4, 0.65, 0.065], [0, 1.08, 0.56], 0.02);
  for (const x of [-0.69, 0.69]) {
    box(group, materials.felt, [0.065, 0.65, 0.85], [x, 1.08, 0.15], 0.02);
    for (const z of [-0.14, 0.47]) box(group, materials.black, [0.045, 0.73, 0.045], [x * 0.88, 0.365, z]);
  }
  const chair = deskChair(materials);
  chair.position.z = -0.62;
  chair.rotation.y = Math.PI;
  group.add(chair);
  deskLamp(group, materials, 0.45, 0.81, 0.3);
  openBook(group, materials, -0.12, 0.82, 0.05);
  box(group, materials.black, [0.18, 0.07, 0.02], [-0.42, 0.86, 0.51], 0.01);
  return group;
}

function sofaGroup(materials: LibraryMaterials) {
  const group = new THREE.Group();
  cylinder(group, materials.rug, 2.5, 0.025, [0, 0.015, 0], 64);
  for (const side of [-1, 1]) {
    const sofa = new THREE.Group();
    box(sofa, materials.upholstery, [2.55, 0.28, 0.9], [0, 0.35, 0], 0.09);
    box(sofa, materials.upholstery, [2.55, 0.7, 0.23], [0, 0.77, 0.36], 0.09);
    for (const x of [-0.76, 0, 0.76]) box(sofa, materials.upholstery, [0.73, 0.16, 0.72], [x, 0.55, -0.04], 0.07);
    for (const x of [-1.23, 1.23]) {
      box(sofa, materials.upholstery, [0.18, 0.46, 0.9], [x, 0.62, 0], 0.07);
      for (const z of [-0.28, 0.28]) cylinder(sofa, materials.wood, 0.035, 0.22, [x * 0.9, 0.12, z]);
      const pillow = box(sofa, materials.ochre, [0.4, 0.38, 0.17], [x * 0.7, 0.77, 0.15], 0.065);
      pillow.rotation.z = Math.sign(x) * 0.17;
    }
    sofa.position.z = side * 1.25;
    sofa.rotation.y = side < 0 ? Math.PI : 0;
    group.add(sofa);
  }
  box(group, materials.wood, [1.5, 0.07, 0.65], [0, 0.44, 0], 0.03);
  for (const x of [-0.58, 0.58]) for (const z of [-0.2, 0.2]) cylinder(group, materials.brass, 0.025, 0.4, [x, 0.21, z]);
  openBook(group, materials, -0.3, 0.5, 0);
  box(group, materials.paper, [0.3, 0.045, 0.23], [0.37, 0.51, 0.05]);
  return group;
}

export function spinningChair(materials: Pick<LibraryMaterials, "red" | "blue" | "orange">, colorOffset = 0, leanDirection = 1) {
  const group = new THREE.Group();
  const profile = [[0, 0], [0.08, 0.04], [0.3, 0.16], [0.72, 0.38], [0.74, 0.41], [0.48, 0.49], [0.29, 0.65], [0.47, 0.88], [0.72, 1.15], [0.73, 1.19], [0.65, 1.17], [0.49, 0.99], [0.26, 0.83], [0, 0.81]].map(([x, y]) => new THREE.Vector2(x, y));
  const geometry = new THREE.LatheGeometry(profile, 48);
  const colors = [materials.red, materials.blue, materials.orange];
  const chair = new THREE.Mesh(geometry, colors[colorOffset % colors.length]);
  chair.rotation.z = 0.35 * leanDirection;
  chair.rotation.x = -0.12 * leanDirection;
  chair.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(chair, true);
  chair.position.y = -bounds.min.y;
  group.add(chair);
  return group;
}

function sculpturalSeating(materials: LibraryMaterials, colorOffset = 0) {
  const group = new THREE.Group();
  for (const side of [-1, 1]) {
    const chair = spinningChair(materials, colorOffset + (side === 1 ? 1 : 0));
    chair.position.x = side * 1.1;
    group.add(chair);
  }
  cylinder(group, materials.wood, 0.38, 0.055, [0, 0.52, -0.4]);
  cylinder(group, materials.black, 0.04, 0.48, [0, 0.25, -0.4]);
  cylinder(group, materials.black, 0.25, 0.035, [0, 0.04, -0.4]);
  openBook(group, materials, 0, 0.57, -0.4);
  return group;
}

export function addLibraryFurniture(scene: THREE.Scene, materials: LibraryMaterials) {
  const areas = libraryStudyAreas();
  const makers: Record<StudyAreaKind, (materials: LibraryMaterials) => THREE.Group> = {
    table: readingTable,
    pod: studyPod,
    lounge: readingLounge,
    sculptural: sculpturalSeating,
    carrel: studyCarrel,
    sofa: sofaGroup,
    topChair: (m) => spinningChair(m, 0, -1),
  };
  for (const kind of Object.keys(makers) as StudyAreaKind[]) {
    const placements = areas.filter((area) => area.kind === kind);
    if (kind === "sculptural" || kind === "topChair") {
      for (let color = 0; color < 3; color += 1) {
        const prototype = kind === "topChair" ? spinningChair(materials, color, -1) : sculpturalSeating(materials, color);
        addRepeatedObjects(scene, prototype, placements.filter((_, index) => index % 3 === color), true);
      }
    } else addRepeatedObjects(scene, makers[kind](materials), placements, true);
  }
}
