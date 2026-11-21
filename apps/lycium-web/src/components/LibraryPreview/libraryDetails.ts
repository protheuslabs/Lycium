import * as THREE from "three";
import { addRepeatedObjects, box, cylinder } from "./libraryGeometry";
import { libraryStudyAreas, libraryUtilityAreas } from "./libraryLayout";
import type { LibraryMaterials } from "./libraryMaterials";
import { cartShelfBooks } from "./libraryCartLayout";
import { createLibraryLeaf } from "./libraryPlantGeometry";
import { addBoundBook } from "./libraryBookGeometry";

function plant(materials: LibraryMaterials) {
  const group = new THREE.Group();
  const potProfile = new THREE.SplineCurve([[0.17, 0.035], [0.27, 0.07], [0.36, 0.19], [0.39, 0.34], [0.35, 0.49], [0.28, 0.58], [0.275, 0.6], [0.26, 0.6], [0.255, 0.575]].map(([x, y]) => new THREE.Vector2(x, y)));
  const pot = new THREE.Mesh(new THREE.LatheGeometry(potProfile.getPoints(40), 32), materials.ceramic);
  group.add(pot);
  cylinder(group, materials.ceramic, 0.17, 0.035, [0, 0.025, 0]);
  cylinder(group, materials.soil, 0.255, 0.025, [0, 0.57, 0]);
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.025, 1.5, 12), materials.stalk);
  stalk.position.y = 1.32;
  group.add(stalk);
  const leafShape = createLibraryLeaf();
  for (let index = 0; index < 20; index += 1) {
    const angle = index * 2.4;
    const height = 0.8 + index / 20 * 1.05;
    const leaf = new THREE.Mesh(leafShape, materials.foliage);
    const lengthScale = 0.82 + (index % 4) * 0.06;
    leaf.scale.setScalar(lengthScale);
    leaf.position.set(Math.sin(angle) * 0.009, height, Math.cos(angle) * 0.009);
    const direction = new THREE.Vector3(Math.sin(angle), 1, Math.cos(angle)).normalize();
    leaf.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
    group.add(leaf);
  }
  return group;
}

function bookCart(materials: LibraryMaterials, variant: number) {
  const group = new THREE.Group();
  const bindings = [materials.book, materials.bookCloth, materials.bookLinen];
  const covers = [0x4f5756, 0x5e5045, 0x3d4d58, 0x6a6153, 0x665152, 0x4a5949].map((color, index) => {
    const material = bindings[index % bindings.length].clone();
    material.color.setHex(color);
    return material;
  });
  for (const [row, height] of [0.2, 0.6, 1].entries()) {
    box(group, materials.wood, [1, 0.055, 0.5], [0, height, 0]);
    for (const entry of cartShelfBooks(variant, row)) {
      const book = addBoundBook(group, covers[entry.cover], materials.pages, [entry.width, entry.height, entry.depth], [entry.x, height + 0.028 + entry.y, entry.z]);
      book.rotation.z = entry.tilt;
    }
  }
  for (const x of [-0.47, 0.47]) for (const z of [-0.2, 0.2]) {
    box(group, materials.teal, [0.035, 1.1, 0.035], [x, 0.63, z]);
    const wheel = cylinder(group, materials.black, 0.07, 0.04, [x, 0.075, z]);
    wheel.rotation.z = Math.PI / 2;
  }
  box(group, materials.brass, [0.035, 0.035, 0.46], [0.47, 1.2, 0]);
  return group;
}

function wasteStation(materials: LibraryMaterials) {
  const group = new THREE.Group();
  for (const x of [-0.22, 0.22]) {
    box(group, materials.felt, [0.36, 0.8, 0.36], [x, 0.415, 0], 0.04);
    box(group, x < 0 ? materials.blue : materials.teal, [0.38, 0.04, 0.38], [x, 0.84, 0], 0.02);
    box(group, materials.black, [0.21, 0.012, 0.12], [x, 0.865, 0], 0.005);
    box(group, x < 0 ? materials.blue : materials.teal, [0.25, 0.3, 0.012], [x, 0.5, -0.185], 0.005);
  }
  return group;
}

