import { SearchResult, Source } from '@markprompt/core';
import { createClient } from '@supabase/supabase-js';
import FlexSearch from 'flexsearch';
import { uniq } from 'lodash-es';
import { NextApiRequest, NextApiResponse } from 'next';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import strip from 'strip-markdown';

import { track } from '@/lib/posthog';
import {
  buildFileReferenceFromMatchResult,
  buildSectionReferenceFromMatchResult,
} from '@/lib/utils';
import { safeParseInt, safeParseJSON } from '@/lib/utils.edge';
import { Database } from '@/types/supabase';
import { FileSectionMeta } from '@/types/types';

const MAX_SEARCH_RESULTS = 20;

// Admin access to Supabase, bypassing RLS.
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

type FTSFileSectionContentResult =
  Database['public']['Functions']['fts_file_section_content']['Returns'][number];

type FTSFileTitleResult =
  Database['public']['Functions']['fts_file_title']['Returns'][number];

type Index = FlexSearch.Document<
  { id: string } & Omit<SearchResult, 'snippet'>,
  ['file', 'meta', 'content', 'matchType']
>;

type Data =
  | {
      status?: string;
      error?: string;
    }
  | {
      // TODO: replace with plain `SearchResult` when `snippet` is
      // an optional prop by default.
      data: (Omit<SearchResult, 'snippet'> & { snippet?: string })[];
      debug?: any;
    };

const allowedMethods = ['GET'];

const removeNonStandardText = async (content: string) => {
  // Remove Markdown formatting, remove leadHeading, and trim around
  // the keyword. This creates a snippet suitable for displaying in
  // search results.
  const plainText = String(
    await remark().use(remarkGfm).use(strip).process(content.trim()),
  )
    .replace(/\s+/g, ' ')
    .replace(/\\n/g, ' ');
  return plainText;
};

