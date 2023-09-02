import cn from 'classnames';
import { FC } from 'react';

interface SkeletonProps {
  loading?: boolean;
  onDark?: boolean;
}

export const SkeletonTable: FC<SkeletonProps> = ({ loading, onDark }) => {
  return (
    <div
      className={cn('pointer-events-none absolute inset-0 z-0 transition', {
        'opacity-0': !loading,
        'bg-neutral-1100': onDark,
      })}
    >
      <div className="flex flex-col gap-3">
        <div className="loading-skeleton h-7 w-full rounded-md bg-neutral-800" />
        <div className="loading-skeleton h-7 w-full rounded-md bg-neutral-800" />
        <div className="loading-skeleton h-7 w-full rounded-md bg-neutral-800" />
      </div>
    </div>
  );
};

export const SkeletonPanel: FC<SkeletonProps> = ({ loading, onDark }) => {
  return (
    <div
      className={cn('pointer-events-none absolute inset-0 z-0 transition', {
        'opacity-0': !loading,
        'bg-neutral-1100': onDark,
      })}
    >
      <div className="loading-skeleton h-full w-full rounded-md bg-neutral-800" />
    </div>
  );
};
