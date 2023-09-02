import cn from 'classnames';
import { FC, ReactNode } from 'react';

import { SharedHead } from '../pages/SharedHead';
import Button from '../ui/Button';

interface PreviewWrapperProps {
  title: string;
  width?: 'xs' | 'sm';
  sending: boolean;
  includeEmailHeader?: boolean;
  onSendClick: () => void;
  InfoPanel?: ReactNode;
  children: ReactNode;
}

// We create the email component as a standalone component, instead of
// creating it in the page itself, to avoid hydration errors (we
// import the component dynamically with SSR = false).
export const PreviewWrapper: FC<PreviewWrapperProps> = ({
  title,
  width = 'xs',
  sending,
  includeEmailHeader,
  onSendClick,
  InfoPanel,
  children,
}) => {
  return (
    <>
      <SharedHead title={title} />
      <div className="relative flex min-h-screen w-full justify-center overflow-y-auto px-8 pt-8 pb-[200px]">
        <div className="fixed inset-0 z-0 bg-neutral-900" />
        <div className="z-10 w-full max-w-screen-lg overflow-hidden rounded-md bg-neutral-900 px-20 py-8 shadow-xl">
          <div
            className={cn(
              'mx-auto rounded-md border-neutral-200 bg-white p-8 text-neutral-900',
              {
                'max-w-[480px]': width === 'xs',
                'max-w-screen-md': width === 'sm',
              },
            )}
          >
            {includeEmailHeader && (
              <div className="mb-9 flex flex-row gap-2 text-sm">
                <span className="flex-none text-neutral-500">From:</span>
                <span className="flex-grow font-medium">
                  markprompt@weeklyupdate.markprompt.com
                </span>
                <span className="flex-none text-neutral-500">4:20 PM</span>
              </div>
            )}
            {children}
          </div>
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-end border-t border-neutral-100 bg-white px-8 py-6 text-neutral-900 shadow-2xl">
        {InfoPanel}
        <div className="flex-grow" />
        <Button
          className="flex-none"
          variant="plain"
          loading={sending}
          onClick={onSendClick}
        >
          Send
        </Button>
      </div>
    </>
  );
};