const createKWICSnippet = async (
  content: string,
  searchTerm: string,
  maxLength = 200,
) => {
  const plainText = await removeNonStandardText(content);
  const index = plainText.toLowerCase().indexOf(searchTerm.toLowerCase());

  if (index === -1) {
    return plainText.slice(0, maxLength);
  }

  const rawSnippet = plainText.slice(
    Math.max(0, index - Math.round(maxLength / 2)),
    index + Math.round(maxLength / 2),
  );

  const words = rawSnippet.split(/\s+/);
  if (words.length > 3) {
    return words.slice(1, words.length - 1).join(' ');
  }

  return words.join(' ');
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>,
) {
  // Preflight check
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200 });
  }

  if (!req.method || !allowedMethods.includes(req.method)) {
    res.setHeader('Allow', allowedMethods);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const params = req.body;

  let config = {};
  try {
    config = JSON.parse((params.config || '') as string);
  } catch {
    // Do nothing
  }

  // Apply rate limits, in additional to middleware rate limits.
  // const rateLimitResult = await checkSearchRateLimits({
  //   value: projectId,
  //   type: 'projectId',
  // });

  // TODO
  // if (!isRequestFromMarkprompt(req.headers.origin)) {
  //   // Search is part of the Enterprise plans when used outside of
  //   // the Markprompt dashboard.
  //   const teamStripeInfo = await getTeamTierInfo(supabaseAdmin, projectId);
  //   if (
  //     !teamStripeInfo ||
  //     !isAtLeastPro(
  //       teamStripeInfo.stripePriceId,
  //       teamStripeInfo.isEnterprisePlan,
  //     )
  //   ) {
  //     return res.status(401).json({
  //       error: `The search endpoint is only accessible on the Pro and Enterprise plans. Please contact ${process.env.NEXT_PUBLIC_SALES_EMAIL} to get set up.`,
  //     });
  //   }
  // }

  const query = req.query.query as string;
  const projectId = req.query.projectId as string;

  track(projectId, 'search', { projectId });

  const limit = Math.min(
    MAX_SEARCH_RESULTS,
    safeParseInt(req.query.limit as string, 10),
  );

  if (!query || query.trim() === '') {
    return res.status(200).json({
      data: [],
    });
  }

  // Retrieve files matching on title

  const ftsFileTitlesTs = Date.now();

  const {
    data: _fileTitleDBMatches,
  }: {
    data: FTSFileTitleResult[] | null;
    error: { message: string; code: string } | null;
  } = await supabaseAdmin.rpc('fts_file_title', {
    search_term: query,
    match_count: 20,
    project_id: projectId,
  });

  const fileTitleDBMatchesIds = (_fileTitleDBMatches || []).map(
    (f: FTSFileTitleResult) => f.id,
  );

  const ftsFileTitleDelta = Date.now() - ftsFileTitlesTs;

  // Retrieve file sections matching on content

  const ftsFileSectionContentTs = Date.now();

  const {
    data: _fileSectionContentDBMatches,
  }: {
    data: FTSFileSectionContentResult[] | null;
  } = await supabaseAdmin.rpc('fts_file_section_content', {
    search_term: query,
    match_count: 50,
    project_id: projectId,
  });

  const ftsFileSectionContentDelta = Date.now() - ftsFileSectionContentTs;

  const fileSectionContentDBMatchesIds = (
    _fileSectionContentDBMatches || []
  ).map((f) => f.file_id);

  const metadataTs = Date.now();

  const matchingFileIdsFromTitleAndContent = uniq([
    ...fileTitleDBMatchesIds,
    ...fileSectionContentDBMatchesIds,
  ]).sort();

  // Agment files and file sections with sources and meta

  const { data: _fileAugmentationData } = await supabaseAdmin
    .from('files')
    .select('id, path, meta, sources(data, type)')
    .in('id', matchingFileIdsFromTitleAndContent);

  const fileAugmentationData = await Promise.all(
    (_fileAugmentationData || []).map(async (d) => {
      const { sources, ...rest } = d;
      const source = sources as Source;
      return {
        ...rest,
        source: {
          ...(source.data ? { data: source.data } : {}),
          type: source.type,
        } as Source,
      };
    }),
  );

  const metadataDelta = Date.now() - metadataTs;

  if (!fileAugmentationData) {
    return res.status(200).json({
      debug: {
        middleware: safeParseJSON(req.query.mts as string, []),
        fts: ftsFileSectionContentDelta,
        metadata: metadataDelta,
      },
      data: [],
    });
  }

  // Rank files by title match

  const rerankTs = Date.now();

  const index: Index = new FlexSearch.Document({
    cache: 100,
    tokenize: 'full',
    document: {
      id: 'id',
      index: [
        {
          field: 'file:meta:title',
          tokenize: 'forward',
          optimize: true,
          resolution: 9,
        },
        {
          field: 'content',
          tokenize: 'strict',
          optimize: true,
          resolution: 6,
        },
        {
          field: 'meta:leadHeading:value',
          tokenize: 'forward',
          optimize: true,
          resolution: 8,
        },
      ],
      store: ['file', 'meta', 'content', 'matchType'],
    },
    context: {
      resolution: 9,
      depth: 3,
      bidirectional: true,
    },
  });

  const fileTitles: string[] = [];

  for (const match of _fileTitleDBMatches || []) {
    const fileData = fileAugmentationData.find((f) => f.id === match.id);
    if (fileData) {
      const fileReference = await buildFileReferenceFromMatchResult(
        fileData.path,
        fileData.meta,
        fileData.source.type,
        fileData.source.data,
      );

      if (fileReference.title) {
        fileTitles.push(fileReference.title);
      }

      index.add({
        id: `${match.id}`,
        matchType: 'title',
        file: fileReference,
      });
    }
  }

  for (const match of _fileSectionContentDBMatches || []) {
    const fileData = fileAugmentationData.find((f) => f.id === match.file_id);
    if (!fileData) {
      continue;
    }
    // Ignore sections which are duplicates of files with title matches. We
    // consider it a duplicate if it has a heading of depth 1 equal to a
    // file title.
    const sectionMeta = match.meta as FileSectionMeta | undefined;
    const leadHeading = sectionMeta?.leadHeading;
    if (
      leadHeading?.depth === 1 &&
      leadHeading.value &&
      fileTitles.includes(leadHeading.value)
    ) {
      continue;
    }

    const matchType = leadHeading?.value
      ?.toLowerCase()
      .includes(query.toLowerCase())
      ? 'leadHeading'
      : 'content';

    const sectionReference = await buildSectionReferenceFromMatchResult(
      fileData.path,
      fileData.meta,
      fileData.source.type,
      fileData.source.data,
      sectionMeta,
    );

    // At this stage, we remove all non-standard text, to ensure
    // we only search parts that will actually be shown to the user.
    // For instance, searching `react` might return code snippets
    // include React imports, but code is removed from the search
    // results in the KWIC code below, so it is unintuitive to include
    // them.
    const content = await removeNonStandardText(match.content);
    index.add({
      id: `${match.id}`,
      matchType,
      ...sectionReference,
      content,
    });
  }

  // Return at most `MAX_FILE_TITLE_MATCHES` file title matches
  const rankedResults = (
    index.search<true>(query, limit, {
      enrich: true,
      suggest: true,
    })[0]?.result || []
  )
    .slice(0, limit)
    .map((r) => r.doc);

  const rerankDelta = Date.now() - rerankTs;

  const includeSectionContent = req.query.includeSectionContent === 'true';

  const results = await Promise.all(
    rankedResults.map(async (r) => {
      const { content, ...rest } = r;
      return {
        ...rest,
        ...(content && !!includeSectionContent ? { content } : {}),
        ...(content
          ? { snippet: await createKWICSnippet(content, query) }
          : {}),
      };
    }),
  );

  return res.status(200).json({
    debug: {
      middleware: safeParseJSON(req.query.mts as string, []),
      ftsFileTitle: ftsFileTitleDelta,
      ftsFileSectionContent: ftsFileSectionContentDelta,
      metadata: metadataDelta,
      rerank: rerankDelta,
    },
    data: results,
  });
}
