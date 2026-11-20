import * as THREE from "three";
import walnutImage from "../../assets/library-walnut.webp";
import { seededRandom } from "./libraryOrbit";

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

function bookSpine() {
  return canvasTexture(128, 512, (context) => {
    const random = seededRandom(12);
    context.fillStyle = "#d4cec4";
    context.fillRect(0, 0, 128, 512);
    for (let index = 0; index < 2500; index += 1) {
      context.fillStyle = `rgba(45,35,25,${random() * 0.13})`;
      context.fillRect(random() * 128, random() * 512, 1, 2);
    }
    context.fillStyle = "#ad9258";
    for (const y of [32, 43, 85, 430, 440, 477]) context.fillRect(8, y, 112, 3);
    context.strokeStyle = "#a68a56";
    context.lineWidth = 2;
    context.strokeRect(15, 120, 98, 192);
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
  const woodMap = await new THREE.TextureLoader().loadAsync(walnutImage.src);
  woodMap.colorSpace = THREE.SRGBColorSpace;
  woodMap.wrapS = woodMap.wrapT = THREE.RepeatWrapping;
  woodMap.anisotropy = 4;
  const wood = new THREE.MeshStandardMaterial({ map: woodMap, bumpMap: woodMap, bumpScale: 0.012, color: 0xbca48c, roughness: 0.57 });
  const darkWood = new THREE.MeshStandardMaterial({ map: woodMap, color: 0x776554, roughness: 0.72 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb59b60, metalness: 0.65, roughness: 0.3 });
  const marbleMap = canvasTexture(512, 512, (context) => {
    const random = seededRandom(73);
    context.fillStyle = "#c6c8c5";
    context.fillRect(0, 0, 512, 512);
    for (let vein = 0; vein < 24; vein += 1) {
      const y = random() * 512;
      context.beginPath();
      context.moveTo(0, y);
      context.bezierCurveTo(160, y - 90 + random() * 180, 350, y - 100 + random() * 200, 512, y + 40);
      context.strokeStyle = `rgba(65,78,76,${0.025 + random() * 0.06})`;
      context.lineWidth = 0.5 + random() * 3;
      context.stroke();
    }
  });
  marbleMap.wrapS = marbleMap.wrapT = THREE.RepeatWrapping;
  marbleMap.repeat.set(12, 12);
  const marble = new THREE.MeshStandardMaterial({ map: marbleMap, color: 0xe4dfd5, roughness: 0.4 });
  const teal = new THREE.MeshStandardMaterial({ color: 0x27505a, roughness: 0.64 });
  const paper = new THREE.MeshStandardMaterial({ color: 0xdfcc9e, roughness: 0.92 });
  const black = new THREE.MeshStandardMaterial({ color: 0x20282b, roughness: 0.5 });
  const book = new THREE.MeshStandardMaterial({ map: bookSpine(), roughness: 0.83 });
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
  const weave = canvasTexture(128, 128, (context) => {
    const random = seededRandom(94);
    context.fillStyle = "#dddddd";
    context.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 2) for (let x = 0; x < 128; x += 2) {
      context.fillStyle = `rgba(35,40,40,${0.08 + random() * 0.12})`;
      context.fillRect(x, y, 1, 2);
    }
  });
  weave.wrapS = weave.wrapT = THREE.RepeatWrapping;
  weave.repeat.set(4, 4);
  const fabric = (color: number) => new THREE.MeshStandardMaterial({ color, map: weave, bumpMap: weave, bumpScale: 0.003, roughness: 0.98 });
  const felt = fabric(0x596468);
  const upholstery = fabric(0x317c84);
  const ochre = fabric(0xcfa547);
  const rug = fabric(0x657e75);
  const red = new THREE.MeshStandardMaterial({ color: 0xb52e37, roughness: 0.4 });
  const whiteboard = new THREE.MeshStandardMaterial({ color: 0xf3f3ed, roughness: 0.35 });
  return { wood, darkWood, brass, marble, teal, paper, black, book, screen, felt, upholstery, ochre, rug, red, whiteboard };
}

export type LibraryMaterials = Awaited<ReturnType<typeof createLibraryMaterials>>;

export function disposeLibraryMaterials(materials: LibraryMaterials) {
  const textures = new Set<THREE.Texture>();
  for (const material of Object.values(materials)) {
    if (material.map) textures.add(material.map);
    material.dispose();
  }
  for (const texture of textures) texture.dispose();
}
