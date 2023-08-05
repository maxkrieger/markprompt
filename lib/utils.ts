/* eslint-disable no-prototype-builtins */
/* eslint-disable no-useless-escape */
import { createHash } from 'crypto';

import { FileReferenceFileData, FileSectionReference } from '@markprompt/core';
import slugify from '@sindresorhus/slugify';
import confetti from 'canvas-confetti';
import dayjs from 'dayjs';
import grayMatter from 'gray-matter';
import yaml from 'js-yaml';
import { isString } from 'lodash-es';
import { ChevronsUp, GitBranchIcon, Globe, Upload } from 'lucide-react';
import { minimatch } from 'minimatch';
import { customAlphabet } from 'nanoid';
import pako from 'pako';
import { JSXElementConstructor } from 'react';
import tailwindColors from 'tailwindcss/colors';
import type { Config } from 'unique-names-generator';
import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from 'unique-names-generator';

import { GitHubIcon } from '@/components/icons/GitHub';
import { MotifIcon } from '@/components/icons/Motif';
import {
  DateCountHistogramEntry,
  DbFileWithoutContent,
  DbSource,
  FileSectionHeading,
  FileSectionMeta,
  FileType,
  GitHubSourceDataType,
  HistogramStat,
  LLMInfo,
  MotifSourceDataType,
  OpenAIModelIdWithType,
  Source,
  SourceType,
  TimeInterval,
  WebsiteSourceDataType,
} from '@/types/types';

import { APPROX_CHARS_PER_TOKEN, MIN_SLUG_LENGTH } from './constants';
import { removeSchema } from './utils.edge';

const lookup = [
  { value: 1, symbol: '' },
  { value: 1e3, symbol: 'K' },
  { value: 1e6, symbol: 'M' },
  { value: 1e9, symbol: 'G' },
  { value: 1e12, symbol: 'T' },
  { value: 1e15, symbol: 'P' },
  { value: 1e18, symbol: 'E' },
];
const rx = /\.0+$|(\.[0-9]*[1-9])0+$/;

export function formatNumber(num: number, digits?: number) {
  const item = lookup
    .slice()
    .reverse()
    .find(function (item) {
      return num >= item.value;
    });
  return item
    ? (num / item.value).toFixed(digits || 1).replace(rx, '$1') + item.symbol
    : '0';
}

// Formats number as as "1,000,000.12".
export const formatNumberWithLocale = (num: number) => {
  return num.toLocaleString('en-US');
};

export const intervalData = {
  '1h': {
    milliseconds: 3600000,
    intervals: 60,
    numTicks: 6,
    coefficient: 60000,
    format: (e: number) =>
      new Date(e).toLocaleTimeString('en-us', {
        hour: 'numeric',
        minute: 'numeric',
      }),
  },
  '24h': {
    milliseconds: 86400000,
    intervals: 24,
    numTicks: 12,
    coefficient: 3600000,
    format: (e: number) =>
      new Date(e).toLocaleTimeString('en-us', {
        hour: 'numeric',
      }),
  },
  '7d': {
    milliseconds: 604800000,
    intervals: 7,
    numTicks: 7,
    coefficient: 86400000,
    format: (e: number) =>
      new Date(e).toLocaleDateString('en-us', {
        month: 'numeric',
        day: 'numeric',
      }),
  },
  '30d': {
    milliseconds: 2592000000,
    intervals: 30,
    numTicks: 8,
    coefficient: 86400000,
    format: (e: number) =>
      new Date(e).toLocaleDateString('en-us', {
        month: 'numeric',
        day: 'numeric',
      }),
  },
  '3m': {
    milliseconds: 7776000000,
    intervals: 12,
    numTicks: 12,
    coefficient: 604800000,
    format: (e: number) =>
      new Date(e).toLocaleDateString('en-us', {
        month: 'short',
        day: 'numeric',
      }),
  },
  '1y': {
    milliseconds: 31536000000,
    intervals: 12,
    numTicks: 12,
    coefficient: 2592000000,
    format: (e: number) =>
      new Date(e).toLocaleDateString('en-us', {
        month: 'short',
        day: 'numeric',
      }),
  },
};

