/* eslint-disable @typescript-eslint/no-empty-function */
// import { DEFAULT_MARKPROMPT_OPTIONS } from '@markprompt/react';
import {
  createContext,
  FC,
  PropsWithChildren,
  useCallback,
  useContext,
} from 'react';

import { SerializableMarkpromptOptions } from '@/types/types';

import { DEFAULT_MARKPROMPT_OPTIONS } from '../constants';
import useProject from '../hooks/use-project';
import { useLocalStorage } from '../hooks/utils/use-localstorage';
import {
  defaultTheme,
  findMatchingTheme,
  Theme,
  ThemeColorKeys,
  ThemeColors,
} from '../themes';

export type State = {
  markpromptOptions: SerializableMarkpromptOptions;
  theme: Theme;
  colors: ThemeColors;
  isDark: boolean;
  setColor: (colorKey: ThemeColorKeys, value: string) => void;
  setTheme: (theme: Theme) => void;
  setDark: (dark: boolean) => void;
  setSize: (size: Theme['size']) => void;
  setMarkpromptOptions: (
    markpromptOptions: SerializableMarkpromptOptions,
  ) => void;
  restoreModelDefaults: () => void;
};

export const DEFAULT_MARKPROMPT_OPTIONS_GPT4: SerializableMarkpromptOptions = {
  ...DEFAULT_MARKPROMPT_OPTIONS,
  prompt: {
    ...DEFAULT_MARKPROMPT_OPTIONS.prompt,
    model: 'gpt-4',
  },
  references: {
    ...DEFAULT_MARKPROMPT_OPTIONS.references,
    serializedTransformReferenceId: `let href = referenceId;

// Remove file extension
const lastDotIndex = referenceId.lastIndexOf('.');
if (lastDotIndex >= 0) {
  href = referenceId.substring(0, lastDotIndex);
}

// For label, capitalize last path component
const lastPathComponent = href.split('/').slice(-1)[0]
const text = lastPathComponent.charAt(0).toUpperCase() + text.slice(1);

return { href, text }`,
  },
  search: {
    ...DEFAULT_MARKPROMPT_OPTIONS.search,
    serializedGetHref: `const lastDotIndex = path.lastIndexOf('.');
let cleanPath = path;
if (lastDotIndex >= 0) {
  cleanPath = path.substring(0, lastDotIndex);
}
if (cleanPath.endsWith('/index')) {
  cleanPath = cleanPath.replace(/\\/index/gi, '');
}

if (sectionHeading?.id) {
  return \`\${cleanPath}#\${sectionHeading.id}\`;
} else if (sectionHeading?.value) {
  const slugger = new Slugger();
  return \`\${cleanPath}#\${slugger.slug(sectionHeading.value)}\`;
}
return cleanPath;`,
  },
};

const initialState: State = {
  markpromptOptions: DEFAULT_MARKPROMPT_OPTIONS_GPT4,
  theme: defaultTheme,
  colors: defaultTheme.colors.light,
  isDark: false,
  setColor: () => {},
  setTheme: () => {},
  setDark: () => {},
  setSize: () => {},
  setMarkpromptOptions: () => {},
  restoreModelDefaults: () => {},
};

export const isDefaultMarkpromptPromptOptions = (
  markpromptOptions: SerializableMarkpromptOptions,
) => {
  // Checks whether the model config part of markpromptOptions equals
  // the default values. This is to show the upgrade note in case of
  // a change.
  for (const key of Object.keys(DEFAULT_MARKPROMPT_OPTIONS_GPT4.prompt!)) {
    if (
      (markpromptOptions.prompt as any)?.[key] !==
      (DEFAULT_MARKPROMPT_OPTIONS_GPT4.prompt as any)[key]
    ) {
      return false;
    }
  }
  return true;
  // return objectEquals(markpromptOptions, DEFAULT_MARKPROMPT_OPTIONS_GPT4);
};

export const UI_CONFIG_DEFAULT_VALUES = {
  isDark: false,
};

const ConfigContextProvider = (props: PropsWithChildren) => {
  const { project } = useProject();

  const [theme, setTheme] = useLocalStorage<Theme>(
    !project?.id ? null : `${project?.id}:config:theme`,
    defaultTheme,
  );

  const [isDark, setDark] = useLocalStorage<boolean>(
    !project?.id ? null : `${project?.id}:config:model-dark`,
    UI_CONFIG_DEFAULT_VALUES.isDark,
  );

  const [markpromptOptions, setMarkpromptOptions] = useLocalStorage<
    SerializableMarkpromptOptions | undefined
  >(
    !project?.id ? null : `${project?.id}:config:markprompt-options`,
    initialState.markpromptOptions,
  );

  const updateOrCreateCustomTheme = useCallback(
    (newTheme: Theme) => {
      const found = findMatchingTheme(newTheme);
      if (found) {
        setTheme(found);
      } else {
        setTheme({
          isCustom: true,
          ...newTheme,
        });
      }
    },
    [setTheme],
  );

  const setColor = useCallback(
    (colorKey: ThemeColorKeys, value: string) => {
      if (!theme) {
        return;
      }
      const colors = isDark ? theme.colors.dark : theme.colors.light;
      const updatedTheme = {
        ...theme,
        colors: {
          ...theme.colors,
          [isDark ? 'dark' : 'light']: {
            ...colors,
            [colorKey]: value,
          },
        },
      };
      updateOrCreateCustomTheme(updatedTheme);
    },
    [isDark, theme, updateOrCreateCustomTheme],
  );

  const setSize = useCallback(
    (size: Theme['size']) => {
      if (!theme) {
        return;
      }
      const updatedTheme = { ...theme, size };
      updateOrCreateCustomTheme(updatedTheme);
    },
    [theme, updateOrCreateCustomTheme],
  );

  const restoreModelDefaults = useCallback(() => {
    // Change only model parameters (not promptTemplate or other labels).
    setMarkpromptOptions({
      ...markpromptOptions,
      prompt: {
        ...(markpromptOptions?.prompt || {}),
        temperature: initialState.markpromptOptions.prompt!.temperature,
        topP: initialState.markpromptOptions.prompt!.topP,
        frequencyPenalty:
          initialState.markpromptOptions.prompt!.frequencyPenalty,
        presencePenalty: initialState.markpromptOptions.prompt!.presencePenalty,
        maxTokens: initialState.markpromptOptions.prompt!.maxTokens,
        sectionsMatchCount:
          initialState.markpromptOptions.prompt!.sectionsMatchCount,
        sectionsMatchThreshold:
          initialState.markpromptOptions.prompt!.sectionsMatchThreshold,
      },
    });
  }, [markpromptOptions, setMarkpromptOptions]);

  return (
    <ConfigContext.Provider
      value={{
        markpromptOptions: markpromptOptions || initialState.markpromptOptions,
        theme: theme || defaultTheme,
        isDark: isDark || UI_CONFIG_DEFAULT_VALUES.isDark,
        colors: isDark
          ? (theme || defaultTheme).colors.dark
          : (theme || defaultTheme).colors.light,
        setTheme: updateOrCreateCustomTheme,
        setColor,
        setDark,
        setSize,
        setMarkpromptOptions,
        restoreModelDefaults,
      }}
      {...props}
    />
  );
};

export const useConfigContext = (): State => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error(
      `useConfigContext must be used within a ConfigContextProvider`,
    );
  }
  return context;
};

export const ConfigContext = createContext<State>(initialState);

ConfigContext.displayName = 'ConfigContext';

export const ManagedConfigContext: FC<PropsWithChildren> = ({ children }) => (
  <ConfigContextProvider>{children}</ConfigContextProvider>
);
