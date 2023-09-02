import { AxisBottom } from '@visx/axis';
import { curveMonotoneX } from '@visx/curve';
import { localPoint } from '@visx/event';
import { LinearGradient } from '@visx/gradient';
import { GridRows, GridColumns } from '@visx/grid';
import { ParentSize } from '@visx/responsive';
import { scaleTime, scaleLinear } from '@visx/scale';
import { AreaClosed, Line, Bar } from '@visx/shape';
import {
  withTooltip,
  Tooltip,
  TooltipWithBounds,
  defaultStyles,
} from '@visx/tooltip';
import { WithTooltipProvidedProps } from '@visx/tooltip/lib/enhancers/withTooltip';
import { max, extent, bisector } from 'd3-array';
import * as d3TimeFormat from 'd3-time-format';
import { timeFormat } from 'd3-time-format';
import { FC, MouseEvent, TouchEvent, useCallback, useMemo } from 'react';
import colors from 'tailwindcss/colors';

interface AreaChartData {
  date: number;
  value: number;
}

type TooltipData = AreaChartData;

const background = 'transparent';
const background2 = 'transparent';
const accentColor = colors.sky['500'];

const format = timeFormat('%b %d');
const formatDateAxes = (date: Date | any) => format(date);

const formatDate = d3TimeFormat.timeFormat("%b %d, '%y");

const getDate = (d: AreaChartData) => new Date(d.date);
const getValue = (d: AreaChartData) => d.value;
const bisectDate = bisector<AreaChartData, Date>((d) => new Date(d.date)).left;

export interface FixedAreaChartProps {
  data: AreaChartData[];
  width: number;
  height: number;
  margin?: { top: number; right: number; bottom: number; left: number };
}

const tooltipStyles = {
  ...defaultStyles,
  background: colors.neutral['900'],
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: colors.neutral['800'],
  color: colors.neutral['300'],
  fontSize: '11px',
};

