import * as THREE from "three";
import woodColor from "../../assets/library-materials/wood-color.jpg";
import woodNormal from "../../assets/library-materials/wood-normal.jpg";
import woodRoughness from "../../assets/library-materials/wood-roughness.jpg";
import clothColor from "../../assets/library-materials/cloth-color.jpg";
import clothNormal from "../../assets/library-materials/cloth-normal.jpg";
import clothRoughness from "../../assets/library-materials/cloth-roughness.jpg";
import marbleColor from "../../assets/library-materials/marble-color.jpg";
import marbleNormal from "../../assets/library-materials/marble-normal.jpg";
import marbleRoughness from "../../assets/library-materials/marble-roughness.jpg";
import floorColor from "../../assets/library-materials/floor-color.jpg";
import floorNormal from "../../assets/library-materials/floor-normal.jpg";
import floorRoughness from "../../assets/library-materials/floor-roughness.jpg";
import leatherColor from "../../assets/library-materials/leather-color.jpg";
import leatherNormal from "../../assets/library-materials/leather-normal.jpg";
import leatherRoughness from "../../assets/library-materials/leather-roughness.jpg";
import { remapRoughnessPixels } from "./libraryTextureScale";

function matteRoughness(source: THREE.Texture, minimum: number, maximum: number) {
  const image = source.image;
  if (!(image instanceof HTMLImageElement)) throw new Error("Expected a loaded material image.");
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Material texture processing is unavailable.");
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  remapRoughnessPixels(pixels.data, minimum, maximum);
  context.putImageData(pixels, 0, 0);
  source.dispose();
  return new THREE.CanvasTexture(canvas);
}

export async function loadLibrarySurfaceMaps() {
  const sources = [woodColor, woodNormal, woodRoughness, clothColor, clothNormal, clothRoughness, marbleColor, marbleNormal, marbleRoughness, floorColor, floorNormal, floorRoughness, leatherColor, leatherNormal, leatherRoughness];
  const loader = new THREE.TextureLoader();
  const results = await Promise.allSettled(sources.map((source) => loader.loadAsync(source.src)));
  const failure = results.find((result) => result.status === "rejected");
  if (failure) {
    for (const result of results) if (result.status === "fulfilled") result.value.dispose();
    throw failure.reason;
  }
  const textures = results.map((result, index) => {
    let texture = (result as PromiseFulfilledResult<THREE.Texture>).value;
    if (index % 3 === 2) {
      const ranges = [[0.62, 0.88], [0.82, 0.98], [0.6, 0.84], [0.65, 0.92], [0.72, 0.92]];
      const [minimum, maximum] = ranges[Math.floor(index / 3)];
      texture = matteRoughness(texture, minimum, maximum);
    }
    texture.colorSpace = index % 3 === 0 ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    return texture;
  });
  const surface = (offset: number) => ({ map: textures[offset], normalMap: textures[offset + 1], roughnessMap: textures[offset + 2] });
  return { wood: surface(0), cloth: surface(3), marble: surface(6), floor: surface(9), leather: surface(12) };
}