export interface getTimeIntervalsOutputProps {
  startTimestamp: number;
  endTimestamp: number;
  timeIntervals: { start: number; end: number }[];
}

export const getTimeIntervals = (
  interval: TimeInterval,
): getTimeIntervalsOutputProps => {
  const { milliseconds, intervals, coefficient } = intervalData[interval];
  const endTimestamp = Math.ceil(Date.now() / coefficient) * coefficient;
  const startTimestamp = endTimestamp - milliseconds;
  const timeIntervals = Array.from({ length: intervals }, (_, i) => ({
    start: startTimestamp + i * coefficient,
    end: startTimestamp + (i + 1) * coefficient,
  }));
  return { startTimestamp, endTimestamp, timeIntervals };
};

const slugGeneratorConfig: Config = {
  dictionaries: [adjectives, animals, colors],
  separator: '-',
  length: 3,
};

export const generateRandomSlug = (): string => {
  return uniqueNamesGenerator(slugGeneratorConfig);
};

export const slugFromEmail = (email: string) => {
  return slugify(email.split('@')[0]);
};

// Non-Latin characters produce empty slugs, so generate a random
// slug instead.
export const slugFromNameOrRandom = (name: string) => {
  const slug = slugify(name);
  if (!slug || slug.length < MIN_SLUG_LENGTH) {
    return generateRandomSlug();
  }
  return slug;
};

export const copyToClipboard = (text: string): void => {
  navigator?.clipboard && navigator.clipboard.writeText(text);
};

export const generateHint = (
  text: string,
  offsetStart = 2,
  offsetEnd = 4,
): string => {
  if (text.length <= offsetStart + offsetEnd) {
    return text;
  }
  return text.substring(0, offsetStart) + '...' + text.slice(-offsetEnd);
};

export const readTextFileAsync = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = (e) => {
      reject(e);
    };
    reader.readAsText(file);
  });
};

