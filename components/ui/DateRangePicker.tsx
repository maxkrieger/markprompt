import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Popover from '@radix-ui/react-popover';
import cn from 'classnames';
import { format, startOfDay, endOfDay } from 'date-fns';
import { Calendar as CalendarIcon, Check } from 'lucide-react';
import { useMemo } from 'react';
import { DateRange } from 'react-day-picker';

import Button from '@/components/ui/Button';
import { Calendar } from '@/components/ui/Calendar';
import {
  FixedDateRange,
  dateRangeToDateRangeZonedTime,
  dateRangeToFixedRange,
  fixedRangeToDateRangeZonedTime,
} from '@/lib/date';

const toLabel = (range: FixedDateRange) => {
  switch (range) {
    case FixedDateRange.TODAY:
      return 'Today';
    case FixedDateRange.PAST_7_DAYS:
      return 'Past 7 days';
    case FixedDateRange.PAST_4_WEEKS:
      return 'Past 4 weeks';
    case FixedDateRange.PAST_3_MONTHS:
      return 'Past 3 months';
    case FixedDateRange.PAST_12_MONTHS:
      return 'Past 12 months';
    case FixedDateRange.MONTH_TO_DATE:
      return 'Month to date';
    case FixedDateRange.LAST_MONTH:
      return 'Last month';
  }
};

export const DateRangePicker = ({
  className,
  range,
  setRange,
  defaultRange,
  disabled,
}: {
  className?: string;
  range?: DateRange;
  setRange?: (range: DateRange | undefined) => void;
  defaultRange?: FixedDateRange;
  disabled?: boolean;
}) => {
  const selectedFixedRange = useMemo(() => {
    return range ? dateRangeToFixedRange(range) : defaultRange;
  }, [range, defaultRange]);

  return (
    <div
      className={cn('flex flex-row', className, {
        'cursor-not-allowed': disabled,
      })}
    >
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button
            variant="plain"
            left
            light
            buttonSize="sm"
            disabled={disabled}
            asDropdown
            squareCorners="right"
            className={cn(
              'justify-start text-left font-normal',
              !range && 'text-muted-foreground',
            )}
          >
            {typeof selectedFixedRange === 'undefined'
              ? 'Custom'
              : toLabel(selectedFixedRange)}
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="animate-menu-up dropdown-menu-content"
            sideOffset={5}
          >
            {Object.keys(FixedDateRange)
              .filter((rangeKey) => isNaN(Number(rangeKey)))
              .map((rangeKey) => {
                const range =
                  FixedDateRange[rangeKey as keyof typeof FixedDateRange];
                const checked = range === selectedFixedRange;
                return (
                  <DropdownMenu.CheckboxItem
                    key={`date-range-picker-${rangeKey}`}
                    className="dropdown-menu-item dropdown-menu-item-indent"
                    checked={checked}
                    onClick={() => {
                      setRange?.(fixedRangeToDateRangeZonedTime(range));
                    }}
                  >
                    <>
                      {checked && (
                        <DropdownMenu.ItemIndicator className="dropdown-menu-item-indicator">
                          <Check className="h-3 w-3" />
                        </DropdownMenu.ItemIndicator>
                      )}
                      {toLabel(range)}
                    </>
                  </DropdownMenu.CheckboxItem>
                );
              })}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <Popover.Root>
        <Popover.Trigger asChild>
          <Button
            variant="plain"
            left
            light
            buttonSize="sm"
            squareCorners="left"
            disabled={disabled}
            className={cn(
              'justify-start text-left font-normal',
              !range && 'text-muted-foreground',
            )}
            Icon={(props) => (
              <CalendarIcon
                {...props}
                className={cn(props.className, 'text-neutral-500')}
              />
            )}
          >
            {range?.from ? (
              range.to ? (
                <>
                  {format(range.from, 'LLL dd, y')} -{' '}
                  {format(range.to, 'LLL dd, y')}
                </>
              ) : (
                format(range.from, 'LLL dd, y')
              )
            ) : (
              <span>Pick a date</span>
            )}
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="animate-menu-up z-30 mt-2 -mr-8 ml-8 rounded-lg border border-neutral-900 bg-neutral-1000 shadow-2xl sm:w-full">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={range?.from}
              selected={range}
              onSelect={(range) => {
                if (!range || !setRange) {
                  return;
                }
                setRange(
                  dateRangeToDateRangeZonedTime({
                    from: range.from && startOfDay(range.from),
                    to: range.to && endOfDay(range.to),
                  }),
                );
              }}
              numberOfMonths={2}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
};
