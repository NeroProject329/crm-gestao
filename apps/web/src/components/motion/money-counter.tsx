'use client';

import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  gsap,
} from 'gsap';

import {
  formatBRLFromCents,
  moneyToCents,
} from '@/lib/format';

interface MoneyCounterProps {
  value: string;

  className?: string;
}

export function MoneyCounter({
  value,
  className,
}: MoneyCounterProps) {
  const target =
    moneyToCents(
      value,
    );

  const [
    displayed,
    setDisplayed,
  ] =
    useState<bigint>(
      target,
    );

  const previous =
    useRef<bigint>(
      0n,
    );

  useEffect(
    () => {
      const reducedMotion =
        window
          .matchMedia(
            '(prefers-reduced-motion: reduce)',
          )
          .matches;

      if (reducedMotion) {
        setDisplayed(
          target,
        );

        previous.current =
          target;

        return;
      }

      const from =
        previous.current;

      const distance =
        target -
        from;

      const state = {
        progress: 0,
      };

      const tween =
        gsap.to(
          state,
          {
            progress:
              1000,

            duration:
              .9,

            ease:
              'power3.out',

            snap: {
              progress:
                1,
            },

            onUpdate:
              () => {
                const progress =
                  BigInt(
                    Math.round(
                      state.progress,
                    ),
                  );

                const current =
                  from +
                  (
                    distance *
                    progress
                  ) /
                  1000n;

                setDisplayed(
                  current,
                );
              },

            onComplete:
              () => {
                setDisplayed(
                  target,
                );

                previous.current =
                  target;
              },
          },
        );

      return () => {
        tween.kill();
      };
    },
    [
      target,
    ],
  );

  return (
    <span
      className={
        className
      }
    >
      {
        formatBRLFromCents(
          displayed,
        )
      }
    </span>
  );
}