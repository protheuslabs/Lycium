import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { remapRoughnessPixels, scaleBoxTextureUVs, scaleCylinderTextureUVs } from "./libraryTextureScale";

describe("physical texture scale", () => {
  it("keeps scanned roughness within matte limits without changing alpha", () => {
    const pixels = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 180]);
    remapRoughnessPixels(pixels, 0.6, 0.9);
    expect(pixels[0]).toBe(153);
    expect(pixels[4]).toBe(230);
    expect(pixels[3]).toBe(255);
    expect(pixels[7]).toBe(180);
  });
  it("scales each box face by its real dimensions without repeatedly multiplying indexed vertices", () => {
    const box = new THREE.BoxGeometry(2, 4, 6);
    scaleBoxTextureUVs(box, [2, 4, 6], 2);
    const uv = box.getAttribute("uv");
    expect(Math.max(...Array.from({ length: 4 }, (_, index) => uv.getX(index)))).toBe(3);
    expect(Math.max(...Array.from({ length: 4 }, (_, index) => uv.getY(index)))).toBe(2);
    box.dispose();
  });

  it("supports rounded cushions and keeps circular rug caps at a consistent scale", () => {
    const cushion = new RoundedBoxGeometry(2, 0.2, 1, 2, 0.06);
    scaleBoxTextureUVs(cushion, [2, 0.2, 1], 0.27);
    expect(Array.from(cushion.getAttribute("uv").array).every(Number.isFinite)).toBe(true);
    const rug = new THREE.CylinderGeometry(2, 2, 0.02, 16);
    scaleCylinderTextureUVs(rug, 2, 0.02, 0.5);
    const uv = rug.getAttribute("uv");
    const normals = rug.getAttribute("normal");
    const capValues = Array.from({ length: uv.count }, (_, vertex) => vertex).filter((vertex) => normals.getY(vertex) > 0.9).map((vertex) => uv.getY(vertex));
    expect(Math.max(...capValues)).toBe(8);
    cushion.dispose();
    rug.dispose();
  });
});
