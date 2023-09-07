import * as Dialog from '@radix-ui/react-dialog';
import * as Popover from '@radix-ui/react-popover';
import * as Switch from '@radix-ui/react-switch';
import cn from 'classnames';
import { motion } from 'framer-motion';
import {
  Upload,
  Globe,
  X,
  Code,
  Stars,
  Share as ShareIcon,
  SettingsIcon,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  FC,
  JSXElementConstructor,
  ReactNode,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'react-hot-toast';
import colors from 'tailwindcss/colors';

import { addSource } from '@/lib/api';
import { SAMPLE_REPO_URL } from '@/lib/constants';
import { useAppContext } from '@/lib/context/app';
import { useConfigContext } from '@/lib/context/config';
import { useTrainingContext } from '@/lib/context/training';
import emitter, { EVENT_OPEN_CONTACT } from '@/lib/events';
import useFiles from '@/lib/hooks/use-files';
import useOnboarding from '@/lib/hooks/use-onboarding';
import useProject from '@/lib/hooks/use-project';
import useSources from '@/lib/hooks/use-sources';
import useTeam from '@/lib/hooks/use-team';
import useUsage from '@/lib/hooks/use-usage';
import {
  getAccessoryLabelForSource,
  getIconForSource,
  getLabelForSource,
} from '@/lib/utils';
import { getApiUrl } from '@/lib/utils.edge';
import { DbSource, SourceType } from '@/types/types';

import { UpgradeNote } from './UpgradeNote';
import { GitHubIcon } from '../icons/GitHub';
import { MotifIcon } from '../icons/Motif';
import { SpinnerIcon } from '../icons/Spinner';
import Button from '../ui/Button';
import { InfoTooltip } from '../ui/InfoTooltip';
import { PulseDot } from '../ui/PulseDot';

const Loading = <p className="p-4 text-sm text-neutral-500">Loading...</p>;

const StatusMessage = dynamic(() => import('./StatusMessage'), {
  loading: () => Loading,
});

const Share = dynamic(() => import('../dialogs/project/Share'), {
  loading: () => Loading,
});

const GetCode = dynamic(() => import('../dialogs/project/GetCode'), {
  loading: () => Loading,
});

const UIConfigurator = dynamic(() => import('../files/UIConfigurator'), {
  loading: () => Loading,
});

const ModelConfigurator = dynamic(() => import('../files/ModelConfigurator'), {
  loading: () => Loading,
});

const RemoveSourceDialog = dynamic(
  () => import('@/components/dialogs/sources/RemoveSource'),
  { loading: () => Loading },
);

const WebsiteAddSourceDialog = dynamic(
  () => import('@/components/dialogs/sources/Website'),
  { loading: () => Loading },
);

const GitHubAddSourceDialog = dynamic(
  () => import('@/components/dialogs/sources/GitHub'),
  { loading: () => Loading },
);

const MotifAddSourceDialog = dynamic(
  () => import('@/components/dialogs/sources/Motif'),
  { loading: () => Loading },
);

const FilesAddSourceDialog = dynamic(
  () => import('@/components/dialogs/sources/Files'),
  { loading: () => Loading },
);

export const Row = ({
  label,
  tip,
  className,
  indented,
  collapseMargin,
  top,
  fullWidth,
  children,
}: {
  label?: string | ReactNode;
  tip?: string;
  className?: string;
  indented?: boolean;
  collapseMargin?: boolean;
  top?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
}) => {
  return (
    <div
      className={cn(
        className,
        {
          'my-1': !collapseMargin,
          'py-1': collapseMargin,
          'border-l border-neutral-800': indented,
          'items-start': top,
          'items-center': !top,
        },
        'grid grid-cols-2 gap-4',
      )}
    >
      {!fullWidth && (
        <div
          className={cn(
            'flex flex-row items-center gap-2 py-1 text-sm text-neutral-300',
            {
              'pl-3': indented,
            },
          )}
        >
          <span className="truncate">{label}</span>
          {tip && (
            <span className="flex-grow">
              <InfoTooltip message={tip} dimmed />
            </span>
          )}
        </div>
      )}
      {children && (
        <div
          className={cn('flex w-full justify-end', {
            'col-span-2': fullWidth,
            'pl-3': indented && fullWidth,
          })}
        >
          {children}
        </div>
      )}
    </div>
  );
};

type ConnectButtonProps = {
  label: string;
  disabled?: boolean;
  Icon: JSXElementConstructor<any>;
  sample?: boolean;
  onClick?: () => void;
};

const ConnectButton = forwardRef<HTMLButtonElement, ConnectButtonProps>(
  ({ label, Icon, onClick, disabled, ...props }, ref) => {
    return (
      <button
        {...props}
        onClick={onClick}
        ref={ref}
        className={cn(
          'button-ring relative w-full rounded-lg border border-neutral-900 transition hover:bg-neutral-1000',
          {
            'pointer-events-none opacity-50': disabled,
          },
        )}
        disabled={disabled}
      >
        <div className="flex flex-row items-center gap-4 p-4 sm:p-3">
          <Icon className="h-4 w-4 flex-none text-neutral-300" />
          <span className="flex-grow truncate text-left text-sm font-medium leading-tight text-neutral-300">
            {label}
          </span>
        </div>
      </button>
    );
  },
);

type LinesPosition = 'top-left' | 'bottom-left' | 'top' | 'right';

export const LinesContainer = ({
  width,
  height,
  top,
  left,
  position,
  isDark,
  onOverlay,
}: {
  width: number;
  height: number;
  top: number;
  left: number;
  position: LinesPosition;
  isDark?: boolean;
  onOverlay?: boolean;
}) => {
  return (
    <div
      className="absolute inset-0 transition duration-500"
      style={{ top, left, width, height }}
    >
      <Lines
        width={width}
        height={height}
        position={position}
        isDark={!!isDark}
        onOverlay={!!onOverlay}
      />
    </div>
  );
};

export const Lines = ({
  width,
  height,
  position,
  isDark,
  onOverlay,
}: {
  width: number;
  height: number;
  position: LinesPosition;
  isDark: boolean;
  onOverlay?: boolean;
}) => {
  let path;
  if (position === 'top-left') {
    path = `M1 1h${Math.round(width * 0.7)}a4 4 0 014 4v${
      height - 7
    }a4 4 0 004 4h${Math.round(width * 0.3)}`;
  } else if (position === 'bottom-left') {
    path = `M1 ${height}h${Math.round(width * 0.7)}a4 4 0 004-4v${
      -height + 10
    }a4 4 0 014-4h${Math.round(width * 0.3)}`;
  } else if (position === 'top') {
    path = `M1 0v${Math.round(height * 0.7 - 8)}a4 4 0 004 4h${
      width - 10
    }a4 4 0 014 4v${Math.round(height * 0.3)}`;
  } else if (position === 'right') {
    path = `M${width} 1H${Math.round(width * 0.3)}a4 4 0 00-4 4v${
      height - 10
    }a4 4 0 01-4 4H0`;
  }

  // const path1 = `M0 0h${width}v${height}H0z`;

  return (
    <svg viewBox={`0 0 ${width} ${4 * height}`} fill="none">
      <path
        d={path}
        stroke={
          onOverlay ? '#00000060' : isDark ? colors.neutral['800'] : '#00000020'
        }
      />
      <path
        d={path}
        stroke="url(#pulse)"
        strokeLinecap="round"
        strokeWidth="2"
      />
      <defs>
        <motion.linearGradient
          animate={
            position === 'top-left'
              ? {
                  x1: [0, -2 * width],
                  y1: [3 * height, -height],
                  x2: [0, -width],
                  y2: [4 * height, -height],
                }
              : position === 'bottom-left'
              ? {
                  x1: [0, -2 * width],
                  y1: [-2 * height, 2 * height],
                  x2: [0, -width],
                  y2: [-3 * height, 2 * height],
                }
              : position === 'top'
              ? {
                  x1: [0, -2 * width],
                  y1: [3 * height, -height],
                  x2: [0, -width],
                  y2: [4 * height, -height],
                }
              : {
                  x1: [0, 2 * width],
                  y1: [3 * height, -height],
                  x2: [0, width],
                  y2: [4 * height, -height],
                }
          }
          transition={{
            duration: 4,
            repeat: Infinity,
          }}
          id="pulse"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={colors.fuchsia['500']} stopOpacity="0" />
          <stop stopColor={colors.fuchsia['500']} />
          <stop offset="1" stopColor={colors.red['500']} stopOpacity="0" />
        </motion.linearGradient>
      </defs>
    </svg>
  );
};

ConnectButton.displayName = 'ConnectButton';

type PlaygroundDashboardProps = {
  isOnboarding?: boolean;
};

const PlaygroundDashboard: FC<PlaygroundDashboardProps> = ({
  isOnboarding,
}) => {
  const { team } = useTeam();
  const { project } = useProject();
  const {
    paginatedFiles,
    numFiles,
    mutate: mutateFiles,
    loading: loadingFiles,
  } = useFiles();
  const { didCompleteFirstQuery, setDidCompleteFirstQuery } = useAppContext();
  const {
    sources,
    mutate: mutateSources,
    loading: loadingSources,
  } = useSources();
  const { state: trainingState, trainAllSources } = useTrainingContext();
  const { markpromptOptions, theme, isDark } = useConfigContext();
  const { numTokensPerTeamRemainingAllowance, numTokensPerTeamAllowance } =
    useUsage();
  const [overlayDimensions, setOverlayDimensions] = useState({
    previewContainerWidth: 0,
    previewContainerHeight: 0,
    playgroundWidth: 0,
    playgroundHeight: 0,
    playgroundLeft: 0,
    playgroundTop: 0,
    overlayMessageLeft: 0,
    overlayMessageTop: 0,
    overlayMessageWidth: 0,
    overlayMessageHeight: 0,
  });
  const [forceRetrain, setForceRetrain] = useState(false);
  const [isLoadingResponse, setIsLoadingResponse] = useState(false);
  const [isPlaygroundVisible, setPlaygroundVisible] = useState(true);
  const [isPlaygroundLoaded, setPlaygroundLoaded] = useState(false);
  const [sourceToRemove, setSourceToRemove] = useState<DbSource | undefined>(
    undefined,
  );
  // const playgroundRef = useRef<HTMLDivElement>(null);
  const playgroundRef = useRef<HTMLIFrameElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const overlayMessageRef = useRef<HTMLDivElement>(null);
  const { finishOnboarding } = useOnboarding();

  const startTraining = useCallback(async () => {
    let i = 0;
    await trainAllSources(
      forceRetrain,
      () => {
        if (i++ % 10 === 0) {
          // Only mutate every 10 files
          mutateFiles();
        }
      },
      (errorMessage: string) => {
        toast.error(errorMessage);
      },
    );
    mutateFiles();
    toast.success('Done processing sources.');
  }, [trainAllSources, mutateFiles, forceRetrain]);

  const _addSource = useCallback(
    async (sourceType: SourceType, data: any) => {
      if (!project?.id) {
        return;
      }

      try {
        const newSource = await addSource(project.id, sourceType, data);
        await mutateSources([...sources, newSource]);
      } catch (e) {
        console.error(e);
        toast.error(`${e}`);
      }
    },
    [project?.id, mutateSources, sources],
  );

  const hasConnectedSources = sources && sources.length > 0;
  const isTrained = paginatedFiles && paginatedFiles.length > 0;
  const isLoading = loadingSources || loadingFiles;
  const isTraining = trainingState.state !== 'idle';

  const overlayMessage = useMemo(() => {
    if (!project || isLoading || isLoadingResponse) {
      return undefined;
    }
    if (!hasConnectedSources) {
      if (isOnboarding) {
        return 'Start by connecting one or more sources';
      } else {
        return 'Connect one or more sources';
      }
    }
    if (trainingState.state !== 'idle') {
      return 'Processing sources';
    }
    if (!isTrained && hasConnectedSources) {
      return "Great! Now hit 'Process sources'";
    }

    if (isTrained && !didCompleteFirstQuery) {
      return 'Now ask a question';
    }

    if (didCompleteFirstQuery && isOnboarding) {
      return (
        <span>
          <Stars className="mr-1 mt-[-2px] inline-block h-4 w-4 text-amber-400" />
          You are all set! Get the embed code, configure the design and model,
          or{' '}
          <span
            className="border-b border-dotted border-neutral-300 font-medium"
            onClick={() => {
              finishOnboarding();
            }}
          >
            continue to the dashboard
          </span>
        </span>
      );
    }
    return undefined;
  }, [
    hasConnectedSources,
    isOnboarding,
    isTrained,
    project,
    trainingState.state,
    isLoading,
    didCompleteFirstQuery,
    isLoadingResponse,
    finishOnboarding,
  ]);

  const isShowingOnboardingMessages = !!overlayMessage;
  const isShowingLines = isShowingOnboardingMessages && !isTraining;
  const isShowingOverlay =
    project &&
    (isTraining || (!isLoading && (!hasConnectedSources || !isTrained)));
  const canAddMoreContent = numTokensPerTeamRemainingAllowance > 0;

  useEffect(() => {
    if (!isShowingOnboardingMessages) {
      return;
    }

    const observer = new ResizeObserver(() => {
      if (!previewContainerRef.current) {
        return;
      }

      const previewContainerRect =
        previewContainerRef.current?.getBoundingClientRect();
      const previewContainerWidth = Math.round(
        previewContainerRect?.width || 0,
      );
      const previewContainerHeight = Math.round(
        previewContainerRect?.height || 0,
      );

      const playgroundRect = playgroundRef.current?.getBoundingClientRect();

      const playgroundTop =
        (playgroundRect?.top || 0) - (previewContainerRect?.top || 0);
      const playgroundLeft =
        (playgroundRect?.left || 0) - (previewContainerRect?.left || 0);
      const playgroundWidth = playgroundRect?.width || 0;
      const playgroundHeight = playgroundRect?.height || 0;

      const overlayMessageRect =
        overlayMessageRef.current?.getBoundingClientRect();

      const overlayMessageLeft =
        (overlayMessageRect?.left || 0) - (previewContainerRect?.left || 0);
      const overlayMessageTop =
        (overlayMessageRect?.top || 0) - (previewContainerRect?.top || 0);
      const overlayMessageWidth = overlayMessageRect?.width || 0;
      const overlayMessageHeight = overlayMessageRect?.height || 0;

      setOverlayDimensions({
        previewContainerWidth,
        previewContainerHeight,
        playgroundLeft,
        playgroundTop,
        playgroundWidth,
        playgroundHeight,
        overlayMessageLeft,
        overlayMessageTop,
        overlayMessageWidth,
        overlayMessageHeight,
      });
    });

    playgroundRef.current && observer.observe(playgroundRef.current);
    previewContainerRef.current &&
      observer.observe(previewContainerRef.current);
    overlayMessageRef.current && observer.observe(overlayMessageRef.current);

    return () => {
      observer.disconnect();
    };
  }, [isShowingOnboardingMessages]);

  useEffect(() => {
    if (
      !isPlaygroundLoaded ||
      !playgroundRef.current?.contentWindow ||
      !project
    ) {
      return;
    }

    const serializedProps = {
      ...markpromptOptions,
      projectKey: project.private_dev_api_key,
      showBranding: markpromptOptions.showBranding,
      prompt: {
        ...markpromptOptions.prompt,
        apiUrl: getApiUrl('completions', false),
      },
      chat: {
        ...markpromptOptions.chat,
        apiUrl: getApiUrl('chat', false),
      },
      trigger: { floating: true },
      search: {
        ...markpromptOptions.search,
        apiUrl: getApiUrl('search', false),
        getHref: undefined,
      },
      references: {
        ...markpromptOptions.references,
        getHref: undefined,
        getLabel: undefined,
        transformReferenceId: undefined,
      },
    };

    const colors = isDark ? theme.colors.dark : theme.colors.light;
    theme.size;
    playgroundRef.current.contentWindow.postMessage(
      {
        serializedProps,
        colors,
        size: theme.size,
        dimensions: theme.dimensions,
        isDark,
      },
      '*',
    );
  }, [
    paginatedFiles,
    isPlaygroundLoaded,
    project,
    theme,
    isDark,
    markpromptOptions,
  ]);

  return (
    <div className="absolute inset-0 grid grid-cols-1 sm:grid-cols-4">
      <div className="relative h-full">
        <div className="absolute inset-x-0 top-0 bottom-[var(--playground-navbar-height)] overflow-y-auto p-6">
          <h1 className="relative truncate whitespace-nowrap text-xl font-bold text-neutral-300">
            Connect source{' '}
            {!isLoading && (!sources || sources.length === 0) && (
              <PulseDot className="translate-x-[-4px] translate-y-[-8px] transform" />
            )}
          </h1>
          <p className="mt-2 text-sm font-normal text-neutral-500">
            Missing a source?{' '}
            <span
              className="subtle-underline cursor-pointer"
              onClick={() => {
                emitter.emit(EVENT_OPEN_CONTACT);
              }}
            >
              Let us know
            </span>
            .
          </p>
          {!loadingFiles && !canAddMoreContent && (
            <UpgradeNote className="my-4" showDialog>
              You have reached your quota of indexed content (
              {numTokensPerTeamAllowance} tokens) on this plan. Please upgrade
              your plan to index more content.
            </UpgradeNote>
          )}
          <div
            className={cn(
              'mt-4 grid grid-cols-2 gap-4 sm:grid-cols-1 sm:gap-2',
              {
                'cursor-not-allowed': !canAddMoreContent,
              },
            )}
          >
            <GitHubAddSourceDialog
              onDidAddSource={startTraining}
              openPricingAsDialog
            >
              <ConnectButton
                label="GitHub repo"
                Icon={GitHubIcon}
                disabled={!canAddMoreContent}
              />
            </GitHubAddSourceDialog>
            <WebsiteAddSourceDialog
              onDidAddSource={startTraining}
              openPricingAsDialog
            >
              <ConnectButton
                label="Website"
                Icon={Globe}
                disabled={!canAddMoreContent}
              />
            </WebsiteAddSourceDialog>
            <MotifAddSourceDialog onDidAddSource={startTraining}>
              <ConnectButton
                label="Motif project"
                Icon={MotifIcon}
                disabled={!canAddMoreContent}
              />
            </MotifAddSourceDialog>
            <FilesAddSourceDialog
              onDidAddSource={startTraining}
              openPricingAsDialog
            >
              <ConnectButton
                label="Upload files"
                Icon={Upload}
                disabled={!canAddMoreContent}
              />
            </FilesAddSourceDialog>
          </div>
          <p className="mt-6 text-sm text-neutral-500">
            Or select a sample data source:
          </p>
          <div
            className={cn('mt-4 grid grid-cols-2 gap-4 sm:grid-cols-1', {
              'cursor-not-allowed': !canAddMoreContent,
            })}
          >
            <ConnectButton
              label="Markprompt docs"
              Icon={GitHubIcon}
              disabled={!canAddMoreContent}
              onClick={async () => {
                await _addSource('github', { url: SAMPLE_REPO_URL });
              }}
            />
          </div>
          {sources?.length > 0 && (
            <>
              <h2 className="mt-8 text-sm font-semibold text-neutral-300">
                Connected sources
              </h2>
              <div className="mt-4 flex flex-col gap-2">
                {sources.map((source, i) => {
                  const Icon = getIconForSource(source.type);
                  const accessory = getAccessoryLabelForSource(source);
                  return (
                    <div
                      key={`source-icon-${i}`}
                      className="flex flex-row items-center gap-2 rounded-md bg-sky-900/20 py-2 pl-3 pr-2 outline-none"
                    >
                      <Icon className="h-4 w-4 flex-none text-sky-400" />
                      <p className="flex-grow overflow-hidden text-xs text-sky-400">
                        {getLabelForSource(source, false)}
                      </p>
                      {accessory?.label && (
                        <p className="ml-4 overflow-hidden text-xs text-sky-700">
                          {accessory.label}
                        </p>
                      )}
                      <button
                        className="button-ring rounded-md p-1 outline-none"
                        onClick={() => {
                          setSourceToRemove(source);
                        }}
                      >
                        <X className="h-3 w-3 text-sky-400" />
                      </button>
                    </div>
                  );
                })}
              </div>
              {!isOnboarding && (
                <Link
                  href={`/${team?.slug}/${project?.slug}`}
                  className="subtle-underline mt-4 inline-block text-xs text-neutral-500"
                >
                  Go to data browser
                </Link>
              )}
            </>
          )}
        </div>
        <div
          className={cn(
            'absolute inset-x-0 bottom-0 z-20 flex transform flex-col justify-center gap-2 border-t border-neutral-900 bg-neutral-1100 px-6 py-3 transition duration-300',
            {
              'translate-y-0 opacity-100': sources.length > 0,
              'translate-y-[20px] opacity-0': sources.length === 0,
            },
          )}
        >
          {trainingState.state !== 'idle' && (
            <StatusMessage
              trainingState={trainingState}
              numFiles={numFiles || 0}
              numSelected={0}
            />
          )}
          <div className="flex flex-row items-center gap-2">
            <Button
              className="w-full"
              variant={isTrained ? 'plain' : 'glow'}
              loading={trainingState.state !== 'idle'}
              onClick={startTraining}
            >
              Process sources
            </Button>
            <Popover.Root>
              <Popover.Trigger asChild>
                <button
                  className="rounded-md p-2 text-neutral-500 outline-none transition duration-300 hover:bg-neutral-900 hover:text-neutral-400"
                  role="button"
                  aria-label="Configure training"
                >
                  <SettingsIcon className="h-5 w-5 transform duration-300" />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  sideOffset={0}
                  alignOffset={-10}
                  align="end"
                  className="animate-menu-up z-30 mt-2 -mr-8 ml-8 w-[320px] rounded-lg border border-neutral-900 bg-neutral-1000 p-4 shadow-2xl"
                >
                  <div className="flex flex-none flex-row items-center gap-2">
                    <label
                      className="flex-grow truncate text-sm font-normal text-neutral-300"
                      htmlFor="product-updates"
                    >
                      Force retrain
                    </label>
                    <Switch.Root
                      className="switch-root"
                      checked={forceRetrain}
                      onCheckedChange={setForceRetrain}
                    >
                      <Switch.Thumb className="switch-thumb" />
                    </Switch.Root>
                  </div>
                  <p className="mt-2 text-xs text-neutral-400">
                    If on, previously indexed content will be retrained, even if
                    it hasn&apos;t changed.
                  </p>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>
        </div>
      </div>
      <div className="relative col-span-2">
        <div
          ref={previewContainerRef}
          className={cn(
            'pointer-events-none absolute inset-0 z-30 flex items-center justify-center transition duration-300',
          )}
        >
          <div
            className={cn('absolute inset-0 z-0 bg-black/80 ', {
              'opacity-100': isShowingOverlay,
              'pointer-events-none opacity-0': !isShowingOverlay,
            })}
          />
          {isShowingLines && (
            <div className="pointer-events-none absolute inset-0 flex-none">
              {!hasConnectedSources && !isTraining && (
                <LinesContainer
                  position="top-left"
                  isDark={isDark}
                  onOverlay={true}
                  top={40}
                  left={0}
                  width={overlayDimensions.overlayMessageLeft}
                  height={overlayDimensions.previewContainerHeight / 2 - 72}
                />
              )}
              {hasConnectedSources && !isTrained && (
                <LinesContainer
                  position="bottom-left"
                  isDark={isDark}
                  onOverlay={true}
                  top={overlayDimensions.previewContainerHeight / 2 + 29}
                  left={0}
                  width={overlayDimensions.overlayMessageLeft}
                  height={overlayDimensions.previewContainerHeight / 2 - 61}
                />
              )}
              {isTrained &&
                isOnboarding &&
                didCompleteFirstQuery &&
                !isLoadingResponse && (
                  <LinesContainer
                    position="right"
                    isDark={isDark}
                    top={32}
                    left={
                      overlayDimensions.overlayMessageLeft +
                      overlayDimensions.overlayMessageWidth
                    }
                    width={
                      overlayDimensions.previewContainerWidth -
                      overlayDimensions.overlayMessageLeft -
                      overlayDimensions.overlayMessageWidth
                    }
                    height={overlayDimensions.previewContainerHeight / 2 - 32}
                  />
                )}
            </div>
          )}
          {overlayMessage && (
            <div
              ref={overlayMessageRef}
              className={cn(
                'transfrom flex max-w-[400px] flex-row flex-wrap items-center gap-2 rounded-full bg-black/80 py-3 px-5 text-center text-sm text-white backdrop-blur transition duration-500',

                {
                  'translate-y-[-30px]':
                    !hasConnectedSources &&
                    !isTrained &&
                    trainingState.state === 'idle',
                  'translate-y-[30px]':
                    hasConnectedSources &&
                    !isTrained &&
                    trainingState.state === 'idle',
                },
              )}
            >
              {trainingState.state !== 'idle' && (
                <SpinnerIcon className="ml-1 h-4 w-4 animate-spin" />
              )}
              <>{overlayMessage}</>
            </div>
          )}
        </div>
        <div
          className={cn('h-full w-full overflow-hidden', {
            'pointer-events-none': !hasConnectedSources || !isTrained,
          })}
        >
          {project && (
            <div className={cn('h-full border-l border-r border-neutral-900')}>
              <div className="relative flex h-full flex-col gap-4">
                <div
                  className="pointer-events-none absolute inset-0 z-0"
                  style={
                    isPlaygroundVisible
                      ? {
                          backgroundColor: isDark
                            ? theme.colors.dark.overlay
                            : theme.colors.light.overlay,
                        }
                      : {}
                  }
                />
                <div className="absolute inset-0">
                  <iframe
                    ref={playgroundRef}
                    src="/static/html/chatbot-playground.html"
                    className="absolute inset-0 h-full w-full bg-transparent"
                    onLoad={() => {
                      setTimeout(() => {
                        setPlaygroundLoaded(true);
                      }, 100);
                      setTimeout(() => {
                        setDidCompleteFirstQuery(true);
                      }, 5000);
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div
        className={cn('relative h-full transition', {
          'pointer-events-none opacity-30':
            !paginatedFiles || paginatedFiles.length === 0,
        })}
      >
        <div className="absolute inset-x-0 top-0 bottom-0 flex flex-col overflow-y-auto pb-24">
          <div className="sticky inset-x-0 top-0 z-10 grid grid-cols-1 items-center justify-end gap-4 border-b border-neutral-900 bg-neutral-1100 py-4 px-6 shadow-lg sm:grid-cols-2">
            <Share>
              <Button
                disabled={!isTrained}
                buttonSize="sm"
                variant="plain"
                Icon={ShareIcon}
              >
                Share
              </Button>
            </Share>
            <GetCode isOnboarding={!!isOnboarding}>
              <Button
                disabled={!isTrained}
                buttonSize="sm"
                variant="plain"
                Icon={Code}
              >
                Get code
              </Button>
            </GetCode>
          </div>
          <div className="px-6 pt-4 text-neutral-300">
            <h2 className="mb-4 text-lg font-bold">Component</h2>
            <UIConfigurator />
            <h2 className="mb-4 mt-12 text-lg font-bold">Model</h2>
            <ModelConfigurator />
          </div>
        </div>
      </div>

      <Dialog.Root
        open={!!sourceToRemove}
        onOpenChange={() => setSourceToRemove(undefined)}
      >
        {sourceToRemove && project && (
          <RemoveSourceDialog
            projectId={project.id}
            source={sourceToRemove}
            onComplete={() => setSourceToRemove(undefined)}
          />
        )}
      </Dialog.Root>
    </div>
  );
};

export default PlaygroundDashboard;
