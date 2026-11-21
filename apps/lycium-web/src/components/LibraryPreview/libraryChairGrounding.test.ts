import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { spinningChair } from "./libraryFurniture";

describe("spinning-chair ground contact", () => {
  it("puts the actual tilted surface on the floor for both lean directions and every color", () => {
    const palette = {
      red: new THREE.MeshPhysicalMaterial(),
      blue: new THREE.MeshPhysicalMaterial(),
      orange: new THREE.MeshPhysicalMaterial(),
    };
    for (const direction of [-1, 1]) for (let color = 0; color < 3; color += 1) {
      const chair = spinningChair(palette, color, direction);
      chair.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(chair, true);
      expect(bounds.min.y).toBeCloseTo(0, 6);
      expect(bounds.max.y).toBeGreaterThan(1);
      chair.traverse((object) => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
    }
    Object.values(palette).forEach((material) => material.dispose());
  });
});
