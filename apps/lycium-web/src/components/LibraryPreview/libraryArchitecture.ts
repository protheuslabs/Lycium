import * as THREE from "three";
import { LIBRARY, seededRandom } from "./libraryOrbit";
import type { LibraryMaterials } from "./libraryMaterials";

export function horizontalRing(inner: number, outer: number, thickness: number) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 96 });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

export function addLibraryArchitecture(scene: THREE.Scene, materials: LibraryMaterials) {
  const { wallRadius: radius, shelfHeight, bays, levels, rowsPerLevel, levelHeight } = LIBRARY;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(radius + 0.35, radius + 0.35, shelfHeight, 128, 1, true), materials.darkWood);
  wall.material = materials.darkWood.clone();
  wall.material.side = THREE.BackSide;
  wall.position.y = shelfHeight / 2;
  scene.add(wall);

  const shelfGeometry = horizontalRing(radius - 0.95, radius + 0.3, 0.12);
  for (let level = 0; level < levels; level += 1) {
    for (let row = 0; row <= rowsPerLevel; row += 1) {
      const shelf = new THREE.Mesh(shelfGeometry, materials.wood);
      shelf.position.y = level * levelHeight + row * 0.87 + 0.2;
      scene.add(shelf);
    }
  }

  const upright = new THREE.BoxGeometry(0.18, shelfHeight, 1.1);
  const pillar = new THREE.CylinderGeometry(0.24, 0.3, shelfHeight, 12);
  for (let bay = 0; bay < bays; bay += 1) {
    const angle = bay / bays * Math.PI * 2;
    const divider = new THREE.Mesh(upright, materials.wood);
    divider.position.set(Math.sin(angle) * (radius - 0.35), shelfHeight / 2, Math.cos(angle) * (radius - 0.35));
    divider.rotation.y = angle;
    scene.add(divider);
    if (bay % 3 === 0) {
      const column = new THREE.Mesh(pillar, materials.marble);
      column.position.set(Math.sin(angle) * (radius - 1.1), shelfHeight / 2, Math.cos(angle) * (radius - 1.1));
      scene.add(column);
      for (const height of [0.3, shelfHeight - 0.3]) {
        const capital = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.35, 12), materials.marble);
        capital.position.set(column.position.x, height, column.position.z);
        scene.add(capital);
      }
    }
  }

  const balconyGeometry = horizontalRing(radius - 1.25, radius - 0.65, 0.12);
  const railGeometry = new THREE.TorusGeometry(radius - 1.25, 0.025, 6, 160);
  railGeometry.rotateX(Math.PI / 2);
  const posts: THREE.Matrix4[] = [];
  const object = new THREE.Object3D();
  for (let level = 1; level < levels; level += 1) {
    const height = level * levelHeight;
    const balcony = new THREE.Mesh(balconyGeometry, materials.wood);
    balcony.position.y = height;
    scene.add(balcony);
    for (const offset of [0.4, 1.1]) {
      const rail = new THREE.Mesh(railGeometry, materials.brass);
      rail.position.y = height + offset;
      scene.add(rail);
    }
    for (let post = 0; post < 192; post += 1) {
      const angle = post / 192 * Math.PI * 2;
      object.position.set(Math.sin(angle) * (radius - 1.25), height + 0.55, Math.cos(angle) * (radius - 1.25));
      object.updateMatrix();
      posts.push(object.matrix.clone());
    }
  }
  const balusters = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.021, 0.021, 1.1, 5), materials.brass, posts.length);
  posts.forEach((matrix, index) => balusters.setMatrixAt(index, matrix));
  scene.add(balusters);

  addBooks(scene, materials);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(radius + 1, 128), materials.marble);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  for (const ringRadius of [radius * 0.65, radius * 0.78, radius * 0.9]) {
    const inlay = new THREE.Mesh(horizontalRing(ringRadius, ringRadius + 0.035, 0.01), materials.teal);
    inlay.position.y = 0.01;
    scene.add(inlay);
  }

  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius + 0.35, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xd9e5e9, side: THREE.BackSide }));
  dome.position.y = shelfHeight;
  scene.add(dome);
  for (let rib = 0; rib < 24; rib += 1) {
    const geometry = new THREE.TorusGeometry(radius + 0.05, 0.08, 5, 40, Math.PI / 2);
    const arc = new THREE.Mesh(geometry, materials.marble);
    arc.rotation.y = rib / 24 * Math.PI * 2;
    arc.position.y = shelfHeight;
    scene.add(arc);
  }
}

function addBooks(scene: THREE.Scene, materials: LibraryMaterials) {
  const random = seededRandom(42);
  const colors = [0x956a4b, 0x354d5e, 0x7d403a, 0x59634e, 0xa38b61, 0x39463c, 0x77706b, 0xb2a280, 0x527475, 0x40392e, 0x8f785c];
  const entries: Array<{ matrix: THREE.Matrix4; color: THREE.Color }> = [];
  const object = new THREE.Object3D();
  const bayAngle = Math.PI * 2 / LIBRARY.bays;
  for (let level = 0; level < LIBRARY.levels; level += 1) {
    for (let row = 0; row < LIBRARY.rowsPerLevel; row += 1) {
      for (let bay = 0; bay < LIBRARY.bays; bay += 1) {
        let offset = 0.17;
        const length = bayAngle * LIBRARY.wallRadius - 0.34;
        while (offset < length - 0.15) {
          const width = 0.09 + random() * 0.15;
          const height = 0.42 + random() * 0.31;
          const depth = 0.33 + random() * 0.15;
          const displayAlcove = bay % 3 === 1 && row >= 1 && row <= 3 && Math.abs(offset - length / 2) < 1.15;
          if (!displayAlcove && random() > 0.035) {
            const angle = bay * bayAngle + offset / LIBRARY.wallRadius;
            const radius = LIBRARY.wallRadius - 0.7 + (depth - 0.4) / 2;
            object.position.set(Math.sin(angle) * radius, level * LIBRARY.levelHeight + row * 0.87 + 0.33 + height / 2, Math.cos(angle) * radius);
            object.rotation.set(0, angle, (random() - 0.5) * 0.08);
            object.scale.set(width, height, depth);
            object.updateMatrix();
            entries.push({ matrix: object.matrix.clone(), color: new THREE.Color(colors[Math.floor(random() * colors.length)]) });
          }
          offset += width + 0.012;
        }
      }
    }
  }
  const books = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), materials.book, entries.length);
  entries.forEach((entry, index) => {
    books.setMatrixAt(index, entry.matrix);
    books.setColorAt(index, entry.color);
  });
  books.instanceMatrix.needsUpdate = true;
  if (books.instanceColor) books.instanceColor.needsUpdate = true;
  books.computeBoundingSphere();
  scene.add(books);
}
