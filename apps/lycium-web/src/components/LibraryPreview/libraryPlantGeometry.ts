import * as THREE from "three";

export function createLibraryLeaf() {
  const positions: number[] = [];
  const uv: number[] = [];
  const indices: number[] = [];
  const segments = 16;
  for (let row = 0; row <= segments; row += 1) {
    const t = row / segments;
    const width = Math.sin(Math.PI * t) ** 0.85 * 0.075 * (1 - 0.2 * t);
    for (const side of [-1, 0, 1]) {
      const ridge = side === 0 ? 0.009 * Math.sin(Math.PI * t) : 0;
      positions.push(side * width, ridge + 0.018 * Math.sin(Math.PI * t), t * 0.56);
      uv.push((side + 1) / 2, t);
    }
    if (row < segments) for (let column = 0; column < 2; column += 1) {
      const vertex = row * 3 + column;
      indices.push(vertex, vertex + 3, vertex + 1, vertex + 1, vertex + 3, vertex + 4);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