export const timeout = async (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const compress = (plainString: string): Uint8Array => {
  return pako.deflate(plainString);
};

export const decompress = (compressedString: Buffer): string => {
  return pako.inflate(compressedString, { to: 'string' });
};

export const getFileExtension = (pathOrName: string): string | undefined => {
  return pathOrName.match(/\.(\w*)$/)?.[1];
};

export const getFileType = (name: string): FileType => {
  const extension = getFileExtension(name);
  switch (extension) {
    case 'mdoc':
      return 'mdoc';
    case 'mdx':
      return 'mdx';
    case 'md':
      return 'md';
    case 'rst':
      return 'rst';
    case 'html':
    case 'htm':
      return 'html';
    default:
      return 'txt';
  }
};
export const supportsFrontmatter = (fileType: FileType): boolean => {
  switch (fileType) {
    case 'md':
    case 'mdoc':
    case 'mdx':
    case 'rst':
      return true;
    default:
      return false;
  }
};

export const SUPPORTED_EXTENSIONS = [
  'md',
  'mdx',
  'mdoc',
  'rst',
  'txt',
  'html',
  'htm',
];

export const isSupportedFileType = (pathOrName: string): boolean => {
  const extension = getFileExtension(pathOrName);
  if (!extension) {
    // If there is no extension, consider it as supported (e.g. a URL).
    return true;
  }
  return !!(extension && SUPPORTED_EXTENSIONS.includes(extension));
};

export const pluralize = (value: number, singular: string, plural: string) => {
  return `${value} ${value === 1 ? singular : plural}`;
};

interface SWRError extends Error {
  status: number;
}

export const fetcher = async <T = any>(
  input: RequestInfo,
  init?: RequestInit,
): Promise<T> => {
  const res = await fetch(input, init);
  return getResponseOrThrow(res);
};

export const getResponseOrThrow = async <T>(res: Response): Promise<T> => {
  if (!res.ok) {
    const json = await res.json();
    if (json.error) {
      const error = new Error(json.error) as SWRError;
      error.status = res.status;
      error.name = json.name;
      throw error;
    } else {
      throw new Error('An unexpected error occurred');
    }
  }
  return res.json();
};

export const showConfetti = () => {
  const end = Date.now() + 2 * 1000;
  const confettiColors = [
    tailwindColors.sky['700'],
    tailwindColors.fuchsia['700'],
  ];

  (function frame() {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 80,
      startVelocity: 50,
      origin: { x: 0 },
      colors: confettiColors,
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 80,
      startVelocity: 50,
      origin: { x: 1 },
      colors: confettiColors,
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  })();
};

const formatNumberK = (n: number) => {
  if (n < 1e3) {
    return `${n}`;
  } else if (n < 1e6) {
    return `${Math.round(n / 1e3)}k`;
  } else if (n < 1e9) {
    return `${Math.round(n / 1e6)}M`;
  } else if (n < 1e12) {
    return `${Math.round(n / 1e9)}B`;
  }
  return n;
};

export const formatNumQueries = (quota: number) => {
  return quota === -1
    ? 'Unlimited queries'
    : `Up to ${formatNumberK(quota)} tokens`;
};

export const truncate = (text: string, maxLength: number) => {
  if (text.length > maxLength) {
    return text.slice(0, maxLength) + '...';
  } else {
    return text;
  }
};

export const truncateMiddle = (
  text: string,
  offsetStart = 2,
  offsetEnd = 4,
  truncateText = '...',
): string => {
  if (text.length <= offsetStart + offsetEnd) {
    return text;
  }
  return text.substring(0, offsetStart) + truncateText + text.slice(-offsetEnd);
};

const numDays = 30;
const dayInMs = 1000 * 60 * 60 * 24;
const date = new Date(2023, 5, 20).getMilliseconds();
const datapoints = [
  102, 115, 106, 121, 165, 145, 136, 157, 187, 169, 175, 190, 187, 200, 202,
  182, 200, 223, 225, 216, 204, 210, 209, 221, 221, 226, 212, 226, 228, 235,
];

export const sampleVisitsData: HistogramStat[] = Array.from(
  Array(numDays).keys(),
).map((n) => ({
  start: date - (numDays - n) * dayInMs,
  end: date - (numDays - n + 1) * dayInMs,
  value: datapoints[n],
}));

export const sampleTokenCountData: DateCountHistogramEntry[] = [
  {
    date: dayjs().startOf('day').toDate(),
    count: 1,
  },
  {
    date: dayjs().add(-1, 'days').startOf('day').toDate(),
    count: 1,
  },
];

export const getAuthorizationToken = (header: string | undefined | null) => {
  return header?.replace('Bearer ', '').trim();
};

// Reference: https://stackoverflow.com/questions/10306690/what-is-a-regular-expression-which-will-match-a-valid-domain-name-without-a-subd
export const isValidDomain = (domain: string) => {
  return /^(((?!-))(xn--|_)?[a-z0-9-]{0,61}[a-z0-9]{1,1}\.)*(xn--)?([a-z0-9][a-z0-9-]{0,60}|[a-z0-9-]{1,30}\.[a-z]{2,})$/.test(
    domain,
  );
};

// Reference: https://github.com/manishsaraan/email-validator/blob/master/index.js
export const isValidEmail = (email: string) => {
  return /^[-!#$%&'*+/0-9=?A-Z^_a-z`{|}~](\.?[-!#$%&'*+/0-9=?A-Z^_a-z`{|}~])*@[a-zA-Z0-9](-*\.?[a-zA-Z0-9])*\.[a-zA-Z](-?[a-zA-Z0-9])+$/.test(
    email,
  );
};

// Replace email addresses with [REDACTED]
export const redactEmail = (text: string) => {
  return text.replace(
    /[-!#$%&'*+/0-9=?A-Z^_a-z`{|}~](\.?[-!#$%&'*+/0-9=?A-Z^_a-z`{|}~])*@[a-zA-Z0-9](-*\.?[a-zA-Z0-9])*\.[a-zA-Z](-?[a-zA-Z0-9])+/gi,
    '[REDACTED]',
  );
};

// Replace phone number with [REDACTED]
export const redactPhoneNumbers = (text: string) => {
  return text.replace(
    /(\+?\d{1,2}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    '[REDACTED]',
  );
};

const ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export const generateKey = customAlphabet(ALPHABET, 32);

export const generateShareKey = customAlphabet(ALPHABET, 8);

const PK_PREFIX = 'pk_';
const SK_TEST_PREFIX = 'sk_test_';

export const generatePKKey = () => {
  return PK_PREFIX + generateKey();
};

export const generateSKTestKey = () => {
  return SK_TEST_PREFIX + generateKey();
};

export const isSKTestKey = (key: string | null) => {
  return key?.startsWith(SK_TEST_PREFIX);
};

export const stringToLLMInfo = (model?: string): LLMInfo => {
  switch (model) {
    case 'gpt-4':
    case 'gpt-3.5-turbo':
      return {
        vendor: 'openai',
        model: { type: 'chat_completions', value: model },
      };
    case 'text-davinci-003':
    case 'text-davinci-002':
    case 'text-curie-001':
    case 'text-babbage-001':
    case 'text-ada-001':
    case 'davinci':
    case 'curie':
    case 'babbage':
    case 'ada':
      return {
        vendor: 'openai',
        model: { type: 'completions', value: model },
      };
    default:
      return {
        vendor: 'openai',
        model: { type: 'chat_completions', value: 'gpt-3.5-turbo' },
      };
  }
};

export const getCompletionsUrl = (model: OpenAIModelIdWithType) => {
  switch (model.type) {
    case 'chat_completions': {
      return 'https://api.openai.com/v1/chat/completions';
    }
    default: {
      return 'https://api.openai.com/v1/completions';
    }
  }
};

export const getCompletionsResponseText = (
  response: any,
  model: OpenAIModelIdWithType,
): string => {
  switch (model.type) {
    case 'chat_completions': {
      return response.choices[0].message.content;
    }
    default: {
      return response.choices[0].text;
    }
  }
};

export const matchesGlobs = (path: string, globs: string[]) => {
  return globs.some((g) => minimatch(path, g));
};

export const shouldIncludeFileWithPath = (
  path: string,
  includeGlobs: string[],
  excludeGlobs: string[],
  isWebsiteSource: boolean,
) => {
  if (isWebsiteSource) {
    // If this is a website source, we need to handle the root
    // url specially. Namely, if the path is a root URL, such as
    // https://markprompt.com, we should not see `.com` as a file
    // extension. If it's not a root URL, e.g.
    // https://markprompt.com/favicon.ico, then `.ico` is indeed
    // and extension, and we can check that it's supported. The
    // solution is simply to append a trailing "/" to root URLs.
    const isRootUrl = !urlHasPath(path);
    if (isRootUrl && !path.endsWith('/')) {
      path = path + '/';
    }
  }

  if (
    path.startsWith('.') ||
    path.includes('/.') ||
    !isSupportedFileType(path)
  ) {
    // Exclude dotfiles and unsupported extensions
    return false;
  }

  if (matchesGlobs(path, includeGlobs)) {
    return !matchesGlobs(path, excludeGlobs);
  }

  return false;
};

export const getNameFromPath = (path: string) => {
  return path.split('/').slice(-1)[0];
};

export const createChecksum = (content: string) => {
  return createHash('sha256').update(content).digest('base64');
};

export const capitalize = (text: string) => {
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export const getMotifImageDimensionsFromUrl = (
  url: string,
): { width: number; height: number } | undefined => {
  // Extracts the image dimensions from a URL when uploaded via Motif,
  // which has the form:
  // https://res.cloudinary.com/xxx/image/upload/v111/i1600x1068-yyy.png
  const dimens = url
    .split('/')
    .slice(-1)[0]
    ?.split('-')[0]
    ?.replace(/^i/, '')
    .split('x');

  try {
    return { width: parseInt(dimens?.[0]), height: parseInt(dimens?.[1]) };
  } catch {
    return undefined;
  }
};

export const parseGitHubURL = (url: string) => {
  const match = url.match(
    /^https:\/\/github.com\/([a-zA-Z0-9\-_.]+)\/([a-zA-Z0-9\-_.]+)/,
  );
  if (match && match.length > 2) {
    return { owner: match[1], repo: match[2] };
  }
  return undefined;
};

export const getGitHubOwnerRepoString = (url: string) => {
  const info = parseGitHubURL(url);
  if (!info?.owner && !info?.repo) {
    return undefined;
  }
  return `${info.owner}/${info.repo}`;
};

export const getLabelForSource = (source: Source, inline: boolean) => {
  switch (source.type) {
    case 'github': {
      const data = source.data as GitHubSourceDataType;
      return getGitHubOwnerRepoString(data.url);
    }
    case 'motif': {
      const data = source.data as MotifSourceDataType;
      return data.projectDomain;
    }
    case 'website': {
      const data = source.data as WebsiteSourceDataType;
      return removeSchema(toNormalizedUrl(data.url));
    }
    case 'file-upload':
      return inline ? 'file uploads' : 'File uploads';
    case 'api-upload':
      return 'API uploads';
    default:
      return 'Unknown source';
  }
};

export const getAccessoryLabelForSource = (
  source: Source,
): { label: string; Icon?: JSXElementConstructor<any> } | undefined => {
  switch (source.type) {
    case 'github': {
      const data = source.data as GitHubSourceDataType;
      if (data.branch) {
        return { label: data.branch, Icon: GitBranchIcon };
      }
    }
  }
  return undefined;
};

export const getFileNameForSourceAtPath = (source: Source, path: string) => {
  switch (source.type) {
    case 'website': {
      // Handles e.g. index.html when last path component is empty
      return getNameFromUrlOrPath(path);
    }
    default:
      return path.split('/').slice(-1)[0];
  }
};

export const getNameFromUrlOrPath = (url: string) => {
  // When processing a text file, the type of a file (md, mdoc, html, etc)
  // is determined by the file name, specifically by its extension. In
  // the case where we are parsing websites, the URL of the page might
  // not contain the HTML extension, we nevertheless consider it as an
  // HTML file.
  const baseName = url.split('/').slice(-1)[0];
  if (/\.html$/.test(baseName)) {
    return baseName;
  } else if (baseName.length > 0) {
    return `${baseName}.html`;
  } else {
    return 'index.html';
  }
};

export const toNormalizedOrigin = (
  url: string,
  useInsecureSchema?: boolean,
) => {
  if (/^https?:\/\/[a-zA-Z]+/.test(url)) {
    return `${getSchema(url)}://${getUrlHostname(url)}`;
  }
  return `http${useInsecureSchema ? '' : 's'}://${getUrlHostname(url)}`;
};

export const toNormalizedUrl = (url: string, useInsecureSchema?: boolean) => {
  // Add schema, remove trailing slashes and query params.
  // Check if the URL already contains a schema
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    // If not, add "https://" or "http://" to the beginning of the URL
    url = (useInsecureSchema ? 'http://' : 'https://') + url;
  }

  try {
    const parsedUrl = new URL(url);
    return `${parsedUrl.protocol}//${parsedUrl.hostname}${parsedUrl.pathname}`.replace(
      /\/+$/,
      '',
    );
  } catch {
    // Do nothing, just return the URL as is.
    return url;
  }
};

export const removeTrailingSlashQueryParamsAndHash = (url: string) => {
  const urlObj = new URL(url);
  urlObj.search = '';
  urlObj.hash = '';
  return urlObj.toString().replace(/\/+$/, '');
};

export const getUrlHostname = (url: string) => {
  return removeSchema(url).split('/')[0];
};

export const getSchema = (hostname: string) => {
  return hostname.split('://')[0];
};

export const isUrl = (path: string) => {
  try {
    new URL(path);
    return true;
  } catch (err) {
    return false;
  }
};

export const getUrlPath = (url: string) => {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname;
  } catch {
    return undefined;
  }
};

const urlHasPath = (url: string) => {
  const path = getUrlPath(url);
  return path && path.length > 0 && path !== '/';
};

export const isHrefFromBaseUrl = (baseUrl: string, href: string) => {
  // Given a baseUrl, e.g. https://example.com/docs, determine whether
  // provided href has the same base. Some examples:
  // - https://acme.com is not
  // - https://example.com/docs/welcome is
  // - /blog is not
  // - /docs/welcome is
  if (/^https?:\/\/[a-zA-Z]+/.test(href)) {
    return toNormalizedUrl(href).startsWith(baseUrl);
  } else if (href.startsWith('/')) {
    // Links that don't include a full hostname are considered relative links
    // from the given host.
    const basePath = getUrlPath(baseUrl) || '/';
    return href.startsWith(basePath);
  } else if (!href.includes(':')) {
    // Relative paths should be considered valid, since they are
    // present in a page that has already been validated for processing,
    // so its full URL is already whitelisted, and adding a relative
    // path to its base path with not change this. We do exclude deep
    // links like "mailto:" and "tel:".
    return true;
  }
};

export const completeHrefWithBaseUrl = (baseUrl: string, href: string) => {
  if (href.startsWith('/')) {
    const origin = toNormalizedOrigin(baseUrl);
    return `${origin}${href}`;
  } else if (/^https?:\/\/[a-zA-Z]+/.test(href)) {
    return href;
  } else {
    return `${baseUrl}/${href}`;
  }
};

export const splitIntoSubstringsOfMaxLength = (
  line: string,
  maxLength: number,
) => {
  const words = line.split(' ');
  const result = [];
  let currentSubstring = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (currentSubstring.length + word.length <= maxLength) {
      currentSubstring += (currentSubstring.length > 0 ? ' ' : '') + word;
    } else {
      result.push(currentSubstring);
      currentSubstring = word;
    }
  }

  if (currentSubstring.length > 0) {
    result.push(currentSubstring);
  }

  return result;
};

export const getIconForSource = (sourceType: SourceType) => {
  switch (sourceType) {
    case 'motif':
      return MotifIcon;
    case 'website':
      return Globe;
    case 'file-upload':
      return Upload;
    case 'api-upload':
      return ChevronsUp;
    default:
      return GitHubIcon;
  }
};

export const removeFileExtension = (fileName: string) => {
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return fileName;
  }
  return fileName.substring(0, lastDotIndex);
};

