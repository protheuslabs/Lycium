import * as THREE from "three";
import { addRepeatedObjects, box, cylinder } from "./libraryGeometry";
import { libraryStudyAreas, type StudyAreaKind } from "./libraryLayout";
import type { LibraryMaterials } from "./libraryMaterials";

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
  const start = Math.PI * 0.75;
  const end = Math.PI * 2.25;
  const shell = new THREE.Shape();
  shell.absarc(0, 0, 1.3, start, end, false);
  shell.lineTo(Math.cos(end) * 1.21, Math.sin(end) * 1.21);
  shell.absarc(0, 0, 1.21, end, start, true);
  shell.closePath();
  const geometry = new THREE.ExtrudeGeometry(shell, { depth: 1.45, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.018, bevelThickness: 0.018, curveSegments: 24 });
  geometry.rotateX(-Math.PI / 2);
  const screen = new THREE.Mesh(geometry, materials.felt);
  screen.position.y = 0.06;
  group.add(screen);
  cylinder(group, materials.rug, 1.35, 0.025, [0, 0.015, 0], 48);
  box(group, materials.ochre, [1.55, 0.18, 0.67], [0, 0.49, 0.4], 0.08);
  box(group, materials.ochre, [1.55, 0.66, 0.16], [0, 0.85, 0.73], 0.07);
  for (const x of [-0.66, 0.66]) {
    box(group, materials.black, [0.045, 0.38, 0.045], [x, 0.23, 0.5]);
  }
  box(group, materials.wood, [1.35, 0.065, 0.72], [0, 0.77, -0.47], 0.03);
  cylinder(group, materials.black, 0.045, 0.72, [0, 0.38, -0.48]);
  cylinder(group, materials.black, 0.35, 0.03, [0, 0.04, -0.48]);
  openBook(group, materials, 0, 0.82, -0.45);
  const board = box(group, materials.whiteboard, [0.04, 0.46, 0.62], [1.03, 1.03, 0.05], 0.015);
  board.rotation.y = -0.22;
  box(group, materials.teal, [0.04, 0.06, 0.09], [0.995, 1.21, 0.12]);
  box(group, materials.black, [0.13, 0.025, 0.08], [0.47, 0.82, -0.52], 0.01);
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

function sculpturalSeating(materials: LibraryMaterials) {
  const group = new THREE.Group();
  const profile = [[0.1, 0.03], [0.4, 0.04], [0.72, 0.17], [0.45, 0.33], [0.28, 0.5], [0.45, 0.72], [0.72, 1], [0.73, 1.04], [0.65, 1.02], [0.49, 0.83], [0.26, 0.67], [0, 0.65]].map(([x, y]) => new THREE.Vector2(x, y));
  const geometry = new THREE.LatheGeometry(profile, 48);
  for (const side of [-1, 1]) {
    const chair = new THREE.Mesh(geometry, materials.red);
    chair.position.set(side * 1.1, 0, 0);
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
  };
  for (const kind of Object.keys(makers) as StudyAreaKind[]) {
    addRepeatedObjects(scene, makers[kind](materials), areas.filter((area) => area.kind === kind));
  }
}
