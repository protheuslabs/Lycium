import * as THREE from "three";

export function remapRoughnessPixels(pixels: Uint8ClampedArray, minimum: number, maximum: number) {
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const roughness = Math.round(255 * minimum + pixels[offset + 1] * (maximum - minimum));
    pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = roughness;
  }
}

export function scaleTextureUVs(geometry: THREE.BufferGeometry, horizontal: number, vertical: number) {
  const uv = geometry.getAttribute("uv");
  if (!uv) return;
  for (let vertex = 0; vertex < uv.count; vertex += 1) uv.setXY(vertex, uv.getX(vertex) * horizontal, uv.getY(vertex) * vertical);
  uv.needsUpdate = true;
}

export function scaleBoxTextureUVs(geometry: THREE.BufferGeometry, size: [number, number, number], tileSize: number) {
  const uv = geometry.getAttribute("uv");
  const [width, height, depth] = size;
  const faces = [[depth, height], [depth, height], [width, depth], [width, depth], [width, height], [width, height]];
  geometry.groups.forEach((group, face) => {
    const vertices = new Set<number>();
    for (let index = group.start; index < group.start + group.count; index += 1) vertices.add(geometry.index?.getX(index) ?? index);
    for (const vertex of vertices) uv.setXY(vertex, uv.getX(vertex) * faces[face][0] / tileSize, uv.getY(vertex) * faces[face][1] / tileSize);
  });
  uv.needsUpdate = true;
}

export function scaleCylinderTextureUVs(geometry: THREE.BufferGeometry, radius: number, height: number, tileSize: number) {
  const uv = geometry.getAttribute("uv");
  const normal = geometry.getAttribute("normal");
  for (let vertex = 0; vertex < uv.count; vertex += 1) {
    const cap = Math.abs(normal.getY(vertex)) > 0.9;
    uv.setXY(vertex, uv.getX(vertex) * (cap ? radius * 2 : Math.PI * 2 * radius) / tileSize, uv.getY(vertex) * (cap ? radius * 2 : height) / tileSize);
  }
  uv.needsUpdate = true;
}