type RGBA = {
  r: number;
  g: number;
  b: number;
  a: number;
};
export const hexToRgba = (hex: string): RGBA => {
  const hexValue = hex.replace('#', '');
  const r = parseInt(hexValue.substring(0, 2), 16);
  const g = parseInt(hexValue.substring(2, 4), 16);
  const b = parseInt(hexValue.substring(4, 6), 16);
  let a = 1;
  if (hexValue.length === 8) {
    a = parseInt(hexValue.substring(6, 8), 16);
  }
  return { r, g, b, a };
};

export const rgbaToHex = ({ r, g, b, a }: RGBA) => {
  const _r = r.toString(16).padStart(2, '0');
  const _g = g.toString(16).padStart(2, '0');
  const _b = b.toString(16).padStart(2, '0');
  const _a = Math.round(a * 255)
    .toString(16)
    .padStart(2, '0');
  return '#' + _r + _g + _b + _a;
};

export const objectEquals = (object: any, otherObject: any) => {
  const keys = Object.keys(object);
  const otherKeys = Object.keys(otherObject);

  if (keys.length !== otherKeys.length) {
    return false;
  }

  for (const key of keys) {
    if (object[key] !== otherObject[key]) {
      return false;
    }
  }

  return true;
};

export const roundToLowerOrderDecimal = (n: number) => {
  const order = Math.pow(10, Math.round(Math.log10(n)));
  const roundedNumber = Math.round(n / order) * order;
  return roundedNumber;
};

