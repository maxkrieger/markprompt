import { ColumnDef } from '@tanstack/react-table';
import { parseISO } from 'date-fns';
import { ArrowDown, ArrowUp, ThumbsDownIcon, ThumbsUpIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';

import { Card } from '@/components/dashboard/Card';
import { QueriesDataTable } from '@/components/insights/queries/table';
import { QueriesHistogram } from '@/components/insights/queries-histogram';
import { TopReferences } from '@/components/insights/top-references';
import { ProjectSettingsLayout } from '@/components/layouts/ProjectSettingsLayout';
import Button from '@/components/ui/Button';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { Tag } from '@/components/ui/Tag';
import { processQueryStats } from '@/lib/api';
import { FixedDateRange, formatShortDateTimeInTimeZone } from '@/lib/date';
import useInsights from '@/lib/hooks/use-insights';
import useProject from '@/lib/hooks/use-project';
import useTeam from '@/lib/hooks/use-team';
import { canViewInsights, getAccessibleInsightsType } from '@/lib/stripe/tiers';
import { useDebouncedState } from '@/lib/utils.react';
import { DbQueryStat, PromptQueryStat } from '@/types/types';

const Loading = <p className="p-4 text-sm text-neutral-500">Loading...</p>;

const QueryStat = dynamic(
  () => import('@/components/dialogs/project/QueryStat'),
  {
    loading: () => Loading,
  },
);

export const PromptStatusTag = ({ noResponse }: { noResponse: boolean }) => {
  return (
    <Tag color={noResponse ? 'orange' : 'green'}>
      {noResponse ? 'No response' : 'Answered'}
    </Tag>
  );
};

const Insights = () => {
  const { project } = useProject();
  const { team } = useTeam();
  const {
    queries,
    mutateQueries,
    loadingQueries,
    topReferences,
    loadingTopReferences,
    queriesHistogram,
    loadingQueriesHistogram,
    dateRange,
    setDateRange,
    page,
    setPage,
    hasMorePages,
  } = useInsights();
  const [isProcessingQueryStats, setProcessingQueryStats] = useDebouncedState(
    false,
    1000,
  );
  const [currentQueryStatId, setCurrentQueryStatId] = useState<
    DbQueryStat['id'] | undefined
  >(undefined);
  const [queryStatDialogOpen, setQueryStatDialogOpen] = useState(false);

  const columns = useMemo(() => {
    return [
      // {
      //   id: 'select',
      //   header: ({ table }) => (
      //     <Checkbox
      //       checked={table.getIsAllPageRowsSelected()}
      //       indeterminate={table.getIsSomeRowsSelected()}
      //       onChange={table.getToggleAllRowsSelectedHandler()}
      //       aria-label="Select all"
      //     />
      //   ),
      //   cell: ({ row }) => (
      //     <Checkbox
      //       checked={row.getIsSelected()}
      //       onChange={row.getToggleSelectedHandler()}
      //       aria-label="Select row"
      //     />
      //   ),
      //   enableSorting: false,
      //   enableHiding: false,
      // },
      {
        accessorKey: 'prompt',
        header: ({ column }) => {
          const sorted = column.getIsSorted();
          return (
            <Button
              className="p-0 text-neutral-300"
              noStyle
              onClick={() => column.toggleSorting(sorted === 'asc')}
            >
              <div className="flex flex-row items-center gap-2">
                Question
                {sorted === 'asc' ? (
                  <ArrowUp className="h-3 w-3" />
                ) : sorted === 'desc' ? (
                  <ArrowDown className="h-3 w-3" />
                ) : null}
              </div>
            </Button>
          );
        },
        cell: ({ row }) => {
          return (
            <div className="prompt flex w-full">
              <div className="overflow-hidden truncate text-neutral-300">
                {row.getValue('prompt')}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'feedback',
        header: ({ column }) => {
          const sorted = column.getIsSorted();
          return (
            <Button
              className="p-0 text-neutral-300"
              noStyle
              onClick={() => column.toggleSorting(sorted === 'asc')}
            >
              <div className="flex flex-row items-center gap-2">
                Feedback
                {sorted === 'asc' ? (
                  <ArrowUp className="h-3 w-3" />
                ) : sorted === 'desc' ? (
                  <ArrowDown className="h-3 w-3" />
                ) : null}
              </div>
            </Button>
          );
        },
        cell: ({ row }) => {
          const vote = (row.getValue('feedback') as any)?.vote;
          return (
            <div className="group relative flex">
              <div className="overflow-hidden truncate text-neutral-300">
                {vote === '1' ? (
                  <ThumbsUpIcon className="h-4 w-4 text-green-600" />
                ) : vote === '-1' ? (
                  <ThumbsDownIcon className="h-4 w-4 text-orange-600" />
                ) : (
                  <></>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'no_response',
        header: ({ column }) => {
          const sorted = column.getIsSorted();
          return (
            <Button
              className="p-0 text-neutral-300"
              noStyle
              onClick={() => column.toggleSorting(sorted === 'asc')}
            >
              <div className="flex flex-row items-center gap-2">
                Status
                {sorted === 'asc' ? (
                  <ArrowUp className="h-3 w-3" />
                ) : sorted === 'desc' ? (
                  <ArrowDown className="h-3 w-3" />
                ) : null}
              </div>
            </Button>
          );
        },
        cell: ({ row }) => {
          const noResponse = !!row.getValue('no_response');
          return <PromptStatusTag noResponse={noResponse} />;
        },
      },
      {
        accessorKey: 'created_at',
        header: ({ column }) => {
          const sorted = column.getIsSorted();
          return (
            <Button
              className="p-0 text-neutral-300"
              noStyle
              onClick={() => column.toggleSorting(sorted === 'asc')}
            >
              <div className="flex flex-row items-center gap-2">
                Date
                {sorted === 'asc' ? (
                  <ArrowUp className="h-3 w-3" />
                ) : sorted === 'desc' ? (
                  <ArrowDown className="h-3 w-3" />
                ) : null}
              </div>
            </Button>
          );
        },
        cell: ({ row }) => {
          const date = formatShortDateTimeInTimeZone(
            parseISO(row.getValue('created_at')),
          );
          return (
            <div className="overflow-hidden truncate whitespace-nowrap text-sm text-neutral-500">
              {date}
            </div>
          );
        },
      },
      // {
      //   id: 'actions',
      //   enableHiding: false,
      //   cell: ({ row }) => {
      //     // const payment = row.original;

      //     return (
      //       <DropdownMenu.Root
      //       // onOpenChange={(open) => setMenuOpen(open)}
      //       // open={isMenuOpen}
      //       >
      //         <DropdownMenu.Trigger asChild>
      //           <div className="flex items-center justify-center border">
      //             <button
      //               className="button-ring select-none rounded-full outline-none transition hover:opacity-70"
      //               aria-label="Open menu"
      //             >
      //               <MoreHorizontalIcon className="h-4 w-4 text-neutral-500" />
      //             </button>
      //           </div>
      //         </DropdownMenu.Trigger>
      //         <DropdownMenu.Portal>
      //           <DropdownMenu.Content
      //             className="animate-menu-up dropdown-menu-content mr-2 min-w-[160px]"
      //             sideOffset={5}
      //           >
      //             <DropdownMenu.Label className="dropdown-menu-item-noindent">
      //               <div className="flex flex-col pt-2 pb-3">
      //                 <p className="text-sm text-neutral-300">Ok</p>
      //               </div>
      //             </DropdownMenu.Label>
      //           </DropdownMenu.Content>
      //         </DropdownMenu.Portal>
      //       </DropdownMenu.Root>
      //       // <DropdownMenu.Root>
      //       //   <DropdownMenu.Trigger>
      //       //     <Button
      //       //       noStyle
      //       //       className="flex flex-none items-center rounded-md p-1 outline-none hover:bg-neutral-900"
      //       //     >
      //       //       <span className="sr-only">Open menu</span>
      //       //       <MoreHorizontalIcon className="h-4 w-4 text-neutral-500" />
      //       //     </Button>
      //       //   </DropdownMenu.Trigger>
      //       //   <DropdownMenu.Content align="end">
      //       //     <DropdownMenu.Label>Actions</DropdownMenu.Label>
      //       //     <DropdownMenu.Item
      //       //       onClick={() => navigator.clipboard.writeText(payment.id)}
      //       //     >
      //       //       Copy payment ID
      //       //     </DropdownMenu.Item>
      //       //     <DropdownMenu.Separator />
      //       //     <DropdownMenu.Item>View customer</DropdownMenu.Item>
      //       //     <DropdownMenu.Item>View payment details</DropdownMenu.Item>
      //       //   </DropdownMenu.Content>
      //       // </DropdownMenu.Root>
      //     );
      //   },
      // },
    ] as ColumnDef<PromptQueryStat>[];
  }, []);

  useEffect(() => {
    if (!team || !project?.id) {
      return;
    }
    const insightsType = getAccessibleInsightsType(team);
    if (!insightsType) {
      console.info('No processing insights');
      // Don't process insights unless on the adequate plan.
      return;
    }

    let stopProcessing = false;

    const process = async () => {
      if (stopProcessing) {
        setProcessingQueryStats(false);
        return;
      }
      try {
        console.debug('Start processing query stats');
        const res = await processQueryStats(project.id);
        await mutateQueries();
        console.debug('Process query stats response:', JSON.stringify(res));

        if (res.allProcessed) {
          setProcessingQueryStats(false);
        } else {
          // Don't show processing every time the page is opened,
          // while checking processing state. Only show processing
          // after a first round-trip, where it's confirmed we're
          // not done processing stats.
          setProcessingQueryStats(true);
          process();
        }
      } catch (e) {
        console.error('Error processing stats', e);
        process();
      }
    };

    process();

    return () => {
      stopProcessing = true;
    };
  }, [project?.id, setProcessingQueryStats, team, mutateQueries]);

  return (
    <ProjectSettingsLayout
      title="Insights"
      titleComponent={
        <div className="flex items-center">
          Insights
          {isProcessingQueryStats && (
            <>
              {' '}
              <Tag size="sm" color="fuchsia" className="ml-2">
                Processing
              </Tag>
            </>
          )}
        </div>
      }
      width="2xl"
    >
      <div className="flex justify-start">
        <DateRangePicker
          disabled={team && !canViewInsights(team)}
          range={dateRange}
          setRange={setDateRange}
          defaultRange={FixedDateRange.PAST_3_MONTHS}
        />
      </div>
      <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-3">
        <div className="col-span-2">
          <Card title="Latest questions">
            <QueriesDataTable
              loading={loadingQueries}
              columns={columns}
              data={queries || []}
              showUpgradeMessage={team && !canViewInsights(team)}
              page={page}
              setPage={setPage}
              hasMorePages={hasMorePages}
              onRowClick={(row) => {
                setCurrentQueryStatId(row.original.id);
                setQueryStatDialogOpen(true);
              }}
            />
          </Card>
        </div>
        <div className="flex flex-col gap-8">
          <Card
            title="New questions"
            accessory={
              queriesHistogram ? (
                <div className="text-sm text-neutral-500">
                  In selected range:{' '}
                  <span className="font-medium text-neutral-100">
                    {queriesHistogram.reduce((acc, q) => acc + q.count, 0)}
                  </span>
                </div>
              ) : (
                <></>
              )
            }
          >
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
          </Card>
          <Card title="Most cited sources">
            {!loadingTopReferences && topReferences?.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-500">
                No references cited in this time range.
              </p>
            ) : (
              <div className="mt-4">
                <TopReferences
                  loading={loadingTopReferences}
                  topReferences={topReferences || []}
                  showUpgradeMessage={team && !canViewInsights(team)}
                />
              </div>
            )}
          </Card>
        </div>
      </div>
      <QueryStat
        queryStatId={currentQueryStatId}
        open={queryStatDialogOpen}
        setOpen={setQueryStatDialogOpen}
      />
    </ProjectSettingsLayout>
  );
};

export default Insights;
