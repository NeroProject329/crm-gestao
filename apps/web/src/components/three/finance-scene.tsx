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

    const reducedMotionQuery =
      window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      );

    const compactQuery =
      window.matchMedia(
        '(max-width: 760px), (pointer: coarse)',
      );

    const reducedMotion =
      reducedMotionQuery.matches;

    const compact =
      compactQuery.matches;

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
        antialias:
          !compact,
        alpha: true,
        powerPreference:
          compact
            ? 'low-power'
            : 'high-performance',
      });

    renderer.setClearColor(
      0x000000,
      0,
    );

    renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio,
        compact
          ? 1.2
          : 1.65,
      ),
    );

    const group =
      new THREE.Group();

    scene.add(group);

    const coreGeometry =
      new THREE.IcosahedronGeometry(
        1.5,
        compact
          ? 1
          : 2,
      );

    const coreMaterial =
      new THREE.MeshBasicMaterial({
        color:
          0x2d8cff,
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

    const innerGeometry =
      new THREE.IcosahedronGeometry(
        0.82,
        1,
      );

    const innerMaterial =
      new THREE.MeshBasicMaterial({
        color:
          0x8bd1ff,
        transparent: true,
        opacity: 0.13,
      });

    const inner =
      new THREE.Mesh(
        innerGeometry,
        innerMaterial,
      );

    group.add(inner);

    const ringSegments =
      compact
        ? 80
        : 160;

    const ringGeometryOne =
      new THREE.TorusGeometry(
        2.05,
        0.012,
        8,
        ringSegments,
      );

    const ringGeometryTwo =
      new THREE.TorusGeometry(
        2.35,
        0.01,
        8,
        ringSegments,
      );

    const ringMaterial =
      new THREE.MeshBasicMaterial({
        color:
          0x75c2ff,
        transparent: true,
        opacity: 0.34,
        side:
          THREE.DoubleSide,
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

    const particleCount =
      compact
        ? 54
        : 110;

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
        color:
          0x79c8ff,
        size:
          compact
            ? 0.032
            : 0.025,
        transparent: true,
        opacity: 0.72,
      });

    const particles =
      new THREE.Points(
        particleGeometry,
        particleMaterial,
      );

    scene.add(particles);

    let pointerX = 0;
    let pointerY = 0;

    const handlePointerMove = (
      event: PointerEvent,
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

    if (
      !reducedMotion &&
      !compact
    ) {
      window.addEventListener(
        'pointermove',
        handlePointerMove,
        {
          passive: true,
        },
      );
    }

    const resize = (): void => {
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

    const clock =
      new THREE.Clock();

    let animationFrame = 0;
    let visible = true;
    let disposed = false;

    const renderFrame = (): void => {
      renderer.render(
        scene,
        camera,
      );
    };

    const animate = (): void => {
      if (
        disposed ||
        !visible ||
        document.hidden
      ) {
        animationFrame = 0;
        return;
      }

      const elapsed =
        clock.getElapsedTime();

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
        compact
          ? 0.0015
          : 0.003;

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

      renderFrame();

      animationFrame =
        window.requestAnimationFrame(
          animate,
        );
    };

    const startAnimation = (): void => {
      if (
        disposed ||
        reducedMotion ||
        !visible ||
        document.hidden ||
        animationFrame !== 0
      ) {
        return;
      }

      clock.start();

      animationFrame =
        window.requestAnimationFrame(
          animate,
        );
    };

    const stopAnimation = (): void => {
      if (
        animationFrame !== 0
      ) {
        window.cancelAnimationFrame(
          animationFrame,
        );

        animationFrame = 0;
      }

      clock.stop();
    };

    const visibilityObserver =
      new IntersectionObserver(
        (entries) => {
          visible =
            entries.some(
              (entry) =>
                entry.isIntersecting,
            );

          if (visible) {
            startAnimation();
          } else {
            stopAnimation();
          }
        },
        {
          rootMargin:
            '120px',
        },
      );

    visibilityObserver.observe(
      canvas,
    );

    const handleVisibilityChange =
      (): void => {
        if (
          document.hidden
        ) {
          stopAnimation();
        } else {
          startAnimation();
        }
      };

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    );

    renderFrame();

    if (!reducedMotion) {
      startAnimation();
    }

    return () => {
      disposed = true;

      stopAnimation();

      resizeObserver.disconnect();
      visibilityObserver.disconnect();

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      );

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
      data-performance-scene="finance"
      style={{
        display:
          'block',
        width:
          '100%',
        height:
          '100%',
      }}
    />
  );
}
