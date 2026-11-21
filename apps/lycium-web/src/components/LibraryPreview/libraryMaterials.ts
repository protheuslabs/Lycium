import * as THREE from "three";
import { seededRandom } from "./libraryOrbit";
import { loadLibrarySurfaceMaps } from "./librarySurfaceMaps";

function canvasTexture(width: number, height: number, draw: (context: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas textures are unavailable.");
  draw(context);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function bookSpine(image: CanvasImageSource, style: number) {
  return canvasTexture(128, 512, (context) => {
    const random = seededRandom(12);
    context.fillStyle = "#d4cec4";
    context.fillRect(0, 0, 128, 512);
    context.filter = "grayscale(1) brightness(1.5)";
    context.globalAlpha = 0.45;
    context.drawImage(image, 0, 0, 128, 512);
    context.globalAlpha = 1;
    context.filter = "none";
    for (let index = 0; index < 2500; index += 1) {
      context.fillStyle = `rgba(45,35,25,${random() * 0.13})`;
      context.fillRect(random() * 128, random() * 512, 1, 2);
    }
    context.fillStyle = "#ad9258";
    const bands = style === 0 ? [32, 43, 85, 430, 440, 477] : style === 1 ? [50, 60, 445, 455] : [80, 420];
    for (const y of bands) context.fillRect(8, y, 112, style === 2 ? 1 : 3);
    context.strokeStyle = "#a68a56";
    context.lineWidth = 2;
    context.strokeRect(15, 120 + style * 15, 98, 192 - style * 12);
    context.fillStyle = "#aaa294";
    for (let row = 0; row < 8; row += 1) {
      const width = 35 + random() * 42;
      context.fillRect((128 - width) / 2, 148 + row * 16, width, 2);
    }
    context.fillStyle = "#8c8276";
    context.fillRect(0, 0, 5, 512);
    context.fillRect(123, 0, 5, 512);
  });
}

export async function createLibraryMaterials() {
  const maps = await loadLibrarySurfaceMaps();
  const wood = new THREE.MeshPhysicalMaterial({ ...maps.wood, color: 0xd2d0c7, roughness: 0.98, normalScale: new THREE.Vector2(0.4, 0.4) });
  const darkWood = new THREE.MeshStandardMaterial({ ...maps.wood, color: 0x93928a, roughness: 0.95, normalScale: new THREE.Vector2(0.3, 0.3) });
  wood.userData.worldTileSize = darkWood.userData.worldTileSize = 1.5;
  const metalFinish = canvasTexture(256, 256, (context) => {
    const random = seededRandom(119);
    context.fillStyle = "#b7b7b7";
    context.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 256; row += 1) {
      context.fillStyle = `rgba(40,40,40,${0.02 + random() * 0.1})`;
      context.fillRect(0, row, 256, 1);
    }
  });
  metalFinish.colorSpace = THREE.NoColorSpace;
  metalFinish.wrapS = metalFinish.wrapT = THREE.RepeatWrapping;
  const brass = new THREE.MeshStandardMaterial({ color: 0xbda477, metalness: 0.92, roughness: 0.9, roughnessMap: metalFinish, bumpMap: metalFinish, bumpScale: 0.0007, envMapIntensity: 0.3 });
  const marble = new THREE.MeshStandardMaterial({ ...maps.marble, color: 0xe8e8e2, roughness: 0.95, normalScale: new THREE.Vector2(0.3, 0.3) });
  marble.userData.worldTileSize = 1.5;
  const teal = new THREE.MeshStandardMaterial({ color: 0x27505a, roughness: 0.64 });
  const paper = new THREE.MeshStandardMaterial({ color: 0xdfcc9e, roughness: 0.92 });
  const black = new THREE.MeshStandardMaterial({ color: 0x20282b, roughness: 0.5 });
  const binding = (style: number) => {
    const finish = style === 0 ? maps.leather : maps.cloth;
    return new THREE.MeshStandardMaterial({
      map: bookSpine(finish.map.image as HTMLImageElement, style),
      normalMap: finish.normalMap, roughnessMap: finish.roughnessMap,
      roughness: 0.97, normalScale: new THREE.Vector2(0.45, 0.45),
    });
  };
  const book = binding(0);
  const bookCloth = binding(1);
  const bookLinen = binding(2);
  const pageMap = canvasTexture(128, 512, (context) => {
    const random = seededRandom(323);
    context.fillStyle = "#d7cfbc";
    context.fillRect(0, 0, 128, 512);
    for (let row = 0; row < 512; row += 2) {
      context.fillStyle = `rgba(86,76,56,${0.04 + random() * 0.16})`;
      context.fillRect(0, row, 128, 1);
    }
  });
  const pages = new THREE.MeshStandardMaterial({ map: pageMap, roughness: 0.98 });
  const code = canvasTexture(512, 320, (context) => {
    context.fillStyle = "#162128";
    context.fillRect(0, 0, 512, 320);
    context.font = "18px monospace";
    ["function orbit(phase) {", "  const angle = phase * TAU;", "  return {", "    x: Math.sin(angle),", "    z: Math.cos(angle)", "  };", "}"].forEach((line, index) => {
      context.fillStyle = ["#84cdd7", "#e2c27f", "#c8d8cf"][index % 3];
      context.fillText(line, 20, 42 + index * 34);
    });
  });
  const screen = new THREE.MeshBasicMaterial({ map: code });
  const fabric = (color: number) => {
    const material = new THREE.MeshStandardMaterial({ ...maps.cloth, color, roughness: 0.95, normalScale: new THREE.Vector2(0.32, 0.32) });
    material.userData.worldTileSize = 0.27;
    return material;
  };
  const felt = fabric(0xa0b2b3);
  const upholstery = fabric(0x73b5b8);
  const ochre = fabric(0xf3ce80);
  felt.userData.worldTileSize = 0.6;
  felt.normalScale.set(0.55, 0.55);
  for (const material of [upholstery, ochre]) {
    material.userData.worldTileSize = 0.42;
    material.userData.upholstery = true;
    material.normalScale.set(0.48, 0.48);
  }
  const rug = fabric(0x83a48d);
  const moldedPlastic = (color: number) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.65 });
  const red = moldedPlastic(0xaa3440);
  const blue = moldedPlastic(0x28699d);
  const orange = moldedPlastic(0xc77e35);
  const whiteboard = new THREE.MeshPhysicalMaterial({ color: 0xeeeeea, roughness: 0.65 });
  for (const texture of Object.values(maps.floor)) texture.repeat.set(98 / 3, 98 / 3);
  const floor = new THREE.MeshStandardMaterial({ ...maps.floor, color: 0xd4d8d4, roughness: 0.95, normalScale: new THREE.Vector2(0.35, 0.35) });
  const leafMap = canvasTexture(256, 512, (context) => {
    context.fillStyle = "#c0c8bd";
    context.fillRect(0, 0, 256, 512);
    context.strokeStyle = "rgba(235,240,220,0.35)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(128, 512);
    context.lineTo(128, 0);
    for (let row = 1; row < 16; row += 1) for (const side of [-1, 1]) {
      context.moveTo(128, row * 30);
      context.quadraticCurveTo(128 + side * 42, row * 30 - 12, 128 + side * 110, row * 30 - 45);
    }
    context.stroke();
  });
  const leafBump = leafMap.clone();
  leafBump.colorSpace = THREE.NoColorSpace;
  const foliage = new THREE.MeshStandardMaterial({ color: 0x275c36, map: leafMap, bumpMap: leafBump, bumpScale: 0.001, roughness: 0.58, side: THREE.DoubleSide });
  const stalk = new THREE.MeshStandardMaterial({ color: 0x2a5832, roughness: 0.78 });
  const soil = new THREE.MeshStandardMaterial({ color: 0x35372b, roughness: 1 });
  const rugBlue = fabric(0x7092ac);
  const ceramic = new THREE.MeshPhysicalMaterial({ color: 0xd6ddd4, roughness: 0.64, clearcoat: 0.04 });
  return { wood, darkWood, brass, marble, teal, paper, black, book, bookCloth, bookLinen, pages, screen, felt, upholstery, ochre, rug, red, blue, orange, whiteboard, floor, foliage, stalk, soil, rugBlue, ceramic };
}

export type LibraryMaterials = Awaited<ReturnType<typeof createLibraryMaterials>>;

export function disposeLibraryMaterials(materials: LibraryMaterials) {
  const textures = new Set<THREE.Texture>();
  for (const material of Object.values(materials)) {
    for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    material.dispose();
  }
  for (const texture of textures) texture.dispose();
}
