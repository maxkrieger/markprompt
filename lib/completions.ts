import {
  FileSectionReference,
  OpenAIEmbeddingsModelId,
} from '@markprompt/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { backOff } from 'exponential-backoff';
import { CreateEmbeddingResponse } from 'openai';

import { Database } from '@/types/supabase';
import {
  ApiError,
  DbQueryStat,
  FileSectionMatchResult,
  OpenAIErrorResponse,
  Project,
} from '@/types/types';

import { createEmbedding, createModeration } from './openai.edge';
import { InsightsType } from './stripe/tiers';
import { recordProjectTokenCount } from './tinybird';
import { stringToLLMInfo } from './utils';

export type PromptNoResponseReason = 'no_sections' | 'idk' | 'api_error';

const storePrompt = async (
  supabase: SupabaseClient<Database>,
  projectId: Project['id'],
  prompt: string | undefined,
  response: string | undefined,
  embedding: number[] | undefined,
  noResponseReason: PromptNoResponseReason | undefined,
  references: FileSectionReference[] | undefined,
  redact: boolean,
): Promise<DbQueryStat['id'] | undefined> => {
  const meta = {
    ...(references && references?.length > 0 ? { references } : {}),
    ...(typeof noResponseReason !== 'undefined' ? { noResponseReason } : {}),
  };

  const { data } = await supabase
    .from('query_stats')
    .insert([
      {
        project_id: projectId,
        ...(prompt ? { prompt } : {}),
        ...(response ? { response } : {}),
        ...(embedding ? { embedding: embedding as any } : {}),
        ...(typeof noResponseReason !== 'undefined'
          ? { no_response: !!noResponseReason }
          : {}),
        ...(Object.keys(meta).length > 0 ? { meta } : {}),
        ...(redact ? { processed_state: 'unprocessed' } : {}),
      },
    ])
    .select('id')
    .limit(1)
    .maybeSingle();

  return data?.id;
};

export const updatePrompt = async (
  supabase: SupabaseClient<Database>,
  promptId: DbQueryStat['id'],
  response: string | undefined,
  noResponseReason: PromptNoResponseReason | undefined,
) => {
  return supabase
    .from('query_stats')
    .update({
      ...(response ? { response } : {}),
      ...(typeof noResponseReason !== 'undefined'
        ? { no_response: !!noResponseReason }
        : {}),
    })
    .eq('id', promptId);
};

