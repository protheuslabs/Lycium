import * as THREE from "three";
import type { LibraryMaterials } from "./libraryMaterials";
import { LIBRARY } from "./libraryOrbit";
import { addRepeatedObjects, box, cylinder, type LibraryPlacement } from "./libraryGeometry";
import { libraryWallDisplays } from "./libraryLayout";

function rollingLadder(materials: LibraryMaterials) {
  const group = new THREE.Group();
  const height = 4.5;
  const lean = 0.72;
  const angle = Math.atan2(lean, height);
  for (const x of [-0.34, 0.34]) {
    const rail = box(group, materials.wood, [0.075, Math.hypot(height, lean), 0.1], [x, height / 2 + 0.12, lean / 2]);
    rail.rotation.x = angle;
    const wheel = cylinder(group, materials.black, 0.095, 0.06, [x, 0.1, 0]);
    wheel.rotation.z = Math.PI / 2;
    const bracket = cylinder(group, materials.brass, 0.065, 0.05, [x, height + 0.08, lean + 0.03]);
    bracket.rotation.z = Math.PI / 2;
  }
  for (let rung = 1; rung <= 13; rung += 1) {
    const y = rung / 14 * height;
    box(group, materials.wood, [0.69, 0.065, 0.1], [0, y + 0.12, y / height * lean]);
  }
  return group;
}

function scrolls(materials: LibraryMaterials) {
  const group = new THREE.Group();
  for (let row = 0; row < 3; row += 1) {
    for (let index = 0; index < 5 - row; index += 1) {
      const x = (index - (4 - row) / 2) * 0.22;
      const roll = cylinder(group, materials.paper, 0.095, 0.5, [x, 0.11 + row * 0.19, 0]);
      roll.rotation.x = Math.PI / 2;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.071, 0.009, 5, 20), materials.wood);
      rim.position.set(x, 0.11 + row * 0.19, -0.255);
      group.add(rim);
    }
  }
  return group;
}

function globe(materials: LibraryMaterials) {
  const group = new THREE.Group();
  cylinder(group, materials.brass, 0.24, 0.04, [0, 0.03, 0]);
  cylinder(group, materials.brass, 0.035, 0.25, [0, 0.14, 0]);
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 16), materials.teal);
  sphere.position.y = 0.46;
  group.add(sphere);
  for (const tilt of [0, Math.PI / 2, Math.PI / 4]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.012, 5, 40), materials.brass);
    ring.position.y = 0.46;
    ring.rotation.set(Math.PI / 2, tilt, 0.25);
    group.add(ring);
  }
  return group;
}

function laptop(materials: LibraryMaterials, vintage: boolean) {
  const group = new THREE.Group();
  const shell = vintage ? materials.marble : materials.black;
  box(group, shell, [0.95, 0.05, 0.52], [0, 0.04, -0.05]);
  box(group, shell, [0.9, 0.58, vintage ? 0.4 : 0.045], [0, 0.35, 0.13]);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.77, 0.45), materials.screen);
  screen.rotation.y = Math.PI;
  screen.position.set(0, 0.36, vintage ? -0.075 : 0.103);
  group.add(screen);
  for (let row = 0; row < 3; row += 1) {
    for (let key = 0; key < 10; key += 1) {
      box(group, vintage ? materials.wood : materials.marble, [0.055, 0.012, 0.045], [(key - 4.5) * 0.075, 0.075, -0.2 + row * 0.06]);
    }
  }
  return group;
}

function camera(materials: LibraryMaterials) {
  const group = new THREE.Group();
  box(group, materials.black, [0.8, 0.42, 0.3], [0, 0.23, 0]);
  box(group, materials.brass, [0.8, 0.05, 0.32], [0, 0.44, 0]);
  box(group, materials.black, [0.25, 0.14, 0.22], [0, 0.5, 0]);
  const lens = cylinder(group, materials.brass, 0.19, 0.2, [0, 0.23, -0.23]);
  lens.rotation.x = Math.PI / 2;
  const glass = cylinder(group, materials.teal, 0.155, 0.012, [0, 0.23, -0.34]);
  glass.rotation.x = Math.PI / 2;
  return group;
}

function bust(materials: LibraryMaterials) {
  const group = new THREE.Group();
  box(group, materials.marble, [0.55, 0.08, 0.38], [0, 0.04, 0]);
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.29, 20, 12), materials.marble);
  torso.scale.set(1, 0.6, 0.65);
  torso.position.y = 0.23;
  group.add(torso);
  cylinder(group, materials.marble, 0.09, 0.16, [0, 0.43, 0]);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 16), materials.marble);
  head.scale.set(0.85, 1.2, 0.9);
  head.position.y = 0.64;
  group.add(head);
  box(group, materials.marble, [0.055, 0.075, 0.07], [0, 0.64, -0.14]);
  return group;
}