// Fast approximate token count. We use a slightly smaller value
// to ensure we stay within boundaries.
export const approximatedTokenCount = (text: string) => {
  return Math.round(text.length / APPROX_CHARS_PER_TOKEN);
};

// Modified version of https://github.com/stiang/remove-markdown, which
// also removes JS import statements, and Markdoc tags.
export const stripMarkdown = (md: string, options?: any) => {
  options = options || {};
  options.listUnicodeChar = options.hasOwnProperty('listUnicodeChar')
    ? options.listUnicodeChar
    : false;
  options.stripListLeaders = options.hasOwnProperty('stripListLeaders')
    ? options.stripListLeaders
    : true;
  options.gfm = options.hasOwnProperty('gfm') ? options.gfm : true;
  options.useImgAltText = options.hasOwnProperty('useImgAltText')
    ? options.useImgAltText
    : true;
  options.abbr = options.hasOwnProperty('abbr') ? options.abbr : false;
  options.replaceLinksWithURL = options.hasOwnProperty('replaceLinksWithURL')
    ? options.replaceLinksWithURL
    : false;
  options.htmlTagsToSkip = options.hasOwnProperty('htmlTagsToSkip')
    ? options.htmlTagsToSkip
    : [];

  let output = md || '';

  // Remove horizontal rules (stripListHeaders conflict with this rule, which is why it has been moved to the top)
  output = output.replace(/^(-\s*?|\*\s*?|_\s*?){3,}\s*/gm, '');

  try {
    if (options.stripListLeaders) {
      if (options.listUnicodeChar)
        output = output.replace(
          /^([\s\t]*)([\*\-\+]|\d+\.)\s+/gm,
          options.listUnicodeChar + ' $1',
        );
      else output = output.replace(/^([\s\t]*)([\*\-\+]|\d+\.)\s+/gm, '$1');
    }
    if (options.gfm) {
      output = output
        // Header
        .replace(/\n={2,}/g, '\n')
        // Fenced codeblocks
        .replace(/~{3}.*\n/g, '')
        // Strikethrough
        .replace(/~~/g, '')
        // Fenced codeblocks
        .replace(/`{3}.*\n/g, '');
    }
    if (options.abbr) {
      // Remove abbreviations
      output = output.replace(/\*\[.*\]:.*\n/, '');
    }
    output = output
      // Remove HTML tags
      .replace(/<[^>]*>/g, '');

    let htmlReplaceRegex = new RegExp('<[^>]*>', 'g');
    if (options.htmlTagsToSkip.length > 0) {
      // Using negative lookahead. Eg. (?!sup|sub) will not match 'sup' and 'sub' tags.
      const joinedHtmlTagsToSkip =
        '(?!' + options.htmlTagsToSkip.join('|') + ')';

      // Adding the lookahead literal with the default regex for html. Eg./<(?!sup|sub)[^>]*>/ig
      htmlReplaceRegex = new RegExp(
        '<' + joinedHtmlTagsToSkip + '[^>]*>',
        'ig',
      );
    }

    output = output
      // Remove HTML tags
      .replace(htmlReplaceRegex, '')
      // Remove setext-style headers
      .replace(/^[=\-]{2,}\s*$/g, '')
      // Remove footnotes?
      .replace(/\[\^.+?\](\: .*?$)?/g, '')
      .replace(/\s{0,2}\[.*?\]: .*?$/g, '')
      // Remove images
      .replace(/\!\[(.*?)\][\[\(].*?[\]\)]/g, options.useImgAltText ? '$1' : '')
      // Remove inline links
      .replace(
        /\[([^\]]*?)\][\[\(].*?[\]\)]/g,
        options.replaceLinksWithURL ? '$2' : '$1',
      )
      // Remove blockquotes
      .replace(/^(\n)?\s{0,3}>\s?/gm, '$1')
      // .replace(/(^|\n)\s{0,3}>\s?/g, '\n\n')
      // Remove reference-style links?
      .replace(/^\s{1,2}\[(.*?)\]: (\S+)( ".*?")?\s*$/g, '')
      // Remove atx-style headers
      .replace(
        /^(\n)?\s{0,}#{1,6}\s*( (.+))? +#+$|^(\n)?\s{0,}#{1,6}\s*( (.+))?$/gm,
        '$1$3$4$6',
      )
      // Remove * emphasis
      .replace(/([\*]+)(\S)(.*?\S)??\1/g, '$2$3')
      // Remove _ emphasis. Unlike *, _ emphasis gets rendered only if
      //   1. Either there is a whitespace character before opening _ and after closing _.
      //   2. Or _ is at the start/end of the string.
      .replace(/(^|\W)([_]+)(\S)(.*?\S)??\2($|\W)/g, '$1$3$4$5')
      // Remove code blocks
      .replace(/(`{3,})(.*?)\1/gm, '$2')
      // Remove inline code
      .replace(/`(.+?)`/g, '$1')
      // // Replace two or more newlines with exactly two? Not entirely sure this belongs here...
      // .replace(/\n{2,}/g, '\n\n')
      // // Remove newlines in a paragraph
      // .replace(/(\S+)\n\s*(\S+)/g, '$1 $2')
      // Replace strike through
      .replace(/~(.*?)~/g, '$1')
      // Replace `import ...` lines
      .replace(/^\s*import\s+[\s\S]+?from\s+['"].+?['"];?\s*$/gm, '')
      // Remove Markdoc tags
      .replace(/\{%[^%]*%\}|\{%\/[^%]*%\}/g, '');
  } catch (e) {
    console.error(e);
    return md;
  }
  return output;
};

const processTitle = async (
  title: string | undefined,
): Promise<string | undefined> => {
  // In some situations, the title can be an HTML/JSX tag, for
  // instance an image, or an object from the frontmatter. If it's
  // an image/figure, we extract the title/alt.
  if (typeof title === 'undefined') {
    return undefined;
  }
  if (typeof title !== 'string') {
    return JSON.stringify(title);
  }
  if (title.includes('<') && title.includes('>')) {
    // IMPORTANT: this remark code takes substantial time, and slows down
    // search results. Use only when stricly needed
    return stripMarkdown(title.trim());
  }

  return title.trim();
};

// Given a file, return its title either from the meta, or from
// the file path.
export const inferFileTitle = async (
  meta: any | undefined,
  path: string,
): Promise<string | undefined> => {
  if (meta?.title) {
    return processTitle(meta.title);
  }
  return removeFileExtension(path.split('/').slice(-1)[0]);
};

export const augmentLeadHeadingWithSlug = (
  leadHeading: FileSectionHeading | undefined,
) => {
  if (!leadHeading?.value) {
    return undefined;
  }
  const slug = leadHeading.value ? slugify(leadHeading.value) : undefined;

  return {
    ...leadHeading,
    slug,
  };
};

export const buildFileReferenceFromMatchResult = async (
  filePath: string,
  fileMeta: any | undefined,
  sourceType: Source['type'],
  sourceData: Source['data'] | null,
): Promise<FileReferenceFileData> => {
  return {
    title: await inferFileTitle(fileMeta, filePath),
    path: filePath,
    meta: fileMeta,
    source: {
      type: sourceType,
      ...(sourceData ? { data: sourceData as any } : {}),
    },
  };
};

export const buildSectionReferenceFromMatchResult = async (
  filePath: string,
  fileMeta: any | undefined,
  sourceType: Source['type'],
  sourceData: Source['data'] | null,
  sectionMeta: FileSectionMeta | undefined | null,
): Promise<FileSectionReference> => {
  return {
    file: await buildFileReferenceFromMatchResult(
      filePath,
      fileMeta,
      sourceType,
      sourceData,
    ),
    ...(sectionMeta
      ? {
          meta: {
            ...sectionMeta,
            leadHeading: augmentLeadHeadingWithSlug(sectionMeta?.leadHeading),
          },
        }
      : {}),
  };
};

const getPlatform = () => {
  if (typeof navigator === 'undefined') {
    return 'unknown';
  }
  return (
    (navigator as any)?.userAgentData?.platform ||
    navigator.userAgent.toLowerCase() ||
    navigator.platform ||
    'unknown'
  ).toLowerCase();
};

export const isMacLike = () => {
  const platform = getPlatform();
  return platform.indexOf('mac') === 0 || platform === 'iPhone';
};

export const getNameForPath = (
  sources: DbSource[],
  sourceId: DbSource['id'],
  path: string,
) => {
  const source = sources.find((s) => s.id === sourceId);
  if (!source) {
    return path;
  }
  return getFileNameForSourceAtPath(source, path);
};

export const getFileTitle = (
  file: Pick<DbFileWithoutContent, 'meta' | 'source_id' | 'path'>,
  sources: DbSource[],
) => {
  const metaTitle = (file.meta as any)?.title;
  return metaTitle && isString(metaTitle)
    ? metaTitle
    : getNameForPath(sources, file.source_id || '', file.path);
};

export const extractFrontmatter = (
  source: string,
): { [key: string]: string } => {
  try {
    const matter = grayMatter(source, {})?.matter;
    if (matter) {
      return yaml.load(matter, {
        schema: yaml.JSON_SCHEMA,
      }) as { [key: string]: string };
    }
  } catch {
    // Do nothing
  }
  return {};
};
