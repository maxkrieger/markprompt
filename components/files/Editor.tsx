import { parseISO } from 'date-fns';
import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import matter from 'gray-matter';
import { FC, Fragment, useMemo } from 'react';
import useSWR from 'swr';

import { formatShortDateTimeInTimeZone } from '@/lib/date';
import useProject from '@/lib/hooks/use-project';
import useSources from '@/lib/hooks/use-sources';
import { convertToMarkdown } from '@/lib/markdown';
import {
  fetcher,
  getFileTitle,
  getIconForSource,
  getLabelForSource,
  getFileNameForSourceAtPath,
  getFileType,
  supportsFrontmatter,
} from '@/lib/utils';
import { DbFile } from '@/types/types';

import { MarkdownContainer } from '../emails/templates/MarkdownContainer';
import { SkeletonTable } from '../ui/Skeletons';

dayjs.extend(localizedFormat);

type EditorProps = {
  fileId?: DbFile['id'];
};

export const Editor: FC<EditorProps> = ({ fileId }) => {
  const { project } = useProject();
  const { sources } = useSources();

  const { data: file, error } = useSWR(
    project?.id && fileId ? `/api/project/${project.id}/files/${fileId}` : null,
    fetcher<DbFile>,
  );

  const loading = !file && !error;

  const source = useMemo(() => {
    return sources?.find((s) => s.id === file?.source_id);
  }, [sources, file?.source_id]);

  const SourceItem = useMemo(() => {
    if (!source) {
      return <></>;
    }
    const Icon = getIconForSource(source.type);
    return (
      <div className="flex flex-row items-center gap-2">
        <Icon className="h-4 w-4 flex-none text-neutral-500" />
        <p className="flex-grow overflow-hidden truncate text-neutral-300">
          {getLabelForSource(source, false)}
        </p>
      </div>
    );
  }, [source]);

  const { markdownContent, filename } = useMemo(() => {
    if (!file?.raw_content || !source) {
      return { markdownContent: '', filename: '' };
    }
    const filename = getFileNameForSourceAtPath(source, file.path);
    const m = matter(file.raw_content);
    const markdownContent = convertToMarkdown(m.content.trim(), filename);
    return { markdownContent, filename };
  }, [file?.raw_content, file?.path, source]);

  if (loading) {
    return (
      <div className="w-full p-4">
        <div className="relative">
          <SkeletonTable loading />;
        </div>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="flex flex-col items-center gap-2 p-4 text-sm text-neutral-300">
        File not accessible
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-screen-md flex-col gap-2">
      <h1 className="mt-12 text-3xl font-bold text-neutral-100">
        {getFileTitle(file, sources)}
      </h1>
      <div className="mt-8 grid grid-cols-3 gap-2 border-b border-neutral-900 pb-4">
        <div className="text-sm text-neutral-500">Synced</div>
        <div className="text-sm text-neutral-500">Source</div>
        <div className="text-sm text-neutral-500">Path</div>
        <div className="text-sm text-neutral-300">
          {formatShortDateTimeInTimeZone(parseISO(file.updated_at))}
        </div>
        <div className="text-sm text-neutral-300">{SourceItem}</div>
        <div className="text-sm text-neutral-300">{file.path}</div>
      </div>
      {supportsFrontmatter(getFileType(filename)) &&
        file?.meta &&
        Object.keys(file.meta).length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-2 overflow-hidden border-b border-neutral-900 pb-4 sm:grid-cols-4">
            {Object.keys(file.meta).map((k) => {
              const value = (file.meta as any)[k];
              let comp = undefined;
              if (typeof value === 'string') {
                comp = value;
              } else {
                comp = JSON.stringify(value);
              }
              return (
                <Fragment key={`meta-${k}`}>
                  <p className="text-sm text-neutral-500">{k}</p>
                  <p className="text-sm text-neutral-300 sm:col-span-3">
                    {comp}
                  </p>
                </Fragment>
              );
            })}
          </div>
        )}
      <div className="mt-8">
        <MarkdownContainer markdown={markdownContent} />
      </div>
    </div>
  );
};
