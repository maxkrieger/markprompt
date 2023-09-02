import {
  eachHourOfInterval,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  isSameHour,
  isSameDay,
  isSameWeek,
  isSameMonth,
  startOfDay,
  endOfHour,
  endOfDay,
  endOfWeek,
  endOfMonth,
} from 'date-fns';
import { utcToZonedTime } from 'date-fns-tz';
import { FC, useMemo } from 'react';
import { DateRange } from 'react-day-picker';

import { REFERENCE_TIMEZONE, getHistogramBinSize } from '@/lib/date';
import { DateCountHistogramEntry, DateGranularity } from '@/types/types';

import BarChart from '../charts/bar-chart';
import { SkeletonTable } from '../ui/Skeletons';

interface QueriesHistogramProps {
  data: DateCountHistogramEntry[];
  dateRange?: DateRange;
  loading?: boolean;
}

const getHistogram = (
  data: DateCountHistogramEntry[],
  dateRange: DateRange,
  granularity: DateGranularity,
) => {
  if (!dateRange?.from || !dateRange?.to) {
    return [];
  }

  let binFunction: (interval: Interval) => Date[];
  let compareFunction: (
    dateLeft: Date | number,
    dateRight: Date | number,
  ) => boolean;
  let endOfBinFuntion: (date: Date | number) => Date;

  switch (granularity) {
    case 'hour': {
      binFunction = eachHourOfInterval;
      compareFunction = isSameHour;
      endOfBinFuntion = endOfHour;
      break;
    }
    case 'day': {
      binFunction = eachDayOfInterval;
      compareFunction = isSameDay;
      endOfBinFuntion = endOfDay;
      break;
    }
    case 'week': {
      binFunction = eachWeekOfInterval;
      compareFunction = isSameWeek;
      endOfBinFuntion = endOfWeek;
      break;
    }
    default: {
      binFunction = eachMonthOfInterval;
      compareFunction = isSameMonth;
      endOfBinFuntion = endOfMonth;
      break;
    }
  }

  const bins = binFunction({
    start: dateRange.from,
    end: dateRange.to,
  }).map((b) => utcToZonedTime(b, REFERENCE_TIMEZONE));

  return bins.map((bin) => {
    let count = 0;
    for (const entry of data) {
      if (compareFunction(entry.date, bin)) {
        count += entry.count;
      }
    }
    return {
      start: startOfDay(bin).getTime(),
      end: endOfBinFuntion(bin).getTime(),
      value: count,
    };
  });
};

export const QueriesHistogram: FC<QueriesHistogramProps> = ({
  data,
  dateRange,
  loading,
}) => {
  const chartData = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) {
      return [];
    }

    return getHistogram(data, dateRange, getHistogramBinSize(dateRange));
  }, [dateRange, data]);

  return (
    <div className="relative flex h-[200px] flex-col gap-2">
      <SkeletonTable onDark loading={loading} />
      {data?.length > 0 && (
        <BarChart data={chartData} height={180} interval="7d" />
      )}
    </div>
  );
};
