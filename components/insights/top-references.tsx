import { FC, useMemo } from 'react';

import emitter, { EVENT_OPEN_PLAN_PICKER_DIALOG } from '@/lib/events';
import { getIconForSource } from '@/lib/utils';
import { ReferenceWithOccurrenceCount } from '@/types/types';

import { SkeletonTable } from '../ui/Skeletons';

interface TopReferencesProps {
  topReferences: ReferenceWithOccurrenceCount[] | null;
  loading?: boolean;
  showUpgradeMessage?: boolean;
}

export const TopReferences: FC<TopReferencesProps> = ({
  topReferences,
  loading,
  showUpgradeMessage,
}) => {
  const minMaxOccurrences = useMemo(() => {
    if (!topReferences) {
      return { min: 0, max: 0 };
    }
    const occurences = topReferences.map((r) => r.occurrences);
    return {
      min: Math.max(0, Math.min(...occurences)),
      max: Math.max(0, Math.max(...occurences)),
    };
  }, [topReferences]);

  return (
    <div className="hidden-scrollbar relative flex max-h-[500px] min-h-[200px] flex-col gap-2 overflow-y-auto">
      <SkeletonTable onDark loading={loading} />
      {topReferences?.map((r, i) => {
        const Icon = getIconForSource(r.source_type);
        return (
          <div key={`top-reference-${i}-${r.path}`} className="relative">
            <div className="relative z-10 flex flex-row items-center gap-3 px-2 py-1 text-sm text-neutral-300">
              <Icon className="h-4 w-4 flex-none text-neutral-500" />
              <span className="flex-grow truncate">{r.path}</span>
              <span className="flex-none font-semibold">
                {r.occurrences || 0}
              </span>
            </div>
            <div
              className="absolute left-0 top-0 bottom-0 z-0 rounded-md bg-neutral-900"
              style={{
                width:
                  minMaxOccurrences.max > 0
                    ? `${(100 * r.occurrences) / minMaxOccurrences.max}%`
                    : 0,
              }}
            />
          </div>
        );
      })}
      {showUpgradeMessage && (
        <p className="mt-4 text-xs text-neutral-500">
          See all cited references by{' '}
          <a
            className="subtle-underline cursor-pointer"
            onClick={() => {
              emitter.emit(EVENT_OPEN_PLAN_PICKER_DIALOG);
            }}
          >
            upgrading to Pro
          </a>
          .
        </p>
      )}
    </div>
  );
};
