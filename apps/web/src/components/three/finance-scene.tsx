'use client';

import {
  useEffect,
  useRef,
} from 'react';

import * as THREE
  from 'three';

export function FinanceScene() {
  const canvasRef =
    useRef<HTMLCanvasElement>(
      null,
    );

  useEffect(() => {
    const canvas =
      canvasRef.current;

    if (!canvas) {
      return;
    }

    const parent =
      canvas.parentElement;

    if (!parent) {
      return;
    }

    const reducedMotion =
      window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;

    /* =====================================================
       SCENE
    ===================================================== */

    const scene =
      new THREE.Scene();

    const camera =
      new THREE.PerspectiveCamera(
        38,
        1,
        0.1,
        100,
      );

    camera.position.set(
      0,
      0,
      6.4,
    );

    const renderer =
      new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference:
          'high-performance',
      });

    renderer.setClearColor(
      0x000000,
      0,
    );

    renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio,
        1.7,
      ),
    );

    /* =====================================================
       MAIN GROUP
    ===================================================== */

    const group =
      new THREE.Group();

    scene.add(group);

    /* =====================================================
       CORE
    ===================================================== */

    const coreGeometry =
      new THREE.IcosahedronGeometry(
        1.5,
        2,
      );

    const coreMaterial =
      new THREE.MeshBasicMaterial({
        color: 0x2d8cff,
        wireframe: true,
        transparent: true,
        opacity: 0.9,
      });

    const core =
      new THREE.Mesh(
        coreGeometry,
        coreMaterial,
      );

    group.add(core);

    /* =====================================================
       INNER CORE
    ===================================================== */

    const innerGeometry =
      new THREE.IcosahedronGeometry(
        0.82,
        1,
      );

    const innerMaterial =
      new THREE.MeshBasicMaterial({
        color: 0x8bd1ff,
        transparent: true,
        opacity: 0.13,
      });

    const inner =
      new THREE.Mesh(
        innerGeometry,
        innerMaterial,
      );

    group.add(inner);

    /* =====================================================
       ORBITS
    ===================================================== */

    const ringGeometryOne =
      new THREE.TorusGeometry(
        2.05,
        0.012,
        8,
        160,
      );

    const ringGeometryTwo =
      new THREE.TorusGeometry(
        2.35,
        0.01,
        8,
        160,
      );

    const ringMaterial =
      new THREE.MeshBasicMaterial({
        color: 0x75c2ff,
        transparent: true,
        opacity: 0.34,
        side: THREE.DoubleSide,
      });

    const ringOne =
      new THREE.Mesh(
        ringGeometryOne,
        ringMaterial,
      );

    ringOne.rotation.x =
      Math.PI / 2.7;

    ringOne.rotation.y =
      Math.PI / 6;

    group.add(ringOne);

    const ringTwo =
      new THREE.Mesh(
        ringGeometryTwo,
        ringMaterial,
      );

    ringTwo.rotation.x =
      -Math.PI / 3.2;

    ringTwo.rotation.z =
      Math.PI / 4;

    group.add(ringTwo);

    /* =====================================================
       PARTICLES
    ===================================================== */

    const particleCount =
      110;

    const particlePositions =
      new Float32Array(
        particleCount * 3,
      );

    for (
      let index = 0;
      index < particleCount;
      index += 1
    ) {
      const radius =
        2.2 +
        Math.random() * 2.6;

      const theta =
        Math.random() *
        Math.PI *
        2;

      const phi =
        Math.acos(
          Math.random() * 2 -
            1,
        );

      particlePositions[
        index * 3
      ] =
        radius *
        Math.sin(phi) *
        Math.cos(theta);

      particlePositions[
        index * 3 + 1
      ] =
        radius *
        Math.sin(phi) *
        Math.sin(theta);

      particlePositions[
        index * 3 + 2
      ] =
        radius *
        Math.cos(phi);
    }

    const particleGeometry =
      new THREE.BufferGeometry();

    particleGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(
        particlePositions,
        3,
      ),
    );

    const particleMaterial =
      new THREE.PointsMaterial({
        color: 0x79c8ff,
        size: 0.025,
        transparent: true,
        opacity: 0.72,
      });

    const particles =
      new THREE.Points(
        particleGeometry,
        particleMaterial,
      );

    scene.add(particles);

    /* =====================================================
       POINTER
    ===================================================== */

    let pointerX = 0;
    let pointerY = 0;

    const handlePointerMove =
      (
        event:
          PointerEvent,
      ): void => {
        pointerX =
          (
            event.clientX /
              window.innerWidth -
            0.5
          ) *
          0.35;

        pointerY =
          (
            event.clientY /
              window.innerHeight -
            0.5
          ) *
          0.22;
      };

    if (!reducedMotion) {
      window.addEventListener(
        'pointermove',
        handlePointerMove,
        {
          passive: true,
        },
      );
    }

    /* =====================================================
       RESIZE
    ===================================================== */

    const resize =
      (): void => {
        const width =
          Math.max(
            parent.clientWidth,
            1,
          );

        const height =
          Math.max(
            parent.clientHeight,
            1,
          );

        renderer.setSize(
          width,
          height,
          false,
        );

        camera.aspect =
          width / height;

        camera.updateProjectionMatrix();
      };

    const resizeObserver =
      new ResizeObserver(
        resize,
      );

    resizeObserver.observe(
      parent,
    );

    resize();

    /* =====================================================
       ANIMATION
    ===================================================== */

    const clock =
      new THREE.Clock();

    let animationFrame = 0;

    const animate =
      (): void => {
        const elapsed =
          clock.getElapsedTime();

        if (!reducedMotion) {
          group.rotation.y +=
            (
              pointerX -
              group.rotation.y
            ) *
            0.025;

          group.rotation.x +=
            (
              -pointerY -
              group.rotation.x
            ) *
            0.025;

          core.rotation.y +=
            0.003;

          core.rotation.z +=
            0.001;

          inner.rotation.y -=
            0.002;

          inner.rotation.x =
            Math.sin(
              elapsed * 0.5,
            ) *
            0.15;

          ringOne.rotation.z +=
            0.002;

          ringTwo.rotation.y -=
            0.0016;

          particles.rotation.y +=
            0.0005;

          particles.rotation.x =
            Math.sin(
              elapsed * 0.15,
            ) *
            0.04;
        }

        renderer.render(
          scene,
          camera,
        );

        animationFrame =
          window.requestAnimationFrame(
            animate,
          );
      };

    animate();

    /* =====================================================
       CLEANUP
    ===================================================== */

    return () => {
      window.cancelAnimationFrame(
        animationFrame,
      );

      resizeObserver.disconnect();

      window.removeEventListener(
        'pointermove',
        handlePointerMove,
      );

      coreGeometry.dispose();
      coreMaterial.dispose();

      innerGeometry.dispose();
      innerMaterial.dispose();

      ringGeometryOne.dispose();
      ringGeometryTwo.dispose();
      ringMaterial.dispose();

      particleGeometry.dispose();
      particleMaterial.dispose();

      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
      }}
    />
  );
}