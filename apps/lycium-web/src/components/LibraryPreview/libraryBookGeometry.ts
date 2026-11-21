import * as THREE from "three";

export function createBookFaceGeometry(size: [number, number, number], faces: number[]) {
  const geometry = new THREE.BoxGeometry(...size);
  const source = geometry.index!;
  const indices = faces.flatMap((face) => Array.from({ length: 6 }, (_, index) => source.getX(face * 6 + index)));
  geometry.setIndex(indices);
  geometry.clearGroups();
  return geometry;
}

export function addBoundBook(group: THREE.Group, cover: THREE.Material, pages: THREE.Material, size: [number, number, number], position: [number, number, number]) {
  const book = new THREE.Group();
  book.position.set(...position);
  book.add(new THREE.Mesh(createBookFaceGeometry(size, [0, 1, 5]), cover));
  book.add(new THREE.Mesh(createBookFaceGeometry([size[0] * 0.88, size[1] * 0.94, size[2] * 0.94], [2, 3, 4]), pages));
  group.add(book);
  return book;
}