export const getMatchingSections = async (
  content: string,
  sectionsMatchThreshold: number | undefined,
  sectionsMatchCount: number | undefined,
  projectId: Project['id'],
  byoOpenAIKey: string | undefined,
  source: 'completions' | 'sections',
  moderate: boolean,
  supabaseAdmin: SupabaseClient<Database>,
): Promise<{
  fileSections: FileSectionMatchResult[];
  promptEmbedding: number[];
}> => {
  if (moderate) {
    // Moderate the content
    const moderationResponse = await createModeration(content, byoOpenAIKey);

    if ('error' in moderationResponse) {
      console.error(
        `[${source.toUpperCase()}] [CREATE-EMBEDDING] [${projectId}] - Error moderating content for prompt '${content}': ${
          moderationResponse.error
        }`,
      );
      throw new ApiError(
        400,
        `Content moderation failed: ${moderationResponse.error.message}`,
      );
    }

    if (moderationResponse?.results?.[0]?.flagged) {
      throw new ApiError(400, 'Flagged content');
    }
  }

  let embeddingResult:
    | CreateEmbeddingResponse
    | OpenAIErrorResponse
    | undefined = undefined;

  try {
    // Retry with exponential backoff in case of error. Typical cause is
    // too_many_requests.
    const modelId: OpenAIEmbeddingsModelId = 'text-embedding-ada-002';
    embeddingResult = await backOff(
      () => createEmbedding(content, byoOpenAIKey, modelId),
      {
        startingDelay: 10000,
        numOfAttempts: 10,
      },
    );

    if ('error' in embeddingResult) {
      throw new ApiError(400, embeddingResult.error.message);
    }

    if (!byoOpenAIKey) {
      const embeddingModelInfo = stringToLLMInfo(modelId);
      await recordProjectTokenCount(
        projectId,
        embeddingModelInfo,
        embeddingResult.usage.total_tokens,
        'sections',
      );
    }
  } catch (error) {
    console.error(
      `[${source.toUpperCase()}] [CREATE-EMBEDDING] [${projectId}] - Error creating embedding for prompt '${content}': ${error}`,
    );
    throw new ApiError(
      400,
      `Error creating embedding for prompt '${content}': ${error}`,
    );
  }

  const promptEmbedding = embeddingResult?.data?.[0]?.embedding;

  if (!promptEmbedding) {
    throw new ApiError(400, `Error creating embedding for prompt '${content}'`);
  }

  // We need to use the service_role admin supabase as these
  // requests come without auth, but the tables being queried
  // are subject to RLS.
  const {
    error,
    data: fileSections,
  }: {
    error: { message: string } | null;
    data: FileSectionMatchResult[] | null;
  } = await supabaseAdmin.rpc('match_file_sections', {
    project_id: projectId,
    // Somehow Supabase expects a string for the embeddings
    // entry (which is a vector type in the function definition),
    // so we just convert to any.
    embedding: promptEmbedding as any,
    match_threshold: sectionsMatchThreshold || 0.5,
    match_count: sectionsMatchCount || 10,
    min_content_length: 30,
  });

  if (error) {
    console.error(
      `[${source.toUpperCase()}] [LOAD-EMBEDDINGS] [${projectId}] - Error loading embeddings: ${
        error.message
      }`,
    );
    throw new ApiError(400, `Error loading embeddings: ${error.message}`);
  }

  if (!fileSections || fileSections?.length === 0) {
    console.error(
      `[${source.toUpperCase()}] [LOAD-EMBEDDINGS] [${projectId}] - No relevant sections found`,
    );
    throw new ApiError(400, 'No relevant sections found');
  }

  return { fileSections, promptEmbedding };
};

export const getHeaders = (
  references: FileSectionReference[],
  promptId: DbQueryStat['id'] | undefined = undefined,
) => {
  // Headers cannot include non-UTF-8 characters, so make sure any strings
  // we pass in the headers are properly encoded before sending.
  const headers = new Headers();
  const headerEncoder = new TextEncoder();
  const encodedHeaderData = headerEncoder
    .encode(JSON.stringify({ references, promptId }))
    .toString();

  headers.append('Content-Type', 'application/json');
  headers.append('x-markprompt-data', encodedHeaderData);
  return headers;
};

export const storePromptOrPlaceholder = async (
  supabase: SupabaseClient<Database>,
  projectId: Project['id'],
  prompt: string,
  responseText: string | undefined,
  promptEmbedding: number[] | undefined,
  errorReason: PromptNoResponseReason | undefined,
  references: FileSectionReference[],
  insightsType: InsightsType | undefined,
  // If true, only the event will be stored for global counts.
  excludeData: boolean,
  // If true, the stat will be marked as `unprocessed` and will
  // be processed to redact sensited info.
  redact: boolean,
): Promise<DbQueryStat['id'] | undefined> => {
  if (excludeData) {
    return storePrompt(
      supabase,
      projectId,
      undefined,
      undefined,
      undefined,
      errorReason,
      undefined,
      redact,
    );
  } else {
    // Store prompt always.
    // Store response in >= basic insights.
    // Store embeddings in >= advanced insights.
    // Store references in >= basic insights.
    return storePrompt(
      supabase,
      projectId,
      prompt,
      insightsType ? responseText : undefined,
      insightsType === 'advanced' ? promptEmbedding : undefined,
      errorReason,
      insightsType ? references : undefined,
      redact,
    );
  }
};
