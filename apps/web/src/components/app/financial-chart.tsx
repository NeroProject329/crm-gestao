'use client';

import {
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';

import {
  gsap,
} from 'gsap';

import type {
  EmployeeFinancialDayView,
} from '@crm/contracts';

import {
  formatBRL,
  formatBusinessDate,
  moneyToCents,
} from '@/lib/format';

interface FinancialChartProps {
  days:
    EmployeeFinancialDayView[];
}

interface ChartPoint {
  x: number;
  revenueY: number;
  resultY: number;

  day:
    EmployeeFinancialDayView;
}

const WIDTH = 760;
const HEIGHT = 240;

const PADDING_X = 18;
const PADDING_TOP = 22;
const PADDING_BOTTOM = 38;

function buildPath(
  points: ChartPoint[],
  key:
    | 'revenueY'
    | 'resultY',
): string {
  if (
    points.length === 0
  ) {
    return '';
  }

  return points
    .map(
      (
        point,
        index,
      ) =>
        `${
          index === 0
            ? 'M'
            : 'L'
        } ${point.x} ${
          point[key]
        }`,
    )
    .join(' ');
}

export function FinancialChart({
  days,
}: FinancialChartProps) {
  const root =
    useRef<HTMLDivElement>(
      null,
    );

  const points =
    useMemo(
      () => {
        if (
          days.length ===
          0
        ) {
          return [];
        }

        const values =
          days.flatMap(
            (
              day,
            ) => [
              moneyToCents(
                day
                  .approvedRevenue,
              ),

              moneyToCents(
                day
                  .employeeAmount,
              ),
            ],
          );

        const max =
          values.reduce(
            (
              current,
              value,
            ) =>
              value >
              current
                ? value
                : current,

            0n,
          ) || 1n;

        const chartHeight =
          HEIGHT -
          PADDING_TOP -
          PADDING_BOTTOM;

        return days.map(
          (
            day,
            index,
          ): ChartPoint => {
            const denominator =
              Math.max(
                days.length -
                  1,
                1,
              );

            const x =
              PADDING_X +
              (
                index /
                denominator
              ) *
                (
                  WIDTH -
                  PADDING_X *
                    2
                );

            function yFor(
              value:
                bigint,
            ): number {
              /*
               * Primeiro reduzimos tudo
               * para escala 0..10000
               * ainda usando BigInt.
               *
               * Number() recebe apenas
               * esse número pequeno,
               * nunca o dinheiro.
               */
              const ratio =
                Number(
                  (
                    value *
                    10_000n
                  ) /
                    max,
                ) /
                10_000;

              return (
                HEIGHT -
                PADDING_BOTTOM -
                ratio *
                  chartHeight
              );
            }

            return {
              x,

              revenueY:
                yFor(
                  moneyToCents(
                    day
                      .approvedRevenue,
                  ),
                ),

              resultY:
                yFor(
                  moneyToCents(
                    day
                      .employeeAmount,
                  ),
                ),

              day,
            };
          },
        );
      },
      [
        days,
      ],
    );

  const revenuePath =
    buildPath(
      points,
      'revenueY',
    );

  const resultPath =
    buildPath(
      points,
      'resultY',
    );

  useLayoutEffect(
    () => {
      if (
        !root.current
      ) {
        return;
      }

      const reduced =
        window
          .matchMedia(
            '(prefers-reduced-motion: reduce)',
          )
          .matches;

      if (reduced) {
        return;
      }

      const context =
        gsap.context(
          () => {
            const paths =
              root.current
                ?.querySelectorAll(
                  '[data-chart-line]',
                );

            if (!paths) {
              return;
            }

            paths.forEach(
              (
                path,
              ) => {
                const element =
                  path as SVGPathElement;

                const length =
                  element
                    .getTotalLength();

                gsap.fromTo(
                  element,

                  {
                    strokeDasharray:
                      length,

                    strokeDashoffset:
                      length,
                  },

                  {
                    strokeDashoffset:
                      0,

                    duration:
                      1,

                    ease:
                      'power3.out',
                  },
                );
              },
            );

            gsap.fromTo(
              '[data-chart-dot]',

              {
                scale: 0,
                transformOrigin:
                  'center',
              },

              {
                scale: 1,

                duration:
                  .35,

                stagger:
                  .025,

                delay:
                  .35,

                ease:
                  'back.out(1.8)',
              },
            );
          },

          root,
        );

      return () => {
        context.revert();
      };
    },
    [
      revenuePath,
      resultPath,
    ],
  );

  if (
    days.length ===
    0
  ) {
    return (
      <div className="chart-empty">
        Ainda não há resultados
        financeiros neste período.
      </div>
    );
  }

  const first =
    days[0];

  const last =
    days[
      days.length -
      1
    ];

  return (
    <div
      ref={root}

      className="financial-chart"
    >
      <div className="chart-legend">
        <span>
          <i className="legend-dot revenue" />

          Faturamento
        </span>

        <span>
          <i className="legend-dot result" />

          Seu resultado
        </span>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}

        role="img"

        aria-label="Evolução financeira no período"
      >
        <defs>
          <linearGradient
            id="chart-blue-area"

            x1="0"
            x2="0"

            y1="0"
            y2="1"
          >
            <stop
              offset="0%"

              stopColor="#126BFF"

              stopOpacity=".18"
            />

            <stop
              offset="100%"

              stopColor="#126BFF"

              stopOpacity="0"
            />
          </linearGradient>
        </defs>

        <line
          x1="18"
          x2="742"

          y1="62"
          y2="62"

          className="chart-grid-line"
        />

        <line
          x1="18"
          x2="742"

          y1="122"
          y2="122"

          className="chart-grid-line"
        />

        <line
          x1="18"
          x2="742"

          y1="182"
          y2="182"

          className="chart-grid-line"
        />

        {
          revenuePath
            ? (
              <path
                data-chart-line

                d={
                  revenuePath
                }

                className="chart-line revenue-line"
              />
            )
            : null
        }

        {
          resultPath
            ? (
              <path
                data-chart-line

                d={
                  resultPath
                }

                className="chart-line result-line"
              />
            )
            : null
        }

        {
          points.map(
            (
              point,
            ) => (
              <g
                key={
                  point
                    .day
                    .businessDate
                }
              >
                <circle
                  data-chart-dot

                  cx={
                    point.x
                  }

                  cy={
                    point.resultY
                  }

                  r="4"

                  className="chart-dot"
                >
                  <title>
                    {
                      `${formatBusinessDate(
                        point
                          .day
                          .businessDate,
                      )}: ${formatBRL(
                        point
                          .day
                          .employeeAmount,
                      )}`
                    }
                  </title>
                </circle>
              </g>
            ),
          )
        }
      </svg>

      <div className="chart-axis-labels">
        <span>
          {
            formatBusinessDate(
              first
                .businessDate,
            )
          }
        </span>

        <span>
          {
            formatBusinessDate(
              last
                .businessDate,
            )
          }
        </span>
      </div>
    </div>
  );
}