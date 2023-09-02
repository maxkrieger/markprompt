import {
  add,
  differenceInDays,
  endOfDay,
  endOfMonth,
  isSameDay,
  startOfDay,
  startOfMonth,
} from 'date-fns';
import { formatInTimeZone, utcToZonedTime } from 'date-fns-tz';
import { DateRange } from 'react-day-picker';

const now = new Date();

export const REFERENCE_TIMEZONE =
  typeof Intl === 'object'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : 'UTC';

export const getHistogramBinSize = (dateRange: DateRange) => {
  const numDays = differenceInDays(
    dateRange.to || new Date(),
    dateRange.from || new Date(),
  );

  if (numDays < 2) {
    // If interval is shorter than 2 days, bin by hour hour
    return 'hour';
  } else if (numDays < 31) {
    // If interval is shorter than 31 days, bin by day
    return 'day';
  } else if (numDays < 95) {
    // If interval is shorter than 95 days, bin by week
    return 'week';
  } else {
    // Bin by month
    return 'month';
  }
};

export const formatShortDateTimeInTimeZone = (date: Date) => {
  // Short date and time
  // Jun 12, 8:20 PM
  // Jun 12 2022, 8:20 PM
  return formatInTimeZone(
    date,
    REFERENCE_TIMEZONE,
    `MMM d${date.getFullYear() !== now.getFullYear() ? ', yyyy' : ''}, h:mm a`,
  );
};

export enum FixedDateRange {
  TODAY = 0,
  PAST_7_DAYS = 1,
  PAST_4_WEEKS = 2,
  PAST_3_MONTHS = 3,
  PAST_12_MONTHS = 4,
  MONTH_TO_DATE = 5,
  LAST_MONTH = 6,
}

export const getStoredRangeOrDefaultZonedTime = (
  key: string,
  defaultRange: FixedDateRange,
): DateRange => {
  const storedFixedRange = localStorage.getItem(key);
  try {
    if (storedFixedRange) {
      return fixedRangeToDateRangeZonedTime(
        getFixedRangeOrDefault(parseInt(storedFixedRange), defaultRange),
      );
    }
  } catch {
    // Do nothing
  }
  return fixedRangeToDateRangeZonedTime(defaultRange);
};

const getFixedDateRangeStart = (range: FixedDateRange) => {
  switch (range) {
    case FixedDateRange.TODAY:
      return startOfDay(new Date());
    case FixedDateRange.PAST_7_DAYS:
      return startOfDay(add(new Date(), { days: -7 }));
    case FixedDateRange.PAST_4_WEEKS:
      return startOfDay(add(new Date(), { weeks: -4 }));
    case FixedDateRange.PAST_3_MONTHS:
      return startOfDay(add(new Date(), { months: -3 }));
    case FixedDateRange.PAST_12_MONTHS:
      return startOfDay(add(new Date(), { months: -12 }));
    case FixedDateRange.MONTH_TO_DATE:
      return startOfMonth(new Date());
    case FixedDateRange.LAST_MONTH:
      return startOfMonth(add(new Date(), { months: -1 }));
  }
};

const getFixedDateRangeEnd = (range: FixedDateRange) => {
  switch (range) {
    case FixedDateRange.LAST_MONTH:
      return endOfMonth(add(new Date(), { months: -1 }));
    default:
      return new Date();
  }
};

export const dateRangeToFixedRange = (
  range: DateRange,
): FixedDateRange | undefined => {
  const start = range.from;
  const end = range.to;

  if (!start || !end) {
    return undefined;
  }

  for (const rangeKey of Object.keys(FixedDateRange)) {
    if (isNaN(Number(rangeKey))) {
      const range = FixedDateRange[rangeKey as keyof typeof FixedDateRange];
      if (
        isSameDay(start, getFixedDateRangeStart(range)) &&
        isSameDay(end, getFixedDateRangeEnd(range))
      ) {
        return range;
      }
    }
  }

  return undefined;
};

export const dateRangeToDateRangeZonedTime = (dateRangeUTC: DateRange) => {
  return {
    from:
      dateRangeUTC.from &&
      utcToZonedTime(dateRangeUTC.from, REFERENCE_TIMEZONE),
    to: dateRangeUTC.to && utcToZonedTime(dateRangeUTC.to, REFERENCE_TIMEZONE),
  };
};

export const getFixedRangeOrDefault = (
  range: FixedDateRange,
  defaultRange: FixedDateRange,
): FixedDateRange => {
  return typeof range === 'number' && !isNaN(range) ? range : defaultRange;
};

export const fixedRangeToDateRangeZonedTime = (
  range: FixedDateRange,
): DateRange => {
  return dateRangeToDateRangeZonedTime({
    from: getFixedDateRangeStart(range),
    to: endOfDay(getFixedDateRangeEnd(range)),
  });
};
