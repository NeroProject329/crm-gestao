'use client';

import {
  useLayoutEffect,
  useRef,
} from 'react';

import {
  gsap,
} from 'gsap';

interface PageTransitionProps {
  children:
    React.ReactNode;
}

export function PageTransition({
  children,
}: PageTransitionProps) {
  const root =
    useRef<HTMLDivElement>(
      null,
    );

  useLayoutEffect(
    () => {
      const element =
        root.current;

      if (!element) {
        return;
      }

      const reducedMotion =
        window
          .matchMedia(
            '(prefers-reduced-motion: reduce)',
          )
          .matches;

      if (reducedMotion) {
        return;
      }

      const context =
        gsap.context(
          () => {
            const timeline =
              gsap.timeline({
                defaults: {
                  ease:
                    'power3.out',
                },
              });

            timeline
              .fromTo(
                '[data-motion="page-header"]',
                {
                  y: 14,
                  opacity: 0,
                },
                {
                  y: 0,
                  opacity: 1,
                  duration: .45,
                },
              )

              .fromTo(
                '[data-motion="hero"]',
                {
                  y: 28,
                  opacity: 0,
                  scale: .985,
                },
                {
                  y: 0,
                  opacity: 1,
                  scale: 1,
                  duration: .7,
                },
                '-=.2',
              )

              .fromTo(
                '[data-motion="card"]',
                {
                  y: 22,
                  opacity: 0,
                },
                {
                  y: 0,
                  opacity: 1,

                  duration: .55,

                  stagger: .08,
                },
                '-=.35',
              );
          },

          element,
        );

      return () => {
        context.revert();
      };
    },
    [],
  );

  return (
    <div ref={root}>
      {children}
    </div>
  );
}