function mug(group: THREE.Group, materials: LibraryMaterials, x: number, y: number, z: number) {
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.037, 0.1, 16, 1, true), materials.ceramic);
  cup.position.set(x, y + 0.05, z);
  group.add(cup);
  cylinder(group, materials.soil, 0.04, 0.005, [x, y + 0.09, z]);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.009, 6, 12), materials.ceramic);
  handle.position.set(x + 0.05, y + 0.05, z);
  group.add(handle);
}

function deskBelongings(materials: LibraryMaterials) {
  const group = new THREE.Group();
  box(group, materials.felt, [0.4, 0.48, 0.2], [1.42, 0.26, -0.1], 0.07);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 6, 16, Math.PI), materials.black);
  handle.position.set(1.42, 0.5, -0.1);
  group.add(handle);
  box(group, materials.teal, [0.27, 0.025, 0.34], [0.5, 0.83, -0.36], 0.008);
  box(group, materials.paper, [0.25, 0.014, 0.32], [0.5, 0.845, -0.36]);
  const pencil = box(group, materials.ochre, [0.012, 0.012, 0.16], [0.54, 0.862, -0.35]);
  pencil.rotation.y = 0.3;
  mug(group, materials, 0.78, 0.815, -0.4);
  const headphones = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.013, 7, 18, Math.PI * 1.4), materials.black);
  headphones.rotation.x = Math.PI / 2;
  headphones.position.set(-0.5, 0.84, 0.35);
  group.add(headphones);
  for (const x of [-0.58, -0.42]) box(group, materials.black, [0.045, 0.03, 0.07], [x, 0.85, 0.39], 0.01);
  const display = new THREE.Mesh(new THREE.PlaneGeometry(0.39, 0.22), materials.screen);
  display.rotation.set(0.14, Math.PI, 0);
  display.position.set(0, 0.98, 0.414);
  group.add(display);
  return group;
}

function chargingStrip(materials: LibraryMaterials) {
  const group = new THREE.Group();
  box(group, materials.black, [0.32, 0.025, 0.09], [0, 0.825, 0]);
  for (const x of [-0.09, 0, 0.09]) for (const offset of [-0.013, 0.013]) {
    box(group, materials.ceramic, [0.012, 0.004, 0.025], [x + offset, 0.84, 0]);
  }
  return group;
}

function loungeBelongings(materials: LibraryMaterials) {
  const group = new THREE.Group();
  box(group, materials.ochre, [0.38, 0.48, 0.22], [-1.65, 0.26, -0.55], 0.065);
  box(group, materials.black, [0.26, 0.025, 0.025], [-1.65, 0.52, -0.55], 0.01);
  box(group, materials.teal, [0.25, 0.025, 0.32], [0.38, 0.49, -0.02], 0.008);
  mug(group, materials, 0.5, 0.48, 0.15);
  return group;
}

export function addLibraryDetails(scene: THREE.Scene, materials: LibraryMaterials) {
  const utilityAreas = libraryUtilityAreas();
  for (const [kind, make] of Object.entries({ plant, bin: wasteStation })) {
    addRepeatedObjects(scene, make(materials), utilityAreas.filter((area) => area.kind === kind), true);
  }
  utilityAreas.filter((area) => area.kind === "cart").forEach((placement, index) => {
    addRepeatedObjects(scene, bookCart(materials, index), [placement], true);
  });
  const tables = libraryStudyAreas().filter((area) => area.kind === "table");
  addRepeatedObjects(scene, deskBelongings(materials), tables.filter((_, index) => index % 3 === 0), true);
  addRepeatedObjects(scene, chargingStrip(materials), tables, true);
  const sofas = libraryStudyAreas().filter((area) => area.kind === "sofa");
  addRepeatedObjects(scene, loungeBelongings(materials), sofas, true);
}
