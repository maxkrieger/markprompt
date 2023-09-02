// Utilities that run in non-edge runtimes, such as the browser or Node.

import grayMatter from 'gray-matter';
import yaml from 'js-yaml';
import { isString } from 'lodash-es';

import { DbFileWithoutContent, DbSource } from '@/types/types';

import { getNameForPath } from './utils.nodeps';

export const extractFrontmatter = (source: string): Record<string, string> => {
  try {
    const matter = grayMatter(source, {})?.matter;
    if (matter) {
      return yaml.load(matter, {
        schema: yaml.JSON_SCHEMA,
      }) as Record<string, string>;
    }
  } catch {
    // Do nothing
  }
  return {};
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
