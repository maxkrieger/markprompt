import * as Dialog from '@radix-ui/react-dialog';
import * as Switch from '@radix-ui/react-switch';
import * as Tabs from '@radix-ui/react-tabs';
import { diff } from 'deep-object-diff';
import indentString from 'indent-string';
import { stringify } from 'json5';
import { Book } from 'lucide-react';
import LZString from 'lz-string';
import Link from 'next/link';
import { ReactNode, useState } from 'react';

import Button from '@/components/ui/Button';
import { CodePanel } from '@/components/ui/Code';
import { Note } from '@/components/ui/Note';
import { MARKPROMPT_JS_PACKAGE_VERSIONS } from '@/lib/constants';
import {
  DEFAULT_MARKPROMPT_OPTIONS_GPT4,
  useConfigContext,
} from '@/lib/context/config';
import useProject from '@/lib/hooks/use-project';
import useTeam from '@/lib/hooks/use-team';
import {
  defaultTheme,
  Theme,
  ThemeColorKeys,
  ThemeColors,
  ThemeDimensionKeys,
  ThemeDimensions,
} from '@/lib/themes';
import { pruneEmpty, propsObjectToJSXPropsString } from '@/lib/utils.browser';
import { getAppOrigin } from '@/lib/utils.edge';
import { Project, SerializableMarkpromptOptions, DbTeam } from '@/types/types';

import { getRootTextSize } from './prose';

export const KeyNote = ({
  className,
}: {
  className?: string;
  projectKey?: string;
  textKey?: string;
}) => {
  return (
    <Note className={className} size="sm" type="warning">
      The code is diplayed with your project key, and needs to be run from a
      whitelisted domain. If you wish to test your code on a non-whitelisted
      domain, such as localhost, use the test key instead. Do not share the test
      key publicly.
    </Note>
  );
};

// Builds the shortest version of the options to pass to a
// markprompt-js function/component. It only includes values
// that are different from the default options, and removes extraneous
// options, such as search provider options if search is not enabled.
const getCodeOptionsToDisplay = (
  markpromptOptions: SerializableMarkpromptOptions,
) => {
  let diffOptions = pruneEmpty(
    diff(DEFAULT_MARKPROMPT_OPTIONS_GPT4, markpromptOptions),
  ) as Partial<SerializableMarkpromptOptions>;
  if (!diffOptions.search?.enabled) {
    // If search is disabled, we still keep the search provider options
    // in store so that they are not reset if accidentally search is disabled,
    // yet we don't want the provider options to be in the code snippets if
    // search is disabled.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { search, ...rest } = diffOptions;
    diffOptions = rest;
  }
  return diffOptions;
};

const getDiffTheme = (theme: Theme) => {
  return diff(defaultTheme, theme);
};

const getThemeCSS = (theme: Partial<Theme>) => {
  const lightColors = (theme.colors?.light || {}) as Partial<ThemeColors>;
  const darkColors = (theme.colors?.dark || {}) as Partial<ThemeColors>;
  const dimensions = (theme.dimensions || {}) as Partial<ThemeDimensions>;
  const lightColorKeys = Object.keys(lightColors) as ThemeColorKeys[];
  const darkColorKeys = Object.keys(darkColors) as ThemeColorKeys[];
  const dimensionKeys = Object.keys(dimensions) as ThemeDimensionKeys[];
  const rootTextSize = theme.size ? getRootTextSize(theme.size) : undefined;

  let rootCSS = '';
  const lightColorVars = lightColorKeys.map(
    (key) => `--markprompt-${key}: ${lightColors[key]};`,
  );
  const darkColorVars = darkColorKeys.map(
    (key) => `--markprompt-${key}: ${darkColors[key]};`,
  );
  const dimensionVars = dimensionKeys.map(
    (key) => `--markprompt-${key}: ${dimensions[key]};`,
  );

  if (lightColorVars.length > 0) {
    rootCSS += lightColorVars.join('\n') + '\n';
  }
  if (dimensionVars.length > 0) {
    rootCSS += dimensionVars.join('\n') + '\n';
  }
  if (rootTextSize) {
    rootCSS += `--markprompt-text-size: ${rootTextSize};` + '\n';
  }
  rootCSS = rootCSS.trim();

  let fullCSS = '';
  if (rootCSS.length > 0) {
    fullCSS = `:root {
${indentString(rootCSS, 2)}
}\n\n`;
  }

  if (darkColorVars.length > 0) {
    fullCSS += `@media (prefers-color-scheme: dark) {
  :root {
${indentString(darkColorVars.join('\n'), 4)}
  }
}`;
  }

  return fullCSS.trim();
};

