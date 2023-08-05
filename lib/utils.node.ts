// Node-dependent utilities. Cannot run on edge runtimes or in the browser.
import fs from 'fs';
import type { Readable } from 'node:stream';

import unzip from 'unzipper';

import { FileData } from '@/types/types';

import { shouldIncludeFileWithPath } from './utils';

export const extractFileDataEntriesFromZip = async (
  path: string,
  includeGlobs: string[],
  excludeGlobs: string[],
): Promise<FileData[]> => {
  const filesWithPath: FileData[] = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream(path)
      .pipe(unzip.Parse())
      .on('entry', async (entry: any) => {
        if (
          entry.type !== 'File' ||
          !shouldIncludeFileWithPath(
            entry.path,
            includeGlobs,
            excludeGlobs,
            false,
          )
        ) {
          // Ignore dotfiles, e.g. '.DS_Store'
          return;
        }
        const content = await entry.buffer();
        filesWithPath.push({
          path: entry.path,
          name: entry.path.split('/').slice(-1)[0],
          content: content.toString(),
        });
        entry.autodrain();
      })
      .on('error', reject)
      .on('finish', resolve);
  });

  return filesWithPath;
};

export const getBufferFromReadable = async (readable: Readable) => {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
};
