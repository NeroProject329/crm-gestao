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
  AdminFinancialDayView,
} from '@crm/contracts';

import {
  formatBRL,
  formatBusinessDate,
  moneyToCents,
} from '@/lib/format';

interface AdminFinancialChartProps {
  days:
    AdminFinancialDayView[];
}

interface ChartPoint {
  x:
    number;

  revenueY:
    number;

  profitY:
    number;

  day:
    AdminFinancialDayView;
}

const WIDTH =
  760;

const HEIGHT =
  240;

const PADDING_X =
  18;

const PADDING_TOP =
  22;

const PADDING_BOTTOM =
  38;

function pathFor(
  points:
    ChartPoint[],

  key:
    | 'revenueY'
    | 'profitY',
): string {
  return points
    .map(
      (
        point,
        index,
      ) =>
        `${
          index ===
          0
            ? 'M'
            : 'L'
        } ${point.x} ${point[key]}`,
    )
    .join(
      ' ',
    );
}

export function AdminFinancialChart({
  days,
}: AdminFinancialChartProps) {
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
                  .adminProfit,
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
          ) ||
          1n;

        const height =
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
                  height
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

              profitY:
                yFor(
                  moneyToCents(
                    day
                      .adminProfit,
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
    pathFor(
      points,
      'revenueY',
    );

  const profitPath =
    pathFor(
      points,
      'profitY',
    );

  useLayoutEffect(() => {
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
          root.current
            ?.querySelectorAll(
              '[data-admin-chart-line]',
            )
            .forEach(
              (
                node,
              ) => {
                const path =
                  node as
                    SVGPathElement;

                const length =
                  path
                    .getTotalLength();

                gsap.fromTo(
                  path,
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
        },
        root,
      );

    return () => {
      context.revert();
    };
  }, [
    revenuePath,
    profitPath,
  ]);

  if (
    days.length ===
    0
  ) {
    return (
      <div className="chart-empty">
        Nenhum resultado financeiro
        neste período.
      </div>
    );
  }

  return (
    <div
      ref={root}
      className="financial-chart admin-financial-chart"
    >
      <div className="chart-legend">
        <span>
          <i className="legend-dot revenue" />

          Faturamento
        </span>

        <span>
          <i className="legend-dot admin-profit" />

          Lucro ADMIN
        </span>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Evolução financeira geral"
      >
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

        {revenuePath ? (
          <path
            data-admin-chart-line
            d={
              revenuePath
            }
            className="chart-line revenue-line"
          />
        ) : null}

        {profitPath ? (
          <path
            data-admin-chart-line
            d={
              profitPath
            }
            className="chart-line admin-profit-line"
          />
        ) : null}

        {points.map(
          (
            point,
          ) => (
            <circle
              key={
                point
                  .day
                  .businessDate
              }
              cx={
                point.x
              }
              cy={
                point.profitY
              }
              r="4"
              className="admin-chart-dot"
            >
              <title>
                {`${formatBusinessDate(
                  point
                    .day
                    .businessDate,
                )}: ${formatBRL(
                  point
                    .day
                    .adminProfit,
                )}`}
              </title>
            </circle>
          ),
        )}
      </svg>

      <div className="chart-axis-labels">
        <span>
          {formatBusinessDate(
            days[0]
              .businessDate,
          )}
        </span>

        <span>
          {formatBusinessDate(
            days[
              days.length -
              1
            ]
              .businessDate,
          )}
        </span>
      </div>
    </div>
  );
}