const reactCode = (
  projectKey: string,
  isTestKey: boolean,
  markpromptOptions: SerializableMarkpromptOptions,
) => {
  const codeOptionsToDisplay = getCodeOptionsToDisplay(markpromptOptions);

  let propsStringFormatted = '';
  const propsString = propsObjectToJSXPropsString(codeOptionsToDisplay);
  if (propsString) {
    propsStringFormatted = '\n' + indentString(propsString, 6);
  }

  return `import '@markprompt/css';
import { Markprompt } from '@markprompt/react';

export function Component() {
  return <Markprompt
      projectKey="${projectKey}"${propsStringFormatted}
    />;
}`;
};

const vanillaCode = (
  projectKey: string,
  containerId: string,
  markpromptOptions: SerializableMarkpromptOptions,
) => {
  const codeOptionsToDisplay = getCodeOptionsToDisplay(markpromptOptions);
  return `import '@markprompt/css';
import { markprompt } from '@markprompt/web';

markprompt(
  '${projectKey}',
  '${containerId}',
${indentString(stringify(codeOptionsToDisplay, null, 2), 2)}
);`;
};

const scriptTagCode = (
  projectKey: string,
  containerId: string,
  markpromptOptions: SerializableMarkpromptOptions,
  themeCSS: string,
) => {
  const codeOptionsToDisplay = {
    projectKey: projectKey,
    container: `#${containerId}`,
    ...getCodeOptionsToDisplay(markpromptOptions),
  };

  let styleBlock = '';
  if (themeCSS?.length > 0) {
    styleBlock = `\n<!-- Custom style -->
<style>
${indentString(themeCSS, 2)}
</style>\n`;
  }

  return `<link rel="stylesheet" href="https://unpkg.com/@markprompt/css@${
    MARKPROMPT_JS_PACKAGE_VERSIONS.css
  }/markprompt.css" />
<script>
  window.markprompt = ${indentString(
    stringify(codeOptionsToDisplay, null, 2),
    4,
  ).trim()}
</script>
<script async src="https://unpkg.com/@markprompt/web@${
    MARKPROMPT_JS_PACKAGE_VERSIONS.web
  }/dist/init.js"></script>

<!-- Container for the Markprompt trigger button -->
<div id="${containerId}" />
${styleBlock}`;
};

const embedCode = (
  projectKey: string,
  markpromptOptions: SerializableMarkpromptOptions,
  themeCSS: string,
) => {
  const props = {
    projectKey: projectKey,
    markpromptOptions: getCodeOptionsToDisplay(markpromptOptions),
    themeCSS,
  };

  // We use LZString to compress, rather than e.g. pako, as LZString
  // can run on the edge runtime (does not use Buffer), where we need
  // it to serve the page at the /embed endpoint.
  // eslint-disable-next-line import/no-named-as-default-member
  const path = LZString.compressToEncodedURIComponent(JSON.stringify(props));

  return `<iframe
  width="100%"
  height="100%"
  title="Markprompt"
  frameborder="0"
  src="${getAppOrigin()}/embed/${path}">
</iframe>`;
};

const docusaurusCode = (
  projectKey: string,
  markpromptOptions: SerializableMarkpromptOptions,
) => {
  const diffOptions = {
    projectKey: projectKey,
    ...getCodeOptionsToDisplay(markpromptOptions),
  };

  return `const config = {
  themes: [
    '@markprompt/docusaurus-theme-search',
  ],
  themeConfig: {
    markprompt: ${indentString(stringify(diffOptions, null, 2), 4).trim()},
  },
};`;
};

const getDescription = (
  teamSlug: string,
  projectSlug: string,
  isTestMode: boolean,
  isOnboarding: boolean,
) => {
  if (isTestMode) {
    return (
      <>
        Showing code with your <strong>test</strong> key, which can be used for
        non-public sites, for instance for developing on localhost. Do not share
        code with a test key publicly. For public sites, use a production key
        from a whitelisted domain.
      </>
    );
  } else {
    return (
      <>
        Showing code with your <strong>production</strong> key. Production keys
        can only be used when called from a whitelisted domain. You can add
        whitelisted domains in the{' '}
        {!isOnboarding ? (
          <Link
            className="subtle-underline"
            href={`/${teamSlug}/${projectSlug}/settings`}
          >
            project settings
          </Link>
        ) : (
          <>project settings</>
        )}
        . For local development, use a test key (toggle &ldquo;Test mode&rdquo;
        above).
      </>
    );
  }
};

export const TestKeyNote = ({
  team,
  project,
  testMode,
  isOnboarding,
  className,
}: {
  team: DbTeam;
  project: Project;
  testMode: boolean;
  isOnboarding: boolean;
  className: string;
}) => {
  return (
    <Note type="warning" size="sm" className={className}>
      {getDescription(team.slug, project.slug, testMode, isOnboarding)}
    </Note>
  );
};

