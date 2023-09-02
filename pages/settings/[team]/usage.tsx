import * as Progress from '@radix-ui/react-progress';
import cn from 'classnames';
import { endOfDay, formatISO, parseISO, startOfMonth } from 'date-fns';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { sum } from 'lodash-es';
import { InfinityIcon } from 'lucide-react';
import Link from 'next/link';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { DateRange } from 'react-day-picker';
import useSWR from 'swr';

import { QueriesHistogram } from '@/components/insights/queries-histogram';
import { TeamSettingsLayout } from '@/components/layouts/TeamSettingsLayout';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import {
  TableBody,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/Table';
import {
  FixedDateRange,
  REFERENCE_TIMEZONE,
  dateRangeToFixedRange,
  getHistogramBinSize,
  getStoredRangeOrDefaultZonedTime,
} from '@/lib/date';
import useTeam from '@/lib/hooks/use-team';
import {
  MAX_COMPLETIONS_ALLOWANCE,
  MAX_EMBEDDINGS_TOKEN_ALLOWANCE,
  getEmbeddingTokensAllowance,
  getMonthlyCompletionsAllowance,
} from '@/lib/stripe/tiers';
import { fetcher, formatUrl } from '@/lib/utils';
import { DateCountHistogramEntry, TeamStats } from '@/types/types';

dayjs.extend(duration);

const UsageCard = ({
  title,
  subtitle,
  percentage,
}: {
  title: ReactNode | string;
  subtitle: ReactNode | string;
  percentage: number;
}) => {
  return (
    <div className="flex flex-row items-center gap-4 p-4">
      <div className="flex flex-grow flex-col gap-2">
        <p className="text-sm font-medium text-neutral-100">{title}</p>
        <div className="flex flex-row items-center gap-4">
          <div className="w-16 flex-none">
            <Progress.Root
              // Fix overflow clipping in Safari
              // https://gist.github.com/domske/b66047671c780a238b51c51ffde8d3a0
              style={{ transform: 'translateZ(0)' }}
              className="relative h-2 flex-grow overflow-hidden rounded-full bg-neutral-800"
              value={10}
            >
              <Progress.Indicator
                className={cn(
                  'h-full w-full transform duration-500 ease-in-out',
                  {
                    'bg-sky-400': percentage <= 70,
                    'bg-amber-400': percentage > 70 && percentage <= 90,
                    'bg-red-400': percentage > 90,
                  },
                )}
                style={{
                  transform: `translateX(-${100 - Math.max(2, percentage)}%)`,
                }}
              />
            </Progress.Root>
          </div>
          <p className="text-sm text-neutral-400">{subtitle}</p>
        </div>
      </div>
    </div>
  );
};

const Usage = () => {
  const { team } = useTeam();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  useEffect(() => {
    if (!team?.id) {
      return;
    }
    setDateRange(
      getStoredRangeOrDefaultZonedTime(
        `${team.id}:usage:date-range`,
        FixedDateRange.MONTH_TO_DATE,
      ),
    );
  }, [team?.id]);

  useEffect(() => {
    if (!dateRange || !team?.id) {
      return;
    }
    const fixedDateRange = dateRangeToFixedRange(dateRange);
    if (fixedDateRange) {
      localStorage.setItem(
        `${team.id}:usage:date-range`,
        String(fixedDateRange),
      );
    }
  }, [dateRange, team?.id]);

  const fromISO = dateRange?.from && formatISO(dateRange?.from);
  const toISO = dateRange?.to && formatISO(dateRange?.to);

  const { data: teamContentStats } = useSWR(
    team?.id && fromISO && toISO ? `/api/team/${team.id}/usage/stats` : null,
    fetcher<TeamStats[]>,
  );

  const { data: numCompletionsResponse } = useSWR(
    team?.id && fromISO && toISO
      ? formatUrl(`/api/team/${team.id}/usage/completions`, {
          from: formatISO(startOfMonth(new Date())),
          to: formatISO(endOfDay(new Date())),
          tz: REFERENCE_TIMEZONE,
        })
      : null,
    fetcher<{ occurrences: number }>,
  );

  const { data: queriesHistogramResponse, error: queriesHistogramError } =
    useSWR(
      team?.id && fromISO && toISO
        ? formatUrl(`/api/team/${team.id}/usage/queries-histogram`, {
            from: fromISO,
            to: toISO,
            tz: REFERENCE_TIMEZONE,
            period: getHistogramBinSize(dateRange),
          })
        : null,
      fetcher<{ date: string; occurrences: number }[]>,
    );

  // Parse all dates here, once and for all
  const queriesHistogram = useMemo(() => {
    return queriesHistogramResponse?.map(
      (d) =>
        ({
          date: parseISO(d.date),
          count: d.occurrences,
        }) as DateCountHistogramEntry,
    );
  }, [queriesHistogramResponse]);

  const loadingQueriesHistogram =
    !queriesHistogramResponse && !queriesHistogramError;

  const numUsedEmbeddingsTokens = sum(
    (teamContentStats || []).map((s) => s.num_tokens),
  );

  const numAllowedEmbeddingsTokens = team
    ? getEmbeddingTokensAllowance(team)
    : 0;

  const embeddingsTokensPercentage =
    Math.min(
      100,
      Math.round((numUsedEmbeddingsTokens / numAllowedEmbeddingsTokens) * 100),
    ) || 0;

  const numCompletions = numCompletionsResponse?.occurrences || 0;

  const numAllowedCompletions = team ? getMonthlyCompletionsAllowance(team) : 0;

  const completionsPercentage =
    Math.min(100, Math.round((numCompletions / numAllowedCompletions) * 100)) ||
    0;

  return (
    <TeamSettingsLayout
      title="Usage"
      titleComponent={<div className="flex items-center">Usage</div>}
    >
      <div className="grid grid-cols-2 rounded-md border border-neutral-900 [&>div:not(:first-child)]:border-l [&>div:not(:first-child)]:border-neutral-900">
        <UsageCard
          title="Embeddings"
          subtitle={
            <>
              {numUsedEmbeddingsTokens}/
              {numAllowedEmbeddingsTokens === MAX_EMBEDDINGS_TOKEN_ALLOWANCE ? (
                <InfinityIcon className="inline-block h-4 w-4" />
              ) : (
                numAllowedEmbeddingsTokens
              )}
            </>
          }
          percentage={embeddingsTokensPercentage}
        />
        <UsageCard
          title={
            <>
              Completions{' '}
              <span className="text-sm font-normal text-neutral-500">
                (month to date)
              </span>
            </>
          }
          subtitle={
            <>
              {numCompletions}/
              {numAllowedCompletions === MAX_COMPLETIONS_ALLOWANCE ? (
                <InfinityIcon className="inline-block h-4 w-4" />
              ) : (
                numAllowedCompletions
              )}
            </>
          }
          percentage={completionsPercentage}
        />
      </div>
      <h2 className="mt-8 text-lg font-bold text-neutral-100">Content</h2>
      <div className="flex justify-start text-neutral-100">
        {!teamContentStats || teamContentStats?.length === 0 ? (
          <p className="text-sm text-neutral-500">No projects created.</p>
        ) : (
          <Table>
            <colgroup>
              <col className="w-[40%]" />
              <col className="w-[20%]" />
              <col className="w-[20%]" />
              <col className="w-[20%]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead>Files</TableHead>
                <TableHead>Sections</TableHead>
                <TableHead>Tokens</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamContentStats.map((s) => {
                return (
                  <TableRow key={s.project_id}>
                    <TableCell noIndent>
                      <Link
                        className="subtle-underline"
                        href={`/${team?.slug}/${s.project_slug}`}
                      >
                        {s.project_name}
                      </Link>
                    </TableCell>
                    <TableCell>{s.num_files}</TableCell>
                    <TableCell>{s.num_file_sections}</TableCell>
                    <TableCell>{s.num_tokens}</TableCell>
                  </TableRow>
                );
              })}
              <TableRow>
                <TableCell noIndent className="text-neutral-500">
                  Total
                </TableCell>
                <TableCell>
                  {sum(teamContentStats.map((s) => s.num_files))}
                </TableCell>
                <TableCell>
                  {sum(teamContentStats.map((s) => s.num_file_sections))}
                </TableCell>
                <TableCell>
                  {numUsedEmbeddingsTokens}
                  <span className="text-neutral-500">
                    /
                    {numAllowedEmbeddingsTokens ===
                    MAX_EMBEDDINGS_TOKEN_ALLOWANCE ? (
                      <InfinityIcon className="inline-block h-4 w-4" />
                    ) : (
                      numAllowedEmbeddingsTokens
                    )}
                  </span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </div>
      <h2 className="mt-8 text-lg font-bold text-neutral-100">Completions</h2>
      <div className="mt-4 flex cursor-not-allowed flex-row items-center justify-start gap-4">
        <div className="flex-grow">
          <DateRangePicker
            range={dateRange}
            setRange={setDateRange}
            defaultRange={FixedDateRange.MONTH_TO_DATE}
          />
        </div>
        <div className="flex-none">
          {queriesHistogram ? (
            <div className="text-sm text-neutral-500">
              In selected range:{' '}
              <span className="font-medium text-neutral-100">
                {queriesHistogram.reduce((acc, q) => acc + q.count, 0)}
              </span>
            </div>
          ) : (
            <></>
          )}
        </div>
      </div>
      <div className="mt-8 flex flex-col gap-8 pb-20">
        {!loadingQueriesHistogram &&
        (!queriesHistogram || queriesHistogram?.length === 0) ? (
          <p className="mt-2 text-sm text-neutral-500">
            No questions asked in this time range.
          </p>
        ) : (
          <QueriesHistogram
            dateRange={dateRange}
            loading={loadingQueriesHistogram}
            data={queriesHistogram || []}
          />
        )}
      </div>
    </TeamSettingsLayout>
  );
};

export default Usage;
