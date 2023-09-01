import * as Accordion from '@radix-ui/react-accordion';
import * as Switch from '@radix-ui/react-switch';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { ExternalLinkIcon, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { ChangeEvent, FC, useMemo } from 'react';

import { useConfigContext } from '@/lib/context/config';
import emitter, { EVENT_OPEN_PLAN_PICKER_DIALOG } from '@/lib/events';
import useTeam from '@/lib/hooks/use-team';
import { canRemoveBranding } from '@/lib/stripe/tiers';
import { Theme, ThemeColorKeys, ThemeColors } from '@/lib/themes';
import { SerializableMarkpromptOptions } from '@/types/types';

import { LayoutPicker } from './LayoutPicker';
import { Row } from './PlaygroundDashboard';
import { SearchProviderConfig } from './SearchProviderConfig';
import { ThemePicker } from './ThemePicker';
import { AccordionContent, AccordionTrigger } from '../ui/Accordion';
import { ButtonOrLinkWrapper } from '../ui/Button';
import ColorPickerInput from '../ui/ColorPickerInput';
import Input from '../ui/Input';
import { Tag } from '../ui/Tag';

type ThemeColorPickerProps = {
  colors: ThemeColors;
  colorKey: ThemeColorKeys;
};

const ThemeColorPicker: FC<ThemeColorPickerProps> = ({ colors, colorKey }) => {
  const { setColor } = useConfigContext();

  return (
    <ColorPickerInput
      color={colors[colorKey] || 'FFFFFF'}
      setColor={(color: string) => setColor(colorKey, color)}
    />
  );
};

type UIConfiguratorProps = {
  className?: string;
};

const UIConfigurator: FC<UIConfiguratorProps> = () => {
  const { team } = useTeam();
  const {
    markpromptOptions,
    theme,
    setTheme,
    isDark,
    setDark,
    setSize,
    setMarkpromptOptions,
  } = useConfigContext();

  const colors = useMemo(() => {
    return isDark ? theme.colors.dark : theme.colors.light;
  }, [theme, isDark]);

  const _canRemoveBranding = team && canRemoveBranding(team);

  return (
    <div className="flex flex-col">
      <Row label="Layout">
        <LayoutPicker />
      </Row>
      <Row label="Theme">
        <ThemePicker />
      </Row>
      <Row label="Instant search">
        <div className="flex flex-row items-center justify-end gap-2">
          <ButtonOrLinkWrapper
            className="mr-1 flex flex-none items-center rounded-full"
            Component="div"
          >
            <Tag className="flex flex-row items-center gap-1" color="sky">
              <Sparkles className="h-4 w-3" /> New
            </Tag>
          </ButtonOrLinkWrapper>
          <Switch.Root
            className="relative h-5 w-8 flex-none rounded-full border border-neutral-700 bg-neutral-800 disabled:cursor-not-allowed data-[state='checked']:border-green-600 data-[state='checked']:bg-green-600 disabled:data-[state='checked']:opacity-40"
            checked={!!(markpromptOptions.search as any)?.enabled}
            onCheckedChange={(b: boolean) =>
              setMarkpromptOptions({
                ...markpromptOptions,
                search: {
                  ...markpromptOptions.search,
                  enabled: b,
                },
              } as SerializableMarkpromptOptions)
            }
          >
            <Switch.Thumb className="block h-4 w-4 translate-x-[1px] transform rounded-full bg-white transition data-[state='checked']:translate-x-[13px]" />
          </Switch.Root>
        </div>
      </Row>
      {markpromptOptions.search?.enabled && <SearchProviderConfig />}
      <Row label="Feedback">
        <div className="flex flex-row items-center justify-end gap-2">
          <Switch.Root
            className="relative h-5 w-8 flex-none rounded-full border border-neutral-700 bg-neutral-800 disabled:cursor-not-allowed data-[state='checked']:border-green-600 data-[state='checked']:bg-green-600 disabled:data-[state='checked']:opacity-40"
            checked={markpromptOptions.feedback?.enabled}
            onCheckedChange={(b: boolean) =>
              setMarkpromptOptions({
                ...markpromptOptions,
                feedback: { ...markpromptOptions.feedback, enabled: b },
              })
            }
          >
            <Switch.Thumb className="block h-4 w-4 translate-x-[1px] transform rounded-full bg-white transition data-[state='checked']:translate-x-[13px]" />
          </Switch.Root>
        </div>
      </Row>
      <Row label="Include branding">
        <div className="flex flex-row items-center justify-end gap-2">
          {!_canRemoveBranding && (
            <ButtonOrLinkWrapper
              className="mr-1 flex flex-none items-center rounded-full"
              onClick={() => {
                emitter.emit(EVENT_OPEN_PLAN_PICKER_DIALOG);
              }}
            >
              <Tag color="fuchsia">Enterprise</Tag>
            </ButtonOrLinkWrapper>
          )}
          <Switch.Root
            className="relative h-5 w-8 flex-none rounded-full border border-neutral-700 bg-neutral-800 disabled:cursor-not-allowed data-[state='checked']:border-green-600 data-[state='checked']:bg-green-600 disabled:data-[state='checked']:opacity-40"
            checked={markpromptOptions.showBranding || !_canRemoveBranding}
            disabled={!_canRemoveBranding}
            onCheckedChange={(b: boolean) =>
              setMarkpromptOptions({ ...markpromptOptions, showBranding: b })
            }
          >
            <Switch.Thumb className="block h-4 w-4 translate-x-[1px] transform rounded-full bg-white transition data-[state='checked']:translate-x-[13px]" />
          </Switch.Root>
        </div>
      </Row>
      <Accordion.Root className="mt-2 w-full" type="single" collapsible>
        <Accordion.Item value="options">
          <AccordionTrigger>UI configuration</AccordionTrigger>
          <AccordionContent className="pt-4">
            <div className="flex flex-col">
              <Row label="Link mapping">
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
              <Row className="mt-4" label="Size">
                <ToggleGroup.Root
                  className="grid w-full grid-cols-2 overflow-hidden rounded border border-neutral-800 bg-neutral-1000 text-xs font-medium text-neutral-300"
                  type="single"
                  value={theme.size}
                  onValueChange={(value) => {
                    setSize(value as Theme['size']);
                  }}
                  aria-label="Mode"
                >
                  <ToggleGroup.Item
                    className="px-2 py-1.5 text-center transition data-[state='on']:bg-neutral-900 data-[state='on']:text-neutral-300 data-[state='off']:text-neutral-500"
                    value="sm"
                    aria-label="Small"
                  >
                    Small
                  </ToggleGroup.Item>
                  <ToggleGroup.Item
                    className="px-2 py-1.5 text-center transition data-[state='on']:bg-neutral-900 data-[state='on']:text-neutral-300 data-[state='off']:text-neutral-500"
                    value="base"
                    aria-label="Base"
                  >
                    Base
                  </ToggleGroup.Item>
                </ToggleGroup.Root>
              </Row>
              <Row className="mb-2 mt-4" label="Show colors for">
                <ToggleGroup.Root
                  className="grid w-full grid-cols-2 overflow-hidden rounded border border-neutral-800 bg-neutral-1000 text-xs font-medium text-neutral-300"
                  type="single"
                  value={isDark ? 'dark' : 'light'}
                  onValueChange={(value) => {
                    setDark(value === 'dark');
                  }}
                  aria-label="Mode"
                >
                  <ToggleGroup.Item
                    className="px-2 py-1.5 text-center transition data-[state='on']:bg-neutral-900 data-[state='on']:text-neutral-300 data-[state='off']:text-neutral-500"
                    value="light"
                    aria-label="Light mode"
                  >
                    Light
                  </ToggleGroup.Item>
                  <ToggleGroup.Item
                    className="px-2 py-1.5 text-center transition data-[state='on']:bg-neutral-900 data-[state='on']:text-neutral-300 data-[state='off']:text-neutral-500"
                    value="dark"
                    aria-label="Dark mode"
                  >
                    Dark
                  </ToggleGroup.Item>
                </ToggleGroup.Root>
              </Row>
              <Row label="Background">
                <ThemeColorPicker colors={colors} colorKey="background" />
              </Row>
              <Row label="Foreground">
                <ThemeColorPicker colors={colors} colorKey="foreground" />
              </Row>
              {/* Muted colors of content */}
              <Row label="Muted">
                <ThemeColorPicker colors={colors} colorKey="muted" />
              </Row>
              <Row label="Muted foreground">
                <ThemeColorPicker colors={colors} colorKey="mutedForeground" />
              </Row>
              <Row label="Border">
                <ThemeColorPicker colors={colors} colorKey="border" />
              </Row>
              {/* <Row label="Input">
                <ThemeColorPicker colors={colors} colorKey="input" />
              </Row> */}
              {/* Primary colors for buttons */}
              <Row label="Primary">
                <ThemeColorPicker colors={colors} colorKey="primary" />
              </Row>
              <Row label="Primary foreground">
                <ThemeColorPicker
                  colors={colors}
                  colorKey="primaryForeground"
                />
              </Row>
              <Row label="Primary muted">
                <ThemeColorPicker colors={colors} colorKey="primaryMuted" />
              </Row>
              {/* Secondary colors for buttons */}
              <Row label="Secondary">
                <ThemeColorPicker colors={colors} colorKey="secondary" />
              </Row>
              <Row label="Secondary foreground">
                <ThemeColorPicker
                  colors={colors}
                  colorKey="secondaryForeground"
                />
              </Row>
              <Row label="Primary highlight">
                <ThemeColorPicker colors={colors} colorKey="primaryHighlight" />
              </Row>
              <Row label="Secondary highlight">
                <ThemeColorPicker
                  colors={colors}
                  colorKey="secondaryHighlight"
                />
              </Row>
              <Row label="Overlay">
                <ThemeColorPicker colors={colors} colorKey="overlay" />
              </Row>
              {/* Border radius for card, input and buttons */}
              {/* <Row label="Ring">
                <ThemeColorPicker colors={colors} colorKey="ring" />
              </Row> */}
              {/* Border radius for card, input and buttons */}
              <Row label="Radius">
                <Input
                  inputSize="sm"
                  value={theme.dimensions.radius}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    try {
                      const radius = event.target.value;
                      setTheme({
                        ...theme,
                        dimensions: {
                          ...theme.dimensions,
                          radius,
                        },
                      });
                    } catch {
                      //
                    }
                  }}
                />
              </Row>
              <Row className="mt-4" label="Placeholder">
                <Input
                  inputSize="sm"
                  value={markpromptOptions.prompt?.placeholder}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    setMarkpromptOptions({
                      ...markpromptOptions,
                      prompt: {
                        ...markpromptOptions.prompt,
                        placeholder: event.target.value,
                      },
                    });
                  }}
                />
              </Row>
              <Row label="Don't know message">
                <Input
                  inputSize="sm"
                  value={markpromptOptions.prompt?.iDontKnowMessage}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    setMarkpromptOptions({
                      ...markpromptOptions,
                      prompt: {
                        ...markpromptOptions.prompt,
                        iDontKnowMessage: event.target.value,
                      },
                    });
                  }}
                />
              </Row>
              <Row label="References heading">
                <Input
                  inputSize="sm"
                  value={(markpromptOptions.references as any)?.referencesText}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    setMarkpromptOptions({
                      ...markpromptOptions,
                      references: {
                        ...markpromptOptions.references,
                        referencesText: event.target.value,
                      },
                    } as SerializableMarkpromptOptions);
                  }}
                />
              </Row>
              <Row label="Loading heading">
                <Input
                  inputSize="sm"
                  value={(markpromptOptions.references as any)?.loadingText}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    setMarkpromptOptions({
                      ...markpromptOptions,
                      references: {
                        ...markpromptOptions.references,
                        loadingText: event.target.value,
                      },
                    } as SerializableMarkpromptOptions);
                  }}
                />
              </Row>
              {(markpromptOptions.search as any)?.enabled && (
                <>
                  <Row label="Search tab">
                    <Input
                      inputSize="sm"
                      value={markpromptOptions.search?.tabLabel}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => {
                        setMarkpromptOptions({
                          ...markpromptOptions,
                          search: {
                            ...markpromptOptions.search,
                            tabLabel: event.target.value,
                          },
                        });
                      }}
                    />
                  </Row>
                  <Row label="Ask tab">
                    <Input
                      inputSize="sm"
                      value={markpromptOptions.prompt?.tabLabel}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => {
                        setMarkpromptOptions({
                          ...markpromptOptions,
                          prompt: {
                            ...markpromptOptions.prompt,
                            tabLabel: event.target.value,
                          },
                        });
                      }}
                    />
                  </Row>
                </>
              )}
            </div>
          </AccordionContent>
        </Accordion.Item>
      </Accordion.Root>
      {/* <Accordion.Root className="mt-2 w-full" type="single" collapsible>
        <Accordion.Item value="options">
          <AccordionTrigger>Link mappings</AccordionTrigger>
          <AccordionContent className="pt-4">
            <div className="flex flex-col gap-2">
              <div className="mt-1 flex w-full flex-col">
                <div className="input-base input-base-border input-focus py-4 pl-4 font-mono">
                  <NoAutoTextArea
                    value={markpromptOptions.prompt?.promptTemplate}
                    className="input-base-noborder h-[200px] w-full border-0 bg-transparent text-xs"
                    noStyle
                    textAreaSize="sm"
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      setMarkpromptOptions({
                        ...markpromptOptions,
                        prompt: {
                          ...markpromptOptions.prompt,
                          promptTemplate: event.target.value,
                        },
                      });
                    }}
                  />
                </div>
                <Link
                  href="/docs#templates"
                  target="_blank"
                  rel="noreferrer"
                  className="button-ring mt-4 mb-4 flex w-min cursor-pointer flex-row items-center gap-2 truncate whitespace-nowrap rounded-md text-xs text-neutral-300"
                >
                  <Info className="h-4 w-4 text-neutral-300" />
                  <span className="subtle-underline">
                    Learn more about templates
                  </span>
                </Link>
              </div>
            </div>
          </AccordionContent>
        </Accordion.Item>
      </Accordion.Root> */}
    </div>
  );
};

export default UIConfigurator;