const GetCode = ({
  isOnboarding,
  children,
}: {
  isOnboarding: boolean;
  children: ReactNode;
}) => {
  const { team } = useTeam();
  const { project } = useProject();
  const { markpromptOptions, theme } = useConfigContext();
  const [testMode, setTestMode] = useState(false);
  const [codeDialogOpen, setCodeDialogOpen] = useState(false);

  if (!team || !project) {
    return <></>;
  }

  const apiKey = testMode
    ? project.private_dev_api_key
    : project.public_api_key;

  const diffTheme: Partial<Theme> = getDiffTheme(theme);
  const themeCSS = getThemeCSS(diffTheme);

  return (
    <Dialog.Root open={codeDialogOpen} onOpenChange={setCodeDialogOpen}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="animate-overlay-appear dialog-overlay" />
        <Dialog.Content className="animate-dialog-slide-in dialog-content flex h-[90%] max-h-[800px] w-[90%] max-w-[700px] flex-col">
          <Dialog.Title className="dialog-title-xl flex flex-none flex-row items-center gap-4">
            <div className="flex-grow truncate">Copy code</div>
            <Button
              variant="plain"
              buttonSize="sm"
              target="_blank"
              href="/docs"
              Icon={Book}
            >
              Docs
            </Button>
            <div className="flex flex-none flex-row items-center gap-2">
              <label
                className="flex-grow truncate text-sm font-normal text-neutral-500"
                htmlFor="product-updates"
              >
                Test mode
              </label>
              <Switch.Root
                className="switch-root"
                id="test-mode"
                checked={testMode}
                onCheckedChange={setTestMode}
              >
                <Switch.Thumb className="switch-thumb" />
              </Switch.Root>
            </div>
          </Dialog.Title>
          <Dialog.Description className="dialog-description-xl mt-2 flex-none border-b border-neutral-900 pb-4">
            Use the code below in your HTML pages or web application.
          </Dialog.Description>
          <div className="flex h-full w-full flex-grow p-6">
            <Tabs.Root className="tabs-root" defaultValue="react">
              <Tabs.List className="tabs-list" aria-label="Get code">
                <Tabs.Trigger className="tabs-trigger" value="react">
                  React
                </Tabs.Trigger>
                <Tabs.Trigger className="tabs-trigger" value="vanilla">
                  Vanilla JS
                </Tabs.Trigger>
                <Tabs.Trigger className="tabs-trigger" value="docusaurus">
                  Docusaurus
                </Tabs.Trigger>
                <Tabs.Trigger className="tabs-trigger" value="scriptTag">
                  Script tag
                </Tabs.Trigger>
                <Tabs.Trigger className="tabs-trigger" value="embed">
                  Embed
                </Tabs.Trigger>
              </Tabs.List>
              <Tabs.Content
                className="tabs-content relative w-full max-w-full flex-grow"
                value="react"
              >
                <div className="prose prose-invert absolute inset-x-0 top-4 bottom-0 w-full max-w-full overflow-y-auto py-4">
                  <h3>Installation</h3>
                  <CodePanel
                    className="w-full"
                    language="bash"
                    code="npm install @markprompt/react @markprompt/css react"
                  />
                  <h3>Usage</h3>
                  <TestKeyNote
                    className="mb-4"
                    team={team}
                    project={project}
                    testMode={testMode}
                    isOnboarding={isOnboarding}
                  />
                  <CodePanel
                    language="jsx"
                    code={reactCode(apiKey, testMode, markpromptOptions)}
                    noPreWrap
                  />
                  <Note type="info" size="sm" className="mt-4">
                    The Markprompt React component also comes as a headless
                    component, for full customization options.{' '}
                    <a
                      target="_blank"
                      rel="noreferrer"
                      className="subtle-underline"
                      href="https://github.com/motifland/markprompt-js/tree/main/packages/react#api"
                    >
                      Read more
                    </a>{' '}
                    →
                  </Note>
                  {themeCSS && (
                    <>
                      <h4>CSS</h4>
                      <p className="text-sm text-neutral-300">
                        In CSS, add the following custom variables.
                      </p>
                      <CodePanel
                        className="w-full"
                        language="css"
                        code={themeCSS}
                      />
                    </>
                  )}
                </div>
              </Tabs.Content>
              <Tabs.Content
                className="tabs-content relative w-full max-w-full flex-grow"
                value="vanilla"
              >
                <div className="prose prose-invert absolute inset-x-0 top-4 bottom-0 w-full max-w-full overflow-y-auto py-4">
                  <h3>Installation</h3>
                  <CodePanel
                    className="w-full"
                    language="markup"
                    code="npm install @markprompt/web @markprompt/css"
                  />
                  <h3>Usage</h3>
                  <TestKeyNote
                    className="mb-4"
                    team={team}
                    project={project}
                    testMode={testMode}
                    isOnboarding={isOnboarding}
                  />
                  <h4>HTML</h4>
                  <p className="text-sm text-neutral-300">
                    Place a container with id <code>markprompt</code> in your
                    page.
                  </p>
                  <CodePanel
                    className="w-full"
                    language="javascript"
                    code={`<div id="markprompt" />`}
                  />
                  <h4>JavaScript</h4>
                  <p className="text-sm text-neutral-300">
                    In JavaScript, call the code below, which will attach the
                    interactive prompt to the <code>markprompt</code> container.
                  </p>
                  <CodePanel
                    className="w-full"
                    language="javascript"
                    code={vanillaCode(apiKey, 'markprompt', markpromptOptions)}
                  />
                  {themeCSS && (
                    <>
                      <h4>CSS</h4>
                      <p className="text-sm text-neutral-300">
                        In CSS, add the following custom variables.
                      </p>
                      <CodePanel
                        className="w-full"
                        language="css"
                        code={themeCSS}
                      />
                    </>
                  )}
                </div>
              </Tabs.Content>
              <Tabs.Content
                className="tabs-content relative w-full max-w-full flex-grow"
                value="docusaurus"
              >
                <div className="prose prose-invert absolute inset-x-0 top-4 bottom-0 w-full max-w-full overflow-y-auto py-4">
                  <h3>Installation</h3>
                  <CodePanel
                    className="w-full"
                    language="markup"
                    code="npm install @markprompt/docusaurus-theme-search"
                  />
                  <h3>Usage</h3>
                  <TestKeyNote
                    className="mb-4"
                    team={team}
                    project={project}
                    testMode={testMode}
                    isOnboarding={isOnboarding}
                  />
                  <h4>Configuration</h4>
                  <p className="text-sm text-neutral-300">
                    In your <code>docusaurus.config.js</code>, add{' '}
                    <code>@markprompt/docusaurus-theme-search</code> to themes.
                    Configure <code>markprompt</code> in the{' '}
                    <code>themeConfig</code>.
                  </p>
                  <CodePanel
                    className="w-full"
                    language="javascript"
                    code={docusaurusCode(apiKey, markpromptOptions)}
                  />
                  <Note type="info" size="sm" className="mt-4">
                    <p className="pb-2">
                      If your Docusaurus project already has a search plugin,
                      such as <code>theme-search-algolia</code>, you need to
                      swizzle the current search plugin, and add Markprompt as a
                      standalone component.{' '}
                      <a
                        target="_blank"
                        rel="noreferrer"
                        className="subtle-underline"
                        href="https://github.com/motifland/markprompt-js/tree/main/packages/docusaurus-theme-search#usage-with-another-search-plugin"
                      >
                        Read more
                      </a>{' '}
                      →
                    </p>
                    <p>
                      Alternatively, you can use Algolia directly in the
                      Markprompt component, by toggling on &ldquo;Instant
                      search&rdquo; and selecting Algolia as provider.
                    </p>
                  </Note>
                  {themeCSS && (
                    <>
                      <h4>CSS</h4>
                      <p className="text-sm text-neutral-300">
                        In CSS, add the following custom variables.
                      </p>
                      <CodePanel
                        className="w-full"
                        language="css"
                        code={themeCSS}
                      />
                    </>
                  )}
                </div>
              </Tabs.Content>
              <Tabs.Content
                className="tabs-content relative w-full max-w-full flex-grow"
                value="scriptTag"
              >
                <div className="prose prose-invert absolute inset-x-0 top-4 bottom-0 w-full max-w-full overflow-y-auto py-4">
                  <h3>Usage</h3>
                  <p className="text-sm text-neutral-300">
                    Copy the code below to your HTML pages.
                  </p>
                  <TestKeyNote
                    className="mb-4"
                    team={team}
                    project={project}
                    testMode={testMode}
                    isOnboarding={isOnboarding}
                  />
                  <CodePanel
                    className="w-full"
                    language="markup"
                    code={scriptTagCode(
                      apiKey,
                      'markprompt',
                      markpromptOptions,
                      themeCSS,
                    )}
                  />
                </div>
              </Tabs.Content>
              <Tabs.Content
                className="tabs-content relative w-full max-w-full flex-grow"
                value="embed"
              >
                <div className="prose prose-invert absolute inset-x-0 top-4 bottom-0 w-full max-w-full overflow-y-auto py-4">
                  <h3>Usage</h3>
                  <p className="text-sm text-neutral-300">
                    Copy the code below to your HTML pages.
                  </p>
                  <TestKeyNote
                    className="mb-4"
                    team={team}
                    project={project}
                    testMode={testMode}
                    isOnboarding={isOnboarding}
                  />
                  <CodePanel
                    className="w-full"
                    language="markup"
                    code={embedCode(apiKey, markpromptOptions, themeCSS)}
                  />
                </div>
              </Tabs.Content>
            </Tabs.Root>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default GetCode;
