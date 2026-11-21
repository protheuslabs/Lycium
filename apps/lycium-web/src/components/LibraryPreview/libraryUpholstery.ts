import * as THREE from "three";

export function addCushionPiping(mesh: THREE.Mesh, size: [number, number, number], rounding: number) {
  const axes = [0, 1, 2].sort((a, b) => size[a] - size[b]);
  if (size[axes[0]] > 0.3) return;
  const width = size[axes[1]] - 0.025;
  const height = size[axes[2]] - 0.025;
  const radius = Math.min(rounding, width / 4, height / 4);
  const path = new THREE.Shape();
  path.moveTo(-width / 2 + radius, -height / 2);
  path.lineTo(width / 2 - radius, -height / 2);
  path.quadraticCurveTo(width / 2, -height / 2, width / 2, -height / 2 + radius);
  path.lineTo(width / 2, height / 2 - radius);
  path.quadraticCurveTo(width / 2, height / 2, width / 2 - radius, height / 2);
  path.lineTo(-width / 2 + radius, height / 2);
  path.quadraticCurveTo(-width / 2, height / 2, -width / 2, height / 2 - radius);
  path.lineTo(-width / 2, -height / 2 + radius);
  path.quadraticCurveTo(-width / 2, -height / 2, -width / 2 + radius, -height / 2);
  const outline = path.getSpacedPoints(48).slice(0, -1);
  for (const side of [-1, 1]) {
    const points = outline.map((point) => {
      const position = new THREE.Vector3();
      position.setComponent(axes[0], side * size[axes[0]] * 0.46);
      position.setComponent(axes[1], point.x);
      position.setComponent(axes[2], point.y);
      return position;
    });
    const curve = new THREE.CatmullRomCurve3(points, true);
    mesh.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.003, 4, true), mesh.material));
  }
}
