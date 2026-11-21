import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { scaleBoxTextureUVs, scaleCylinderTextureUVs } from "./libraryTextureScale";
import { addCushionPiping } from "./libraryUpholstery";

type Dimensions = [number, number, number];
export type LibraryPlacement = { angle: number; radius: number; height?: number; rotation?: number };

export function box(group: THREE.Group, material: THREE.Material, size: Dimensions, position: Dimensions, rounding = 0) {
  const geometry = rounding
    ? new RoundedBoxGeometry(...size, 2, Math.min(rounding, ...size.map((value) => value / 2)))
    : new THREE.BoxGeometry(...size);
  const tileSize = material.userData.worldTileSize;
  if (typeof tileSize === "number" && tileSize > 0) scaleBoxTextureUVs(geometry, size, tileSize);
  const mesh = new THREE.Mesh(geometry, material);
  if (material.userData.upholstery && rounding > 0.03) addCushionPiping(mesh, size, rounding);
  mesh.position.set(...position);
  group.add(mesh);
  return mesh;
}

export function cylinder(group: THREE.Group, material: THREE.Material, radius: number, height: number, position: Dimensions, segments = 16) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material);
  const tileSize = material.userData.worldTileSize;
  if (typeof tileSize === "number" && tileSize > 0) scaleCylinderTextureUVs(mesh.geometry, radius, height, tileSize);
  mesh.position.set(...position);
  group.add(mesh);
  return mesh;
}

// Merge each prototype by material, then repeat it without a draw call per prop.
export function addRepeatedObjects(scene: THREE.Scene, prototype: THREE.Group, placements: LibraryPlacement[], shadows = false) {
  if (!placements.length) return;
  prototype.updateMatrixWorld(true);
  const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const originals = new Set<THREE.BufferGeometry>();
  prototype.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (Array.isArray(object.material)) throw new Error("Library prototypes must use one material per mesh.");
    originals.add(object.geometry);
    const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
    if (!geometry.index) geometry.setIndex(Array.from({ length: geometry.getAttribute("position").count }, (_, index) => index));
    const entries = byMaterial.get(object.material) ?? [];
    entries.push(geometry);
    byMaterial.set(object.material, entries);
  });
  const transform = new THREE.Object3D();
  for (const [material, geometries] of byMaterial) {
    const merged = mergeGeometries(geometries);
    for (const geometry of geometries) geometry.dispose();
    if (!merged) throw new Error("Library prototype geometry could not be merged.");
    const instances = new THREE.InstancedMesh(merged, material, placements.length);
    instances.castShadow = shadows;
    instances.receiveShadow = shadows;
    placements.forEach(({ angle, radius, height = 0, rotation = angle }, index) => {
      transform.position.set(Math.sin(angle) * radius, height, Math.cos(angle) * radius);
      transform.rotation.set(0, rotation, 0);
      transform.updateMatrix();
      instances.setMatrixAt(index, transform.matrix);
    });
    instances.computeBoundingSphere();
    scene.add(instances);
  }
  for (const geometry of originals) geometry.dispose();
}
