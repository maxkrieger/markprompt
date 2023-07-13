import {
  DEFAULT_SUBMIT_PROMPT_OPTIONS,
  DEFAULT_SUBMIT_SEARCH_QUERY_OPTIONS,
  FileSectionReference,
  Source,
  SubmitPromptOptions,
  SubmitSearchQueryOptions,
} from '@markprompt/core';
// import { MarkpromptOptions } from "@markprompt/react";

export const IDK_MESSAGE = 'Sorry, I am not sure how to answer that.';
export const MIN_CONTENT_LENGTH = 5;
export const MAX_PROMPT_LENGTH = 200;
export const STREAM_SEPARATOR = '___START_RESPONSE_STREAM___';
export const CONTEXT_TOKENS_CUTOFF = 4000;
export const CONTEXT_TOKENS_CUTOFF_GPT_3_5_TURBO = 2048;
export const SAMPLE_REPO_URL =
  'https://github.com/motifland/markprompt-sample-docs';
export const MIN_SLUG_LENGTH = 3;

export const DEFAULT_MARKPROMPT_CONFIG = `{
  "include": [
    "**/*"
  ],
  "exclude": [],
  "processorOptions": {}
}`;

export const MARKPROMPT_JS_PACKAGE_VERSIONS = {
  css: '0.6.1',
  web: '0.10.0',
  react: '0.12.0',
  'docusaurus-theme-search': '0.5.12',
};

const removeFileExtension = (fileName: string): string => {
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return fileName;
  }
  return fileName.substring(0, lastDotIndex);
};

const pathToHref = (path: string): string => {
  const lastDotIndex = path.lastIndexOf('.');
  let cleanPath = path;
  if (lastDotIndex >= 0) {
    cleanPath = path.substring(0, lastDotIndex);
  }
  if (cleanPath.endsWith('/index')) {
    cleanPath = cleanPath.replace(/\/index/gi, '');
  }
  return cleanPath;
};

const defaultGetHref = (reference: FileSectionReference): string => {
  const path = pathToHref(reference.file.path);
  if (reference.meta?.leadHeading?.id) {
    return `${path}#${reference.meta.leadHeading.id}`;
  } else if (reference.meta?.leadHeading?.value) {
    return `${path}#${reference.meta.leadHeading.slug}`;
  }
  return path;
};

const defaultPromptGetLabel = (reference: FileSectionReference): string => {
  return (
    reference.meta?.leadHeading?.value ||
    reference.file?.title ||
    removeFileExtension(reference.file.path.split('/').slice(-1)[0])
  );
};

export const DEFAULT_MARKPROMPT_OPTIONS: MarkpromptOptions = {
  display: 'dialog',
  close: {
    label: 'Close Markprompt',
    visible: true,
  },
  description: {
    hide: true,
    text: 'Markprompt',
  },
  feedback: {
    enabled: false,
    heading: 'Was this response helpful?',
    confirmationMessage: 'Thank you!',
  },
  prompt: {
    ...DEFAULT_SUBMIT_PROMPT_OPTIONS,
    label: 'Ask me anything…',
    placeholder: 'Ask me anything…',
    cta: 'Ask Docs AI…',
  },
  references: {
    loadingText: 'Fetching relevant pages…',
    heading: 'Answer generated from the following sources:',
    getHref: defaultGetHref,
    getLabel: defaultPromptGetLabel,
  },
  search: {
    ...DEFAULT_SUBMIT_SEARCH_QUERY_OPTIONS,
    cta: 'Search docs…',
    enabled: false,
    getHref: defaultGetHref,
    label: 'Search docs…',
    placeholder: 'Search docs…',
  },
  trigger: {
    label: 'Open Markprompt',
    placeholder: 'Ask docs',
    floating: true,
    customElement: false,
  },
  title: {
    hide: true,
    text: 'Ask me anything…',
  },
  showBranding: true,
};

export type MarkpromptOptions = {
  /**
   * Display format.
   * @default "dialog"
   **/
  display?: 'plain' | 'dialog';
  close?: {
    /**
     * `aria-label` for the close modal button
     * @default "Close Markprompt"
     **/
    label?: string;
    /**
     * Show the close button
     * @default true
     **/
    visible?: boolean;
  };
  description?: {
    /**
     * Visually hide the description
     * @default true
     **/
    hide?: boolean;
    /**
     * Description text
     **/
    text?: string;
  };
  feedback?: {
    /**
     * Enable feedback functionality, shows a thumbs up/down button after a
     * prompt was submitted.
     * @default false
     * */
    enabled?: boolean;
    /**
     * Heading above the form
     * @default "Was this response helpful?"
     **/
    heading?: string;
    /**
     * Confirmation message
     * @default "Thank you!"
     **/
    confirmationMessage?: string;
  };
  prompt?: SubmitPromptOptions & {
    /**
     * Label for the prompt input
     * @default "Ask me anything…"
     **/
    label?: string;
    /**
     * Placeholder for the prompt input
     * @default "Ask me anything…"
     **/
    placeholder?: string;
    /**
     * When search is enabled, this label is used for the call-to-action button
     * that switches to the prompt view that is shown in the search view.
     * @default "Ask Docs AI…"
     **/
    cta?: string;
  };
  references?: {
    /** Callback to transform a reference into an href */
    getHref?: (reference: FileSectionReference) => string;
    /** Callback to transform a reference into a label */
    getLabel?: (reference: FileSectionReference) => string;
    /**
     * Heading above the references
     * @default "Answer generated from the following sources:"
     **/
    heading?: string;
    /** Loading text, default: `Fetching relevant pages…` */
    loadingText?: string;
    /**
     * Callback to transform a reference id into an href and text
     * @deprecated Use `getHref` and `getLabel` instead
     **/
    transformReferenceId?: (referenceId: string) => {
      href: string;
      text: string;
    };
  };
  /**
   * Enable and configure search functionality
   */
  search?: SubmitSearchQueryOptions & {
    /**
     * When search is enabled, this label is used for the call-to-action button
     * that switches to the search view that is shown in the prompt view.
     */
    cta?: string;
    /**
     * Enable search
     * @default false
     **/
    enabled?: boolean;
    /** Callback to transform a search result into an href */
    getHref?: (reference: FileSectionReference) => string;
    /**
     * Label for the search input, not shown but used for `aria-label`
     * @default "Search docs…"
     **/
    label?: string;
    /**
     * Placeholder for the search input
     * @default "Search docs…"
     */
    placeholder?: string;
  };
  trigger?: {
    /**
     * `aria-label` for the open button
     * @default "Open Markprompt"
     **/
    label?: string;
    /**
     * Placeholder text for non-floating element.
     * @default "Ask docs"
     **/
    placeholder?: string;
    /**
     * Should the trigger button be displayed as a floating button at the bottom right of the page?
     * Setting this to false will display a trigger button in the element passed
     * to the `markprompt` function.
     */
    floating?: boolean;
    /** Do you use a custom element as the dialog trigger? */
    customElement?: boolean;
  };
  title?: {
    /**
     * Visually hide the title
     * @default true
     **/
    hide?: boolean;
    /**
     * Text for the title
     * @default "Ask me anything"
     **/
    text?: string;
  };
  /**
   * Show Markprompt branding
   * @default true
   **/
  showBranding?: boolean;
  /**
   * Display debug info
   * @default false
   **/
  debug?: boolean;
};

export type FileReferenceFileData = {
  title?: string;
  path: string;
  meta?: any;
  source: Source;
};
