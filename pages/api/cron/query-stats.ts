import { stripIndent } from 'common-tags';
import type { NextApiRequest, NextApiResponse } from 'next';

import {
  APPROX_CHARS_PER_TOKEN,
  CONTEXT_TOKENS_CUTOFF_GPT_3_5_TURBO,
} from '@/lib/constants';
import {
  createServiceRoleSupabaseClient,
  getProjectConfigData,
} from '@/lib/supabase';
import { recordProjectTokenCount } from '@/lib/tinybird';
import { getCompletionsResponseText, getCompletionsUrl } from '@/lib/utils';
import { safeParseInt } from '@/lib/utils.edge';
import {
  OpenAIModelIdWithType,
  Project,
  QueryStatsProcessingResponseData,
  geLLMInfoFromModel,
} from '@/types/types';

type Data =
  | {
      status?: string;
      error?: string;
    }
  | QueryStatsProcessingResponseData;

const allowedMethods = ['GET'];

// Admin access to Supabase, bypassing RLS.
const supabaseAdmin = createServiceRoleSupabaseClient();

interface QueryStatData {
  id: string | null;
  decrypted_prompt: string | null;
  decrypted_response: string | null;
}

// Ensure that no queries alone are too large for the prompt. If one
// such query exists.

const MAX_CONTENT_SIZE =
  CONTEXT_TOKENS_CUTOFF_GPT_3_5_TURBO * 0.45 * APPROX_CHARS_PER_TOKEN;

const trimContent = (content: string) => {
  return content.slice(0, MAX_CONTENT_SIZE);
};

const redactSensitiveInfo = async (
  projectId: Project['id'],
  content: string,
) => {
  const model: OpenAIModelIdWithType = {
    type: 'chat_completions',
    value: 'gpt-3.5-turbo',
  };

  const { byoOpenAIKey } = await getProjectConfigData(supabaseAdmin, projectId);

  const payload = {
    model: model.value,
    temperature: 0.1,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    max_tokens: 2048,
    stream: false,
    n: 1,
    messages: [
      {
        role: 'user',
        content:
          stripIndent(`You are an information security expert. The following is a section of text. Remove any sensitive information, such as person names, phone numbers and specific figures. When removing a piece of info, replace it with [REDACTED]. You should be very aggressive in removing information. If in doubt, redact it away.

        ---
        ${trimContent(content)}
        ---

        Redacted version:`),
      },
    ],
  };

  const res = await fetch(getCompletionsUrl(model), {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${
        (byoOpenAIKey || process.env.OPENAI_API_KEY) ?? ''
      }`,
    },
    method: 'POST',
    body: JSON.stringify(payload),
  });

  const json = await res.json();

  if (json.error) {
    throw new Error(`${JSON.stringify(json)}`);
  }

  const tokenCount = safeParseInt(json.usage.total_tokens, 0);
  await recordProjectTokenCount(
    projectId,
    geLLMInfoFromModel(model),
    tokenCount,
    'query-stats',
  );

  return getCompletionsResponseText(json, model)
    .trim()
    .replace(/^---/, '')
    .replace(/---$/, '')
    .trim();
};

const processProjectQueryStats = async (
  projectId: Project['id'],
): Promise<{
  status: 'processed_success' | 'no_more_stats_to_process' | 'error';
  message?: string;
  processed?: number;
  errored?: number;
}> => {
  const { data: queries }: { data: QueryStatData[] | null } =
    await supabaseAdmin
      .from('decrypted_query_stats')
      .select('id,decrypted_prompt,decrypted_response,processed_state')
      .eq('project_id', projectId)
      .eq('processed_state', 'unprocessed')
      .order('created_at', { ascending: false })
      .limit(10);

  if (!queries || queries.length === 0) {
    return { status: 'no_more_stats_to_process' };
  }

  let processed = 0;
  let errored = 0;

  // We just go until we time out.
  for (const query of queries) {
    try {
      if (!query.decrypted_prompt) {
        throw new Error('No prompt in query.');
      }

      const redactedPrompt = await redactSensitiveInfo(
        projectId,
        query.decrypted_prompt,
      );

      let redactedResponse: string | undefined = undefined;
      if (query.decrypted_response) {
        redactedResponse = await redactSensitiveInfo(
          projectId,
          query.decrypted_response,
        );
      }

      await supabaseAdmin
        .from('query_stats')
        .update({
          processed_state: 'processed',
          prompt: redactedPrompt,
          ...(redactedResponse ? { response: redactedResponse } : {}),
        })
        .eq('id', query.id);
      processed += 1;
    } catch (e) {
      errored += 1;
      await supabaseAdmin
        .from('query_stats')
        .update({ processed_state: 'errored' })
        .eq('id', query.id);
    }
  }

  return { status: 'processed_success', processed, errored };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>,
) {
  if (!req.method || !allowedMethods.includes(req.method)) {
    res.setHeader('Allow', allowedMethods);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const projectId = req.query.projectId as Project['id'];
  if (projectId) {
    const processed = await processProjectQueryStats(projectId);
    if (processed.status === 'error') {
      return res.status(400).json({
        error: `Error processing stats: ${processed.message}`,
      });
    } else if (processed.status === 'no_more_stats_to_process') {
      return res.status(200).json({ allProcessed: true });
    } else {
      return res.status(200).send({
        status: 'ok',
        processed: processed.processed,
        errored: processed.errored,
      });
    }
  } else {
    // First in line are projects whose unprocessed prompts are oldest.
    const { data } = await supabaseAdmin
      .from('v_distinct_unprocessed_query_stats_project_ids')
      .select('project_id')
      .limit(20);

    if (!data) {
      return res.status(200).json({ allProcessed: true });
    }

    let totalProcessed = 0;
    for (const { project_id } of data) {
      if (project_id) {
        const processResponse = await processProjectQueryStats(project_id);
        if (
          processResponse.status === 'processed_success' &&
          processResponse.processed
        ) {
          totalProcessed += processResponse.processed;
        }
      }
    }

    return res.status(200).send({ status: 'ok', processed: totalProcessed });
  }
}
