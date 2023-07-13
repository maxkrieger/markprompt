// import { Markprompt } from '@markprompt/react';
import * as Popover from '@radix-ui/react-popover';
import { FC, ReactNode, useState } from 'react';

import '@markprompt/css';
import { getApiUrl } from '@/lib/utils.edge';

type DocsPromptProps = {
  children: ReactNode;
  onOpenChange?: (open: boolean) => void;
};

export const DocsPrompt: FC<DocsPromptProps> = ({ children, onOpenChange }) => {
  const [promptOpen, setPromptOpen] = useState(false);

  return (
    <Popover.Root
      open={promptOpen}
      onOpenChange={(open) => {
        setPromptOpen(open);
        onOpenChange?.(open);
      }}
    >
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="animate-chat-window z-30 mr-4 mb-4 w-[calc(100vw-32px)] sm:w-full">
          <div className="relative mt-4 h-[calc(100vh-240px)] max-h-[560px] w-full overflow-hidden rounded-lg border border-neutral-800 bg-neutral-1000 text-sm shadow-2xl sm:w-[400px]">
            <style jsx global>
              {`
                :root {
                  --markprompt-background: #050505;
                  --markprompt-foreground: #d4d4d4;
                  --markprompt-muted: #171717;
                  --markprompt-mutedForeground: #737373;
                  --markprompt-border: #262626;
                  --markprompt-input: #fff;
                  --markprompt-primary: #0ea5e9;
                  --markprompt-primaryForeground: #fff;
                  --markprompt-primaryMuted: #38bdf8;
                  --markprompt-secondary: #0e0e0e;
                  --markprompt-secondaryForeground: #fff;
                  --markprompt-primaryHighlight: #ec4899;
                  --markprompt-secondaryHighlight: #a855f7;
                  --markprompt-overlay: #00000040;
                  --markprompt-ring: #fff;
                  --markprompt-radius: 5px;
                }

                input {
                  background-color: transparent;
                }

                .MarkpromptPrompt {
                  background-color: transparent;
                }
              `}
            </style>
            {/* <Markprompt
              display="plain"
              showBranding={false}
              close={{
                visible: false,
              }}
              projectKey={
                (process.env.NODE_ENV === 'production'
                  ? process.env.NEXT_PUBLIC_MARKPROMPT_WEBSITE_DOCS_PROJECT_KEY
                  : process.env
                      .NEXT_PUBLIC_MARKPROMPT_WEBSITE_DOCS_PROJECT_KEY_TEST) ||
                ''
              }
              prompt={{
                apiUrl: getApiUrl('completions', false),
                model: 'gpt-4',
                placeholder: 'Ask Docs AI',
                cta: 'Ask Docs AI',
              }}
              // search={{
              //   enabled: true,
              //   searchUrl: getApiUrl('search', false),
              //   getHref: (path, sectionHeading, source) => {
              //     console.log('path', path, sectionHeading, source);
              //     return '';
              //   },
              // }}
            /> */}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
