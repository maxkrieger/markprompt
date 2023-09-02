import { AlgoliaProvider } from '@markprompt/core/dist/search';
import * as Select from '@radix-ui/react-select';
import { ChevronDown, ChevronUp, ExternalLinkIcon, Info } from 'lucide-react';
import Link from 'next/link';
import { ChangeEvent, FC } from 'react';

import { useConfigContext } from '@/lib/context/config';
import { safeParseJSON } from '@/lib/utils.edge';

import { Row } from './PlaygroundDashboard';
import Input from '../ui/Input';
import { SelectItem } from '../ui/Select';
import { NoAutoTextArea } from '../ui/TextArea';

interface SearchProviderConfigProps {
  className?: string;
}

export const SearchProviderConfig: FC<SearchProviderConfigProps> = () => {
  const { markpromptOptions, setMarkpromptOptions } = useConfigContext();

  return (
    <>
      <Row label="Provider" indented collapseMargin>
        <Select.Root
          value={
            markpromptOptions.search?.provider?.name === 'algolia'
              ? 'algolia'
              : 'markprompt'
          }
          onValueChange={(value) => {
            if (value === 'algolia') {
              setMarkpromptOptions({
                ...markpromptOptions,
                search: {
                  ...markpromptOptions.search,
                  provider: {
                    name: 'algolia',
                    apiKey: '',
                    appId: '',
                    indexName: '',
                  },
                },
              });
            } else {
              setMarkpromptOptions({
                ...markpromptOptions,
                search: {
                  ...markpromptOptions.search,
                  provider: undefined,
                },
              });
            }
          }}
        >
          <Select.Trigger
            className="button-ring flex w-full flex-row items-center gap-2 rounded-md border border-neutral-900 py-1.5 px-3 text-sm text-neutral-300 outline-none"
            aria-label="Theme"
          >
            <div className="flex-grow truncate whitespace-nowrap text-left">
              <Select.Value placeholder="Pick a theme…" />
            </div>
            <Select.Icon className="flex-none text-neutral-500">
              <ChevronDown className="h-4 w-4" />
            </Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content className="z-30 overflow-hidden rounded-md border border-neutral-800 bg-neutral-900">
              <Select.ScrollUpButton className="flex h-10 items-center justify-center">
                <ChevronUp className="h-4 w-4" />
              </Select.ScrollUpButton>
              <Select.Viewport>
                <Select.Group>
                  <SelectItem value="markprompt">
                    <div className="flex flex-row items-center gap-2">
                      Markprompt
                    </div>
                  </SelectItem>
                  <SelectItem value="algolia">Algolia</SelectItem>
                </Select.Group>
              </Select.Viewport>
              <Select.ScrollDownButton className="flex items-center justify-center p-2">
                <ChevronDown className="h-4 w-4" />
              </Select.ScrollDownButton>
            </Select.Content>
          </Select.Portal>{' '}
        </Select.Root>
      </Row>
      {markpromptOptions.search?.provider?.name !== 'algolia' && (
        <>
          <Row label="Link mapping" indented collapseMargin>
            <div className="flex flex-row items-center justify-end gap-2">
              <Link
                className="subtle-underline text-xs text-neutral-300"
                href="/docs#link-mapping"
                target="_blank"
                rel="noreferrer"
              >
                Setup
              </Link>
              <ExternalLinkIcon className="h-3 w-3 text-neutral-500" />
            </div>
          </Row>
          <Row fullWidth>
            <div className="mt-2 flex w-full flex-col">
              <p className="rounded border border-dashed border-orange-900/50 bg-orange-900/20 p-3 text-xs text-orange-400">
                The Markprompt search provider is experimental. Retraining with
                the &ldquo;force retrain&rdquo; option may be required to make
                your content available for search.
              </p>
            </div>
          </Row>
        </>
      )}

      {markpromptOptions.search?.provider?.name === 'algolia' && (
        <>
          <Row label="API key" indented collapseMargin>
            <Input
              inputSize="sm"
              value={markpromptOptions.search?.provider?.apiKey || ''}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setMarkpromptOptions({
                  ...markpromptOptions,
                  search: {
                    ...markpromptOptions.search,
                    provider: {
                      ...(markpromptOptions.search
                        ?.provider as AlgoliaProvider),
                      apiKey: event.target.value,
                    },
                  },
                });
              }}
            />
          </Row>
          <Row label="App ID" indented collapseMargin>
            <Input
              inputSize="sm"
              value={markpromptOptions.search?.provider?.appId || ''}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setMarkpromptOptions({
                  ...markpromptOptions,
                  search: {
                    ...markpromptOptions.search,
                    provider: {
                      ...(markpromptOptions.search
                        ?.provider as AlgoliaProvider),
                      appId: event.target.value,
                    },
                  },
                });
              }}
            />
          </Row>
          <Row label="Index name" indented collapseMargin>
            <Input
              inputSize="sm"
              value={markpromptOptions.search?.provider?.indexName || ''}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setMarkpromptOptions({
                  ...markpromptOptions,
                  search: {
                    ...markpromptOptions.search,
                    provider: {
                      ...(markpromptOptions.search
                        ?.provider as AlgoliaProvider),
                      indexName: event.target.value,
                    },
                  },
                });
              }}
            />
          </Row>
          <Row label="Search parameters" top indented collapseMargin></Row>
          <Row fullWidth indented collapseMargin>
            <div className="flex w-full flex-col">
              <NoAutoTextArea
                value={
                  markpromptOptions.search?.provider?.searchParameters
                    ? JSON.stringify(
                        markpromptOptions.search.provider.searchParameters,
                        null,
                        2,
                      )
                    : ''
                }
                className="min-h-[100px] w-full font-mono text-xs"
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  const searchParameters = safeParseJSON(
                    event.target.value,
                    undefined,
                  );
                  setMarkpromptOptions({
                    ...markpromptOptions,
                    search: {
                      ...markpromptOptions.search,
                      provider: {
                        ...(markpromptOptions.search
                          ?.provider as AlgoliaProvider),
                        searchParameters,
                      },
                    },
                  });
                }}
              />
              <a
                href="https://www.algolia.com/doc/api-reference/search-api-parameters/"
                target="_blank"
                rel="noreferrer"
                className="button-ring mt-4 mb-4 flex w-min cursor-pointer flex-row items-center gap-2 truncate whitespace-nowrap rounded-md text-xs text-neutral-300"
              >
                <Info className="h-4 w-4 text-neutral-300" />
                <span className="subtle-underline">
                  Learn more about Algolia search parameters
                </span>
              </a>
            </div>
          </Row>
        </>
      )}
    </>
  );
};