const FixedAreaChart = withTooltip<FixedAreaChartProps, TooltipData>(
  ({
    data,
    width: parentWidth,
    height,
    margin = { top: 0, right: -1, bottom: 0, left: -1 },
    showTooltip,
    hideTooltip,
    tooltipData,
    tooltipTop = 0,
    tooltipLeft = 0,
  }: FixedAreaChartProps & WithTooltipProvidedProps<TooltipData>) => {
    if (parentWidth < 10) return null;

    const width = parentWidth;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const dateScale = useMemo(
      () =>
        scaleTime({
          range: [margin.left, innerWidth + margin.left],
          domain: extent(data, getDate) as [Date, Date],
        }),
      [innerWidth, margin.left],
    );

    const dataValueScale = useMemo(
      () =>
        scaleLinear({
          range: [innerHeight + margin.top, margin.top],
          domain: [0, (max(data, getValue) || 0) + innerHeight / 3],
          nice: true,
        }),
      [margin.top, innerHeight],
    );

    const handleTooltip = useCallback(
      (event: TouchEvent<SVGRectElement> | MouseEvent<SVGRectElement>) => {
        const { x } = localPoint(event) || { x: 0 };
        const x0 = dateScale.invert(x);
        const index = bisectDate(data, x0, 1);
        const d0 = data[index - 1];
        const d1 = data[index];
        let d = d0;
        if (d1 && getDate(d1)) {
          d =
            x0.valueOf() - getDate(d0).valueOf() >
            getDate(d1).valueOf() - x0.valueOf()
              ? d1
              : d0;
        }
        showTooltip({
          tooltipData: d,
          tooltipLeft: x,
          tooltipTop: dataValueScale(getValue(d)),
        });
      },
      [showTooltip, dataValueScale, dateScale],
    );

    return (
      <div className="relative pb-16">
        <div className="overflow-hidden rounded-md border border-dashed border-neutral-800 pl-[-1px]">
          <svg width={width} height={height} className="z-10">
            <rect
              x={0}
              y={0}
              width={width}
              height={height}
              fill="url(#area-background-gradient)"
              rx={0}
            />
            <LinearGradient
              id="area-background-gradient"
              from={background}
              to={background2}
            />
            <LinearGradient
              id="area-gradient"
              from={accentColor}
              to={accentColor}
              fromOpacity={0.7}
              toOpacity={0.2}
            />
            <GridRows
              left={margin.left}
              scale={dataValueScale}
              width={innerWidth}
              strokeDasharray="1,3"
              stroke={accentColor}
              strokeOpacity={0}
              pointerEvents="none"
            />
            <GridColumns
              top={margin.top}
              scale={dateScale}
              height={innerHeight}
              strokeDasharray="1,3"
              stroke={colors.neutral['800']}
              pointerEvents="none"
            />
            <AreaClosed<AreaChartData>
              data={data}
              x={(d) => dateScale(getDate(d)) ?? 0}
              y={(d) => dataValueScale(getValue(d)) ?? 0}
              yScale={dataValueScale}
              strokeWidth={1}
              stroke="url(#area-gradient)"
              fill="url(#area-gradient)"
              curve={curveMonotoneX}
            />
            <Bar
              x={margin.left}
              y={margin.top}
              width={innerWidth}
              height={innerHeight}
              fill="transparent"
              rx={14}
              onTouchStart={handleTooltip}
              onTouchMove={handleTooltip}
              onMouseMove={handleTooltip}
              onMouseLeave={() => hideTooltip()}
            />
            {tooltipData && (
              <g>
                {/* Moving line */}
                <Line
                  from={{ x: tooltipLeft, y: margin.top }}
                  to={{ x: tooltipLeft, y: innerHeight + margin.top }}
                  stroke={accentColor}
                  strokeWidth={1}
                  pointerEvents="none"
                  strokeDasharray="2,2"
                />
                <circle
                  cx={tooltipLeft}
                  cy={tooltipTop - 1}
                  r={4}
                  fill="black"
                  fillOpacity={0.1}
                  stroke="black"
                  strokeOpacity={0.1}
                  strokeWidth={2}
                  pointerEvents="none"
                />
                <circle
                  cx={tooltipLeft}
                  cy={tooltipTop}
                  r={4}
                  fill={colors.sky['500']}
                  stroke="white"
                  strokeWidth={2}
                  pointerEvents="none"
                />
              </g>
            )}
          </svg>
          {tooltipData && (
            <div>
              <TooltipWithBounds
                key={Math.random()}
                top={tooltipTop - 40}
                left={tooltipLeft}
                style={tooltipStyles}
              >
                {getValue(tooltipData)}
              </TooltipWithBounds>
              <Tooltip
                top={innerHeight + margin.top + 14}
                left={tooltipLeft}
                style={{
                  ...defaultStyles,
                  ...tooltipStyles,
                  background: colors.black,
                  minWidth: 80,
                  textAlign: 'center',
                  transform: 'translateX(-50%)',
                }}
              >
                {formatDate(getDate(tooltipData))}
              </Tooltip>
            </div>
          )}
        </div>
        <div className="inset-x-0 bottom-0 z-0 ml-[1px] mt-1 h-12">
          <svg width={width} height={48}>
            <AxisBottom
              scale={dateScale}
              stroke="transparent"
              tickStroke={colors.neutral['900']}
              tickLength={3}
              numTicks={4}
              tickFormat={formatDateAxes}
              tickClassName="text-neutral-500"
              tickLabelProps={() => ({
                fontSize: 11,
                fill: colors.neutral['500'],
              })}
            />
          </svg>
        </div>
      </div>
    );
  },
);

const AreaChart: FC<Omit<FixedAreaChartProps, 'width'>> = (props) => {
  return (
    <ParentSize debounceTime={20}>
      {(parent) => <FixedAreaChart {...props} width={parent.width} />}
    </ParentSize>
  );
};

export default AreaChart;
