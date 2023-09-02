import { SearchResult, Source } from '@markprompt/core';
import FlexSearch from 'flexsearch';
import { uniq } from 'lodash-es';
import { NextApiRequest, NextApiResponse } from 'next';
import { isPresent } from 'ts-is-present';

import { track } from '@/lib/posthog';
import { createServiceRoleSupabaseClient } from '@/lib/supabase';
import {
  buildFileReferenceFromMatchResult,
  buildSectionReferenceFromMatchResult,
  inferFileTitle,
  stripMarkdown,
} from '@/lib/utils';
import { safeParseInt, safeParseJSON } from '@/lib/utils.edge';
import { Database } from '@/types/supabase';
import { FileSectionMeta } from '@/types/types';

const MAX_SEARCH_RESULTS = 20;

// Admin access to Supabase, bypassing RLS.
const supabaseAdmin = createServiceRoleSupabaseClient();

type FTSFileSectionContentResult =
  Database['public']['Functions']['fts_file_section_content']['Returns'][number];

type FTSFileTitleResult =
  Database['public']['Functions']['fts_file_title']['Returns'][number];

type Index = FlexSearch.Document<
  // { id: string } & SearchResult,
  {
    id: string;
    fileId: string;
    matchType: SearchResult['matchType'];
    fileTitle?: string | undefined;
    leadHeading?: string | undefined;
    content?: string | undefined;
  },
  ['fileId', 'matchType', 'fileTitle', 'leadHeading', 'content']
>;

type Data =
  | {
      status?: string;
      error?: string;
    }
  | {
      data: SearchResult[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      debug?: any;
    };

const allowedMethods = ['GET'];

const removeNonStandardText = async (content: string) => {
  // Remove Markdown formatting, remove leadHeading, and trim around
  // the keyword. This creates a snippet suitable for displaying in
  // search results.
  const plainText = stripMarkdown(content.trim())
    // const plainText = String(
    //   await remark().use(remarkGfm).use(strip).process(content.trim()),
    // )
    .replace(/\s+/g, ' ')
    .replace(/\\n/g, ' ')
    .replace(/\\/g, '');
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
  const totalTs = Date.now();

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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  const fileAugmentationData = (_fileAugmentationData || []).map((d) => {
    const { sources, ...rest } = d;
    const source = sources as Source;
    return {
      ...rest,
      source: {
        ...(source.data ? { data: source.data } : {}),
        type: source.type,
      } as Source,
    };
  });

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

  const rerankIndexTs = Date.now();

  const index: Index = new FlexSearch.Document({
    cache: 100,
    preset: 'performance',
    document: {
      id: 'id',
      index: [
        {
          field: 'fileTitle',
          tokenize: 'forward',
          resolution: 9,
        },
        {
          field: 'leadHeading',
          tokenize: 'forward',
          resolution: 8,
        },
        {
          field: 'content',
          tokenize: 'full',
          resolution: 5,
        },
      ],
      store: ['fileId', 'matchType', 'fileTitle', 'leadHeading', 'content'],
    },
    context: {
      resolution: 9,
      depth: 3,
      bidirectional: true,
    },
  });

  const rerankIndexDelta = Date.now() - rerankIndexTs;

  const rerankAddFilesTs = Date.now();

  const fileTitles: string[] = [];

  for (const match of _fileTitleDBMatches || []) {
    const fileData = fileAugmentationData.find((f) => f.id === match.id);
    if (fileData) {
      const title = await inferFileTitle(fileData.meta, fileData.path);

      if (title) {
        fileTitles.push(title);
      }

      index.add({
        id: String(match.id),
        fileId: String(match.id),
        matchType: 'title',
        fileTitle: title,
      });
    }
  }

  const rerankAddFilesDelta = Date.now() - rerankAddFilesTs;

  const rerankAddSectionsTs = Date.now();

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

    // At this stage, we remove all non-standard text, to ensure
    // we only search parts that will actually be shown to the user.
    // For instance, searching `react` might return code snippets
    // including React imports, which adds unnecessary noise.
    const content = await removeNonStandardText(match.content);

    index.add({
      id: String(match.id),
      fileId: String(match.file_id),
      matchType,
      content,
      ...(sectionMeta?.leadHeading?.value
        ? { leadHeading: sectionMeta?.leadHeading?.value }
        : {}),
    });
  }

  const matchGroups = index.search<true>(query, limit, {
    enrich: true,
    suggest: true,
  });
  let c = 0;
  const rankedResults = [];
  const storedMatchIds: string[] = [];
  for (const matchGroup of matchGroups) {
    for (const result of matchGroup.result) {
      if (c > limit) {
        break;
      }
      const matchId = String(result.id);
      if (storedMatchIds.includes(matchId)) {
        continue;
      }
      storedMatchIds.push(matchId);
      rankedResults.push(result);
      c++;
    }
  }

  const rerankAddSectionsDelta = Date.now() - rerankAddSectionsTs;

  const rerankDelta = Date.now() - rerankTs;

  const includeSectionContent = req.query.includeSectionContent === 'true';

  const kwicTs = Date.now();

  // We add as little info as possible to the indexes. In particular, we
  // don't build the full section references during FlexSearch search,
  // as these operations are expensive: some take >20ms, which is not ideal
  // when we need to process all 50 results returning from the database query.
  // Only when we have the final result set, with `limit` imposed, do we
  // build the full SearchResult object.
  const results: SearchResult[] = (
    await Promise.all(
      rankedResults.map(async (r) => {
        if (r.doc.matchType === 'title') {
          const matchId = String(r.id);
          const fileDataId = (_fileTitleDBMatches || []).find(
            (m) => String(m.id) === matchId,
          );
          const fileData = fileAugmentationData.find(
            (f) => f.id === fileDataId?.id,
          );
          if (!fileData) {
            return undefined;
          }
          const fileReference = await buildFileReferenceFromMatchResult(
            fileData.path,
            fileData.meta,
            fileData.source.type,
            fileData.source.data,
          );

          return {
            matchType: r.doc.matchType,
            file: fileReference,
          };
        } else {
          const fileData = fileAugmentationData.find(
            (f) => String(f.id) === r.doc.fileId,
          );
          if (!fileData) {
            return undefined;
          }
          const fileSectionData = (_fileSectionContentDBMatches || []).find(
            (m) => String(m.id) === String(r.id),
          );

          if (!fileSectionData) {
            return undefined;
          }

          const content = r.doc.content;

          const sectionReference = await buildSectionReferenceFromMatchResult(
            fileData.path,
            fileData.meta,
            fileData.source.type,
            fileData.source.data,
            fileSectionData.meta as FileSectionMeta,
          );

          return {
            matchType: r.doc.matchType,
            ...sectionReference,
            ...(content && !!includeSectionContent ? { content } : {}),
            ...(content
              ? { snippet: await createKWICSnippet(content, query) }
              : {}),
          };
        }
      }),
    )
  ).filter(isPresent);

  const kwicDelta = Date.now() - kwicTs;

  return res.status(200).json({
    debug: {
      total: Date.now() - totalTs,
      middleware: safeParseJSON(req.query.mts as string, []),
      ftsFileTitle: ftsFileTitleDelta,
      ftsFileSectionContent: ftsFileSectionContentDelta,
      metadata: metadataDelta,
      rerank: {
        total: rerankDelta,
        index: rerankIndexDelta,
        addFiles: rerankAddFilesDelta,
        addSections: rerankAddSectionsDelta,
      },
      kwic: kwicDelta,
    },
    data: results,
  });
}
