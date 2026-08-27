"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { withBasePath } from "../site-paths";

type Crop = { x: number; y: number; width: number; height: number };

const FACE_CROPS: Crop[] = [
  { x: 0.05, y: 0.58, width: 0.11, height: 0.09 },
  { x: 0.13, y: 0.58, width: 0.11, height: 0.09 },
  { x: 0.21, y: 0.58, width: 0.11, height: 0.09 },
  { x: 0.07, y: 0.68, width: 0.11, height: 0.09 },
  { x: 0.16, y: 0.68, width: 0.11, height: 0.09 },
  { x: 0.25, y: 0.68, width: 0.11, height: 0.09 },
];

function makeFaceTexture(
  image: HTMLImageElement,
  crop: Crop,
  renderer: THREE.WebGLRenderer,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 768;
  const context = canvas.getContext("2d");

  if (context) {
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.filter = "saturate(1.18) contrast(1.06) brightness(1.08)";
    context.fillStyle = "#8a3e20";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
      image,
      crop.x * image.naturalWidth,
      crop.y * image.naturalHeight,
      crop.width * image.naturalWidth,
      crop.height * image.naturalHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function shapeChickenCube(geometry: RoundedBoxGeometry) {
  const positions = geometry.attributes.position as THREE.BufferAttribute;
  const normals = geometry.attributes.normal as THREE.BufferAttribute;
  const position = new THREE.Vector3();
  const normal = new THREE.Vector3();

  for (let index = 0; index < positions.count; index += 1) {
    position.fromBufferAttribute(positions, index);
    normal.fromBufferAttribute(normals, index);

    const broadVariation =
      Math.sin(position.x * 3.7 + position.y * 1.3) *
      Math.sin(position.z * 4.1 - position.x * 0.8);
    const fineVariation = Math.sin(position.x * 10.2 + position.y * 8.3 + position.z * 9.1);
    const edgeVariation = Math.sin((position.x - position.z) * 5.4) * 0.5 + 0.5;
    const displacement = broadVariation * 0.072 + fineVariation * 0.022 + edgeVariation * 0.016;

    position.addScaledVector(normal, displacement);
    positions.setXYZ(index, position.x, position.y, position.z);
  }

  positions.needsUpdate = true;
  geometry.computeBoundingSphere();
}

export default function MealScene() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    camera.position.set(0, 0.2, 9.2);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.dataset.frame = "0";
    renderer.domElement.dataset.rotation = "0";
    renderer.domElement.dataset.dragRotation = "0";
    host.appendChild(renderer.domElement);

    const foodGroup = new THREE.Group();
    const cubePivot = new THREE.Group();
    foodGroup.add(cubePivot);
    scene.add(foodGroup);

    const hemisphere = new THREE.HemisphereLight(0xffe2a1, 0x35100c, 2.15);
    scene.add(hemisphere);

    const keyLight = new THREE.DirectionalLight(0xffdfaf, 5.8);
    keyLight.position.set(-3.5, 5.2, 6.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xd92e35, 4.2);
    rimLight.position.set(5.5, 1.5, -4.5);
    scene.add(rimLight);

    const fillLight = new THREE.PointLight(0xf3bd45, 10, 15, 2);
    fillLight.position.set(4.2, -2.4, 4.8);
    scene.add(fillLight);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xf0bc43,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    const orbit = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.018, 10, 160), ringMaterial);
    orbit.scale.y = 0.46;
    orbit.rotation.x = Math.PI * 0.56;
    orbit.rotation.z = Math.PI * 0.08;
    cubePivot.add(orbit);

    const orbitInner = new THREE.Mesh(
      new THREE.TorusGeometry(1.98, 0.009, 8, 140),
      ringMaterial.clone(),
    );
    orbitInner.scale.y = 0.58;
    orbitInner.rotation.x = Math.PI * 0.42;
    orbitInner.rotation.z = -Math.PI * 0.17;
    cubePivot.add(orbitInner);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.45, 80),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(1.45, 0.72, 1);
    shadow.position.set(0, -1.72, -0.12);
    cubePivot.add(shadow);

    const geometry = new RoundedBoxGeometry(2.75, 2.35, 2.55, 18, 0.5);
    shapeChickenCube(geometry);

    const faceTextures: THREE.Texture[] = [];
    const faceMaterials: THREE.MeshPhysicalMaterial[] = [];
    let chickenCube: THREE.Mesh | null = null;

    const imageLoader = new THREE.ImageLoader();
    imageLoader.load(
      withBasePath("/assets/hero-chicken-texture.jpg"),
      (loadedImage) => {
        const image = loadedImage as HTMLImageElement;
        FACE_CROPS.forEach((crop) => {
          const texture = makeFaceTexture(image, crop, renderer);
          faceTextures.push(texture);
          faceMaterials.push(
            new THREE.MeshPhysicalMaterial({
              map: texture,
              bumpMap: texture,
              bumpScale: 0.16,
              color: 0xffffff,
              roughness: 0.64,
              metalness: 0,
              clearcoat: 0.12,
              clearcoatRoughness: 0.68,
              sheen: 0.12,
              sheenColor: new THREE.Color(0xc44a25),
            }),
          );
        });

        chickenCube = new THREE.Mesh(geometry, faceMaterials);
        chickenCube.castShadow = true;
        chickenCube.receiveShadow = true;
        chickenCube.rotation.set(-0.16, -0.5, 0.08);
        cubePivot.add(chickenCube);
        host.dataset.textureReady = "true";
        host.dataset.sceneReady = "true";
      },
      undefined,
      () => {
        const fallbackMaterial = new THREE.MeshPhysicalMaterial({
          color: 0x9b4521,
          roughness: 0.78,
          clearcoat: 0.08,
        });
        faceMaterials.push(fallbackMaterial);
        chickenCube = new THREE.Mesh(geometry, fallbackMaterial);
        cubePivot.add(chickenCube);
        host.dataset.textureReady = "fallback";
        host.dataset.sceneReady = "true";
      },
    );

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frameId = 0;
    let frame = 0;
    let dragging = false;
    let pointerStartX = 0;
    let pointerStartY = 0;
    let dragStartY = -0.12;
    let dragStartX = -0.08;
    let targetY = -0.12;
    let targetX = -0.08;
    let currentY = -0.12;
    let currentX = -0.08;
    let pointerY = 0;
    let pointerX = 0;
    let baseFoodY = 0;
    let mobileLayout = false;
    let needsPixelCheck = true;

    const updateLayout = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      const mobile = width < 700;
      mobileLayout = mobile;
      needsPixelCheck = true;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);

      foodGroup.scale.setScalar(mobile ? 0.58 : width < 1050 ? 0.84 : 1.05);
      foodGroup.position.x = mobile ? 0.45 : width < 1050 ? 1.72 : 2.75;
      baseFoodY = mobile ? -1.45 : width < 1050 ? -0.48 : 0.15;
      foodGroup.position.y = baseFoodY;
    };

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      pointerStartX = event.clientX;
      pointerStartY = event.clientY;
      dragStartY = targetY;
      dragStartX = targetX;
      renderer.domElement.setPointerCapture(event.pointerId);
      host.dataset.dragging = "true";
    };

    const onPointerMove = (event: PointerEvent) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointerY = ((event.clientX - bounds.left) / bounds.width - 0.5) * 0.16;
      pointerX = ((event.clientY - bounds.top) / bounds.height - 0.5) * -0.11;

      if (dragging) {
        targetY = dragStartY + (event.clientX - pointerStartX) * 0.008;
        targetX = THREE.MathUtils.clamp(
          dragStartX - (event.clientY - pointerStartY) * 0.0045,
          -0.8,
          0.8,
        );
        renderer.domElement.dataset.dragRotation = targetY.toFixed(4);
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      dragging = false;
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
      delete host.dataset.dragging;
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerUp);

    const animationStart = performance.now();
    let previousTimestamp = animationStart;
    const animate = (timestamp = performance.now()) => {
      const elapsed = (timestamp - animationStart) / 1000;
      const delta = Math.min((timestamp - previousTimestamp) / 1000, 0.04);
      previousTimestamp = timestamp;

      if (!prefersReducedMotion && !dragging) targetY += delta * 0.17;

      currentY += (targetY + pointerY - currentY) * 0.065;
      currentX += (targetX + pointerX - currentX) * 0.065;
      cubePivot.rotation.y = currentY;
      cubePivot.rotation.x = currentX;
      cubePivot.rotation.z = prefersReducedMotion ? 0 : Math.sin(elapsed * 0.5) * 0.025;
      foodGroup.position.y = baseFoodY + (prefersReducedMotion ? 0 : Math.sin(elapsed * 0.88) * 0.11);
      orbit.rotation.z += prefersReducedMotion ? 0 : delta * 0.08;
      orbitInner.rotation.z -= prefersReducedMotion ? 0 : delta * 0.12;

      renderer.render(scene, camera);
      frame += 1;
      renderer.domElement.dataset.frame = String(frame);
      renderer.domElement.dataset.rotation = currentY.toFixed(4);

      if (needsPixelCheck && frame > 18 && host.dataset.sceneReady === "true") {
        const context = renderer.getContext();
        const sampleSize = Math.max(40, Math.min(140, Math.floor(renderer.domElement.width / 4)));
        const sampleX = Math.max(
          0,
          Math.min(
            renderer.domElement.width - sampleSize,
            Math.floor(renderer.domElement.width * (mobileLayout ? 0.5 : 0.74) - sampleSize / 2),
          ),
        );
        const sampleY = Math.max(
          0,
          Math.min(
            renderer.domElement.height - sampleSize,
            Math.floor(renderer.domElement.height * (mobileLayout ? 0.2 : 0.49) - sampleSize / 2),
          ),
        );
        const pixels = new Uint8Array(sampleSize * sampleSize * 4);
        context.readPixels(
          sampleX,
          sampleY,
          sampleSize,
          sampleSize,
          context.RGBA,
          context.UNSIGNED_BYTE,
          pixels,
        );

        let visiblePixels = 0;
        let warmPixels = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          if (pixels[index + 3] > 12) visiblePixels += 1;
          if (pixels[index] > pixels[index + 2] * 1.25 && pixels[index] > 55) warmPixels += 1;
        }
        const visibleRatio = visiblePixels / (sampleSize * sampleSize);
        const warmRatio = warmPixels / (sampleSize * sampleSize);
        renderer.domElement.dataset.pixelVisibleRatio = visibleRatio.toFixed(3);
        renderer.domElement.dataset.pixelWarmRatio = warmRatio.toFixed(3);
        renderer.domElement.dataset.pixelCheck =
          visibleRatio > 0.08 && warmRatio > 0.025 ? "nonblank" : "blank";
        needsPixelCheck = false;
      }

      frameId = window.requestAnimationFrame(animate);
    };

    const resizeObserver = new ResizeObserver(updateLayout);
    resizeObserver.observe(host);
    updateLayout();
    animate();

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      geometry.dispose();
      faceMaterials.forEach((material) => material.dispose());
      faceTextures.forEach((texture) => texture.dispose());
      orbit.geometry.dispose();
      orbitInner.geometry.dispose();
      ringMaterial.dispose();
      (orbitInner.material as THREE.Material).dispose();
      shadow.geometry.dispose();
      (shadow.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      className="mealScene"
      data-testid="meal-scene"
      ref={hostRef}
      role="img"
      aria-label="Interactive 3D cube of baked Threebyrd chicken."
    >
      <span className="sceneFallback">A baked Threebyrd chicken cube</span>
    </div>
  );
}
