import * as THREE from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { addLibraryArchitecture } from "./libraryArchitecture";
import { addLibraryArtifacts } from "./libraryArtifacts";
import { addLibraryFurniture } from "./libraryFurniture";
import { addLibraryDetails } from "./libraryDetails";
import { createLibraryMaterials, disposeLibraryMaterials } from "./libraryMaterials";
import { LIBRARY, libraryCameraPose } from "./libraryOrbit";

export async function createLibraryRenderer(canvas: HTMLCanvasElement, signal: AbortSignal) {
  const materials = await createLibraryMaterials();
  let lightingTexture: THREE.DataTexture;
  try {
    const basePath = (process.env.NEXT_PUBLIC_LYCIUM_BASE_PATH ?? "/Lycium").replace(/\/$/, "");
    lightingTexture = await new HDRLoader().loadAsync(`${basePath}/library-materials/lebombo-1k.hdr`);
  } catch (error) {
    disposeLibraryMaterials(materials);
    throw error;
  }
  if (signal.aborted) {
    lightingTexture.dispose();
    disposeLibraryMaterials(materials);
    throw new DOMException("Scene loading cancelled.", "AbortError");
  }
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
  } catch (error) {
    lightingTexture.dispose();
    disposeLibraryMaterials(materials);
    throw error;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd9e2e6);
  const camera = new THREE.PerspectiveCamera(82, 1, 0.08, 220);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromEquirectangular(lightingTexture);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.45;
  scene.environmentRotation.y = 0.65;
  lightingTexture.dispose();
  pmrem.dispose();

  try {
    addLibraryArchitecture(scene, materials);
    addLibraryArtifacts(scene, materials);
    addLibraryFurniture(scene, materials);
    addLibraryDetails(scene, materials);
  } catch (error) {
    environment.dispose();
    disposeLibraryMaterials(materials);
    renderer.dispose();
    throw error;
  }
  scene.add(new THREE.HemisphereLight(0xe7eee9, 0x8c887c, 1));
  const skylight = new THREE.DirectionalLight(0xfff2df, 2.2);
  skylight.position.set(-18, 48, 22);
  skylight.castShadow = true;
  skylight.shadow.mapSize.set(2048, 2048);
  Object.assign(skylight.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 125 });
  skylight.shadow.camera.updateProjectionMatrix();
  skylight.shadow.bias = -0.0002;
  skylight.shadow.normalBias = 0.035;
  scene.add(skylight);
  const fill = new THREE.PointLight(0xe8f1ff, 650 * (LIBRARY.wallRadius / 20) ** 2, 160, 2);
  fill.position.set(0, 17, 0);
  scene.add(fill);

  let disposed = false;
  let phase = 0;
  let renderedPhase: number | undefined;
  const render = (nextPhase = phase, force = false) => {
    if (disposed) return;
    phase = nextPhase;
    if (!force && renderedPhase === phase) return;
    const pose = libraryCameraPose(phase);
    camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
    renderer.render(scene, camera);
    renderedPhase = phase;
    canvas.dataset.phase = phase.toFixed(6);
  };
  const resize = () => {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height || disposed) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render(phase, true);
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
      skylight.shadow.dispose();
      scene.clear();
      renderer.dispose();
    },
  };
}

export type LibraryRenderer = Awaited<ReturnType<typeof createLibraryRenderer>>;
