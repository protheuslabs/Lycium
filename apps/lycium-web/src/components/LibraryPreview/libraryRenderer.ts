import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { addLibraryArchitecture } from "./libraryArchitecture";
import { addLibraryArtifacts } from "./libraryArtifacts";
import { addLibraryFurniture } from "./libraryFurniture";
import { createLibraryMaterials, disposeLibraryMaterials } from "./libraryMaterials";
import { LIBRARY, libraryCameraPose } from "./libraryOrbit";

export async function createLibraryRenderer(canvas: HTMLCanvasElement, signal: AbortSignal) {
  const materials = await createLibraryMaterials();
  if (signal.aborted) {
    disposeLibraryMaterials(materials);
    throw new DOMException("Scene loading cancelled.", "AbortError");
  }
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
  } catch (error) {
    disposeLibraryMaterials(materials);
    throw error;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd9e2e6);
  const camera = new THREE.PerspectiveCamera(82, 1, 0.08, 220);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.5;
  room.dispose();
  pmrem.dispose();

  try {
    addLibraryArchitecture(scene, materials);
    addLibraryArtifacts(scene, materials);
    addLibraryFurniture(scene, materials);
  } catch (error) {
    environment.dispose();
    disposeLibraryMaterials(materials);
    renderer.dispose();
    throw error;
  }
  scene.add(new THREE.HemisphereLight(0xe7f0f4, 0x9e8668, 1.7));
  const skylight = new THREE.DirectionalLight(0xfff3dc, 2.6);
  skylight.position.set(-8, 34, 4);
  scene.add(skylight);
  const fill = new THREE.PointLight(0xe8f1ff, 1300 * (LIBRARY.wallRadius / 20) ** 2, 160, 2);
  fill.position.set(0, 17, 0);
  scene.add(fill);

  let disposed = false;
  let phase = 0;
  const render = (nextPhase = phase) => {
    if (disposed) return;
    phase = nextPhase;
    const pose = libraryCameraPose(phase);
    camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
    renderer.render(scene, camera);
    canvas.dataset.phase = phase.toFixed(6);
  };
  const resize = () => {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height || disposed) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  return {
    render,
    canvas,
    dispose() {
      disposed = true;
      observer.disconnect();
      const geometries = new Set<THREE.BufferGeometry>();
      const sceneMaterials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) sceneMaterials.add(material);
        if (object instanceof THREE.InstancedMesh) object.dispose();
      });
      for (const geometry of geometries) geometry.dispose();
      for (const material of sceneMaterials) material.dispose();
      disposeLibraryMaterials(materials);
      environment.dispose();
      scene.clear();
      renderer.dispose();
    },
  };
}

export type LibraryRenderer = Awaited<ReturnType<typeof createLibraryRenderer>>;
