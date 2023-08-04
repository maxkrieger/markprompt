import { FileSectionReference } from '@markprompt/core';
import * as Dialog from '@radix-ui/react-dialog';
import { parseISO } from 'date-fns';
import { ThumbsDownIcon, ThumbsUpIcon, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { FC, useState } from 'react';
import useSWR from 'swr';

import { MarkdownContainer } from '@/components/emails/templates/MarkdownContainer';
import { SkeletonTable } from '@/components/ui/Skeletons';
import { formatShortDateTimeInTimeZone } from '@/lib/date';
import useProject from '@/lib/hooks/use-project';
import { fetcher } from '@/lib/utils';
import { PromptStatusTag } from '@/pages/[team]/[project]/insights';
import { DbFile, DbQueryStat, PromptQueryStatFull } from '@/types/types';

const Loading = <p className="p-4 text-sm text-neutral-500">Loading...</p>;

const EditorDialog = dynamic(() => import('@/components/files/EditorDialog'), {
  loading: () => Loading,
});

type QueryStatDialogProps = {
  queryStatId?: DbQueryStat['id'];
  open: boolean;
  setOpen: (open: boolean) => void;
};

const QueryStatDialog: FC<QueryStatDialogProps> = ({
  queryStatId,
  open,
  setOpen,
}) => {
  const { project } = useProject();
  const { data: queryStat, error } = useSWR(
    queryStatId && project?.id
      ? `/api/project/${project.id}/insights/query/${queryStatId}`
      : null,
    fetcher<PromptQueryStatFull | undefined>,
  );
  const [openFileId, setOpenFileId] = useState<DbFile['id'] | undefined>(
    undefined,
  );
  const [editorOpen, setEditorOpen] = useState<boolean>(false);

  const loading = !queryStat && !error;

  const references = (queryStat?.meta as any)
    ?.references as FileSectionReference[];

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="animate-overlay-appear dialog-overlay" />
        <Dialog.Content className="animate-dialog-slide-in dialog-content relative flex h-[90%] max-h-[800px] w-[90%] max-w-[700px] flex-col outline-none">
          <button
            className="absolute top-4 right-4 rounded-md p-1 outline-none transition hover:bg-neutral-900"
            onClick={() => {
              setOpen(false);
            }}
          >
            <X className="h-4 w-4 text-neutral-500" />
          </button>
          <div className="flex-none border-b border-neutral-900 pb-2">
            <Dialog.Title className="dialog-title-xl">
              <p className="min-h-[50px] text-lg font-semibold text-neutral-300">
                {queryStat?.prompt || ''}
              </p>
            </Dialog.Title>
          </div>
          <div className="flex h-full w-full flex-grow flex-col gap-4 overflow-y-auto p-6">
            {loading ? (
              <div className="relative">
                <SkeletonTable onDark loading={true} />
              </div>
            ) : !queryStat ? (
              <p className="text-sm text-neutral-500">
                Could not retrieve prompt details.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 border-b border-neutral-900 pb-4">
                  <div className="text-sm text-neutral-500">Date</div>
                  <div className="text-sm text-neutral-500">Status</div>
                  <div className="text-sm text-neutral-500">Feedback</div>
                  <div className="text-sm text-neutral-300">
                    {formatShortDateTimeInTimeZone(
                      parseISO(queryStat.created_at),
                    )}
                  </div>
                  <div className="text-sm text-neutral-300">
                    <PromptStatusTag noResponse={!!queryStat.no_response} />
                  </div>
                  <div className="text-sm text-neutral-300">
                    {(queryStat.feedback as any)?.vote === '1' ? (
                      <ThumbsUpIcon className="h-4 w-4 text-green-600" />
                    ) : (queryStat.feedback as any)?.vote === '-1' ? (
                      <ThumbsDownIcon className="h-4 w-4 text-orange-600" />
                    ) : (
                      <>N/A</>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 border-b border-neutral-900 pb-4">
                  <p className="text-sm text-neutral-500">Response</p>
                  <MarkdownContainer
                    markdown={queryStat.response || 'No response'}
                  />
                </div>
                <div className="flex flex-col gap-2 pb-4">
                  <p className="text-sm text-neutral-500">References</p>
                  {!references || references.length === 0 ? (
                    <p className="text-sm text-neutral-300">N/A</p>
                  ) : (
                    <div className="flex flex-row flex-wrap items-center gap-2">
                      {references.map((f, i) => {
                        return (
                          <button
                            className="rounded-md border border-neutral-900 bg-neutral-1100 py-1 px-2 text-sm font-medium text-neutral-300"
                            key={`reference-${f.file?.path}-${f.meta?.leadHeading?.slug}-${i}`}
                            onClick={() => {
                              // if (!value.token_count) {
                              //   toast.success(
                              //     'To view the file content, retrain with the "force retrain" setting on.',
                              //   );
                              //   return;
                              // }
                              // setOpenFileId(value.id);
                              setEditorOpen(true);
                            }}
                          >
                            {f.meta?.leadHeading?.value ||
                              f.file?.title ||
                              'Untitled'}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
      <EditorDialog
        fileId={openFileId}
        open={editorOpen}
        setOpen={(open) => {
          if (!open) {
            setEditorOpen(false);
          }
        }}
      />
    </Dialog.Root>
  );
};

export default QueryStatDialog;