function clock(materials: LibraryMaterials) {
  const group = new THREE.Group();
  box(group, materials.wood, [0.5, 0.68, 0.24], [0, 0.36, 0]);
  const face = cylinder(group, materials.paper, 0.2, 0.025, [0, 0.43, -0.14]);
  face.rotation.x = Math.PI / 2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.018, 6, 32), materials.brass);
  rim.position.set(0, 0.43, -0.16);
  group.add(rim);
  box(group, materials.black, [0.015, 0.13, 0.01], [0, 0.49, -0.16]);
  const hand = box(group, materials.black, [0.12, 0.015, 0.01], [0.055, 0.43, -0.17]);
  hand.rotation.z = -0.2;
  return group;
}

function amphora(materials: LibraryMaterials) {
  const group = new THREE.Group();
  const profile = [[0.1, 0], [0.13, 0.04], [0.22, 0.2], [0.24, 0.38], [0.18, 0.5], [0.09, 0.57], [0.09, 0.65], [0.14, 0.67]];
  group.add(new THREE.Mesh(new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 24), materials.teal));
  for (const side of [-1, 1]) {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 8, 20), materials.brass);
    handle.scale.y = 1.35;
    handle.position.set(side * 0.19, 0.48, 0);
    group.add(handle);
  }
  return group;
}

function telescope(materials: LibraryMaterials) {
  const group = new THREE.Group();
  for (const x of [-0.25, 0.25]) {
    const leg = box(group, materials.wood, [0.035, 0.44, 0.035], [x / 2, 0.22, 0]);
    leg.rotation.z = Math.sign(x) * 0.5;
  }
  box(group, materials.wood, [0.035, 0.4, 0.035], [0, 0.2, 0.17]);
  const scope = cylinder(group, materials.brass, 0.065, 0.84, [0, 0.53, 0]);
  scope.rotation.z = 1.25;
  const lens = cylinder(group, materials.teal, 0.07, 0.045, [-0.4, 0.66, 0]);
  lens.rotation.z = 1.25;
  return group;
}

function microscope(materials: LibraryMaterials) {
  const group = new THREE.Group();
  box(group, materials.black, [0.43, 0.045, 0.35], [0, 0.025, 0]);
  const support = box(group, materials.brass, [0.06, 0.43, 0.08], [0.06, 0.25, 0.09]);
  support.rotation.z = -0.3;
  box(group, materials.black, [0.32, 0.03, 0.25], [0, 0.22, -0.03]);
  const tube = cylinder(group, materials.brass, 0.045, 0.34, [-0.03, 0.49, 0]);
  tube.rotation.z = -0.35;
  cylinder(group, materials.black, 0.058, 0.06, [0.03, 0.66, 0]);
  const dial = cylinder(group, materials.black, 0.07, 0.12, [0.12, 0.37, 0.08]);
  dial.rotation.z = Math.PI / 2;
  return group;
}

function radio(materials: LibraryMaterials) {
  const group = new THREE.Group();
  box(group, materials.wood, [0.82, 0.53, 0.3], [0, 0.28, 0], 0.05);
  box(group, materials.black, [0.42, 0.35, 0.025], [-0.13, 0.29, -0.165]);
  for (let index = 0; index < 7; index += 1) box(group, materials.brass, [0.014, 0.33, 0.012], [-0.31 + index * 0.06, 0.29, -0.185]);
  for (const y of [0.18, 0.37]) {
    const dial = cylinder(group, materials.brass, 0.055, 0.025, [0.27, y, -0.18]);
    dial.rotation.x = Math.PI / 2;
  }
  return group;
}

function circuitBoard(materials: LibraryMaterials) {
  const group = new THREE.Group();
  box(group, materials.wood, [0.72, 0.045, 0.35], [0, 0.025, 0]);
  const board = new THREE.Group();
  box(board, materials.teal, [0.65, 0.46, 0.02], [0, 0, 0]);
  for (let row = 0; row < 2; row += 1) for (let col = 0; col < 3; col += 1) {
    const x = (col - 1) * 0.18;
    const y = (row - 0.5) * 0.19;
    box(board, materials.black, [0.105, 0.085, 0.035], [x, y, -0.025]);
    for (const side of [-1, 1]) {
      box(board, materials.brass, [0.14, 0.008, 0.006], [x, y + side * 0.055, -0.017]);
    }
  }
  board.rotation.x = -0.15;
  board.position.set(0, 0.31, 0);
  group.add(board);
  return group;
}

export function addLibraryArtifacts(scene: THREE.Scene, materials: LibraryMaterials) {
  const makers = [scrolls, globe, camera, bust, clock, (m: LibraryMaterials) => laptop(m, true), (m: LibraryMaterials) => laptop(m, false), amphora, telescope, microscope, radio, circuitBoard];
  const displays = libraryWallDisplays();
  makers.forEach((make, variant) => {
    addRepeatedObjects(scene, make(materials), displays.filter((display) => display.variant === variant));
  });
  const ladders: LibraryPlacement[] = [];
  for (let level = 0; level < LIBRARY.levels; level += 1) {
    for (let bay = 0; bay < LIBRARY.bays; bay += 4) {
      ladders.push({
        angle: (bay + 0.5) / LIBRARY.bays * Math.PI * 2,
        radius: LIBRARY.wallRadius - 1.65,
        height: level * LIBRARY.levelHeight + (level ? 0.18 : 0),
      });
    }
  }
  addRepeatedObjects(scene, rollingLadder(materials), ladders);
}
