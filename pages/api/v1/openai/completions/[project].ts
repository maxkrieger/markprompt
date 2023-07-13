import { FileSectionReference } from '@markprompt/core';
import { createClient } from '@supabase/supabase-js';
import { stripIndent } from 'common-tags';
import {
  createParser,
  ParsedEvent,
  ReconnectInterval,
} from 'eventsource-parser';
import type { NextRequest } from 'next/server';

import {
  CONTEXT_TOKENS_CUTOFF,
  I_DONT_KNOW,
  MAX_PROMPT_LENGTH,
  STREAM_SEPARATOR,
} from '@/lib/constants';
import { track } from '@/lib/posthog';
import { DEFAULT_PROMPT_TEMPLATE } from '@/lib/prompt';
import { checkCompletionsRateLimits } from '@/lib/rate-limits';
import { getMatchingSections, storePrompt } from '@/lib/sections';
import { canUseCustomModelConfig } from '@/lib/stripe/tiers';
import { getProjectConfigData, getTeamTierInfo } from '@/lib/supabase';
import { recordProjectTokenCount } from '@/lib/tinybird';
import {
  buildSectionReferenceFromMatchResult,
  getCompletionsResponseText,
  getCompletionsUrl,
  stringToLLMInfo,
} from '@/lib/utils';
import { isRequestFromMarkprompt, safeParseInt } from '@/lib/utils.edge';
import { Database } from '@/types/supabase';
import {
  ApiError,
  FileSectionMatchResult,
  FileSectionMeta,
  OpenAIModelIdWithType,
  Project,
} from '@/types/types';

export const config = {
  runtime: 'edge',
};

const isIDontKnowResponse = (
  responseText: string,
  iDontKnowMessage: string,
) => {
  return !responseText || responseText.endsWith(iDontKnowMessage);
};

const getPayload = (
  prompt: string,
  model: OpenAIModelIdWithType,
  temperature: number,
  topP: number,
  frequencyPenalty: number,
  presencePenalty: number,
  maxTokens: number,
  stream: boolean,
) => {
  const payload = {
    model: model.value,
    temperature,
    top_p: topP,
    frequency_penalty: frequencyPenalty,
    presence_penalty: presencePenalty,
    max_tokens: maxTokens,
    stream,
    n: 1,
  };
  switch (model.type) {
    case 'chat_completions': {
      return {
        ...payload,
        messages: [{ role: 'user', content: prompt }],
      };
    }
    default: {
      return { ...payload, prompt };
    }
  }
};

const getChunkText = (response: any, model: OpenAIModelIdWithType) => {
  switch (model.type) {
    case 'chat_completions': {
      return response.choices[0].delta.content;
    }
    default: {
      return response.choices[0].text;
    }
  }
};

// Admin access to Supabase, bypassing RLS.
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

const allowedMethods = ['POST'];

const buildFullPrompt = (
  template: string,
  context: string,
  prompt: string,
  iDontKnowMessage: string,
  contextTemplateKeyword: string,
  promptTemplateKeyword: string,
  iDontKnowTemplateKeyword: string,
  // If the template does not contain the {{CONTEXT}} keyword, we inject
  // the context by default. This can be prevented by setting the
  // `doNotInjectContext` variable to true.
  doNotInjectContext = false,
  // Same with query
  doNotInjectPrompt = false,
) => {
  let _template = template.replace(
    iDontKnowTemplateKeyword,
    iDontKnowMessage || I_DONT_KNOW,
  );

  if (template.includes(contextTemplateKeyword)) {
    _template = _template.replace(contextTemplateKeyword, context);
  } else if (!doNotInjectContext) {
    _template = `Here is some context which might contain valuable information to answer the question. It is in the form of sections preceded by a section id:\n\n---\n\n${context}\n\n---\n\n${_template}`;
  }

  if (template.includes(promptTemplateKeyword)) {
    _template = _template.replace(promptTemplateKeyword, prompt);
  } else if (!doNotInjectPrompt) {
    _template = `${_template}\n\nPrompt: ${prompt}\n`;
  }

  return stripIndent(_template);
};

const isFalsy = (param: any) => {
  if (typeof param === 'string') {
    return param === 'false' || param === '0';
  } else if (typeof param === 'number') {
    return param === 0;
  } else {
    return param === false;
  }
};

export default async function handler(req: NextRequest) {
  // Preflight check
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200 });
  }

  if (!req.method || !allowedMethods.includes(req.method)) {
    return new Response(`Method ${req.method} Not Allowed`, { status: 405 });
  }

  try {
    let params = await req.json();

    console.log('[COMPLETIONS] Params:', JSON.stringify(params, null, 2));

    const modelInfo = stringToLLMInfo(params?.model);
    const prompt = (params.prompt as string)?.substring(0, MAX_PROMPT_LENGTH);
    const iDontKnowMessage =
      (params.i_dont_know_message as string) || // v1
      (params.iDontKnowMessage as string) || // v0
      I_DONT_KNOW;
    let stream = true;
    if (isFalsy(params.stream)) {
      stream = false;
    }

    const { pathname, searchParams } = new URL(req.url);

    const lastPathComponent = pathname.split('/').slice(-1)[0];
    let projectIdParam = undefined;
    // TODO: need to investigate the difference between a request
    // from the dashboard (2nd case here) and a request from
    // an external origin (1st case here).
    if (lastPathComponent === 'completions') {
      projectIdParam = searchParams.get('project');
    } else {
      projectIdParam = pathname.split('/').slice(-1)[0];
    }

    if (!projectIdParam) {
      console.error(`[COMPLETIONS] [${pathname}] Project not found`);
      return new Response('Project not found', { status: 400 });
    }

    if (!prompt) {
      console.error(`[COMPLETIONS] [${projectIdParam}] No prompt provided`);
      return new Response('No prompt provided', { status: 400 });
    }

    const projectId = projectIdParam as Project['id'];

    // Apply rate limits, in additional to middleware rate limits.
    const rateLimitResult = await checkCompletionsRateLimits({
      value: projectId,
      type: 'projectId',
    });

    if (!rateLimitResult.result.success) {
      console.error(`[COMPLETIONS] [RATE-LIMIT] [${projectId}] IP: ${req.ip}`);
      return new Response('Too many requests', { status: 429 });
    }

    if (!isRequestFromMarkprompt(req.headers.get('origin'))) {
      // Custom model configurations are part of the Pro and Enterprise plans
      // when used outside of the Markprompt dashboard.
      const teamTierInfo = await getTeamTierInfo(supabaseAdmin, projectId);
      if (!teamTierInfo || !canUseCustomModelConfig(teamTierInfo)) {
        // Custom model configurations are part of the Pro and Enterprise plans.
        params = {
          ...params,
          promptTemplate: undefined,
          temperature: undefined,
          topP: undefined,
          frequencyPenalty: undefined,
          presencePenalty: undefined,
          maxTokens: undefined,
          sectionsMatchCount: undefined,
          sectionsMatchThreshold: undefined,
        };
      }
    }

    const { byoOpenAIKey } = await getProjectConfigData(
      supabaseAdmin,
      projectId,
    );

    const sanitizedQuery = prompt.trim().replaceAll('\n', ' ');

    const sectionsTs = Date.now();

    let fileSections: FileSectionMatchResult[] = [];
    let promptEmbedding: number[] | undefined = undefined;
    try {
      const sectionsResponse = await getMatchingSections(
        sanitizedQuery,
        prompt,
        params.sectionsMatchThreshold,
        params.sectionsMatchCount,
        projectId,
        byoOpenAIKey,
        'completions',
        supabaseAdmin,
      );
      fileSections = sectionsResponse.fileSections;
      promptEmbedding = sectionsResponse.promptEmbedding;
    } catch (e) {
      if (e instanceof ApiError) {
        return new Response(e.message, { status: e.code });
      } else {
        return new Response(`${e}`, { status: 400 });
      }
    }

    const sectionsDelta = Date.now() - sectionsTs;

    track(projectId, 'generate completions', { projectId });

    // const { completionsTokensCount } = await getTokenCountsForProject(projectId);

    // const maxTokenLimit = 500000;
    // if (completionsTokensCount > maxTokenLimit) {
    //   return new Response('Completions token limit exceeded.', {
    //     status: 429,
    //   });
    // }

    const _prepareSectionText = (text: string) => {
      return text.replace(/\n/g, ' ').trim();
    };

    let numTokens = 0;
    let contextText = '';
    const references: FileSectionReference[] = [];

    for (const section of fileSections) {
      numTokens += section.file_sections_token_count;

      if (numTokens >= CONTEXT_TOKENS_CUTOFF) {
        break;
      }

      contextText += `Section id: ${
        section.files_path
      }\n\n${_prepareSectionText(section.file_sections_content)}\n---\n`;

      const reference = await buildSectionReferenceFromMatchResult(
        section.files_path,
        section.files_meta,
        section.source_type,
        section.source_data,
        section.file_sections_meta as FileSectionMeta,
      );
      references.push(reference);
    }

    const referencePaths = references.map((r) => r.file.path);

    const fullPrompt = buildFullPrompt(
      (params.promptTemplate as string) || DEFAULT_PROMPT_TEMPLATE.template!,
      contextText,
      sanitizedQuery,
      iDontKnowMessage,
      params.contextTag || '{{CONTEXT}}',
      params.promptTag || '{{PROMPT}}',
      params.idkTag || '{{I_DONT_KNOW}}',
      !!params.doNotInjectContext,
      !!params.doNotInjectPrompt,
    );

    const payload = getPayload(
      fullPrompt,
      modelInfo.model,
      params.temperature || 0.1,
      params.topP || 1,
      params.frequencyPenalty || 0,
      params.presencePenalty || 0,
      params.maxTokens || 500,
      stream,
    );
    const url = getCompletionsUrl(modelInfo.model);

    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${
          (byoOpenAIKey || process.env.OPENAI_API_KEY) ?? ''
        }`,
      },
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const debugInfo = {
      fullPrompt,
      ts: {
        sections: sectionsDelta,
      },
    };

    if (!stream) {
      if (!res.ok) {
        const message = await res.text();
        await storePrompt(
          supabaseAdmin,
          projectId,
          prompt,
          null,
          promptEmbedding,
          true,
          references,
        );
        return new Response(
          `Unable to retrieve completions response: ${message}`,
          { status: 400 },
        );
      } else {
        const json = await res.json();
        // TODO: track token count
        const tokenCount = safeParseInt(json.usage.total_tokens, 0);
        await recordProjectTokenCount(
          projectId,
          modelInfo,
          tokenCount,
          'completions',
        );
        const text = getCompletionsResponseText(json, modelInfo.model);
        await storePrompt(
          supabaseAdmin,
          projectId,
          prompt,
          text,
          promptEmbedding,
          isIDontKnowResponse(text, iDontKnowMessage),
          references,
        );

        const headers = new Headers();
        headers.append('Content-Type', 'application/json');
        return new Response(
          JSON.stringify({
            text,
            references,
            debugInfo,
          }),
          {
            status: 200,
            headers,
          },
        );
      }
    }

    let counter = 0;

    // All the text associated with this query, to estimate token
    // count.
    let responseText = '';
    let didSendHeader = false;

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        function onParse(event: ParsedEvent | ReconnectInterval) {
          if (event.type === 'event') {
            const data = event.data;
            if (data === '[DONE]') {
              return;
            }

            try {
              if (!didSendHeader) {
                // Done sending chunks, send references. This will be
                // deprecated, in favor of passing the full reference
                // info in the response header.
                const queue = encoder.encode(
                  `${JSON.stringify(referencePaths || [])}${STREAM_SEPARATOR}`,
                );
                controller.enqueue(queue);
                didSendHeader = true;
              }
              const json = JSON.parse(data);
              const text = getChunkText(json, modelInfo.model);
              if (text?.length > 0) {
                responseText += text;
              }
              if (counter < 2 && (text?.match(/\n/) || []).length) {
                // Prefix character (e.g. "\n\n"), do nothing
                return;
              }
              const queue = encoder.encode(text);
              controller.enqueue(queue);
              counter++;
            } catch (e) {
              controller.error(e);
            }
          }
        }

        const parser = createParser(onParse);

        for await (const chunk of res.body as any) {
          parser.feed(decoder.decode(chunk));
        }

        // Estimate the number of tokens used by this request.
        // TODO: GPT3Tokenizer is slow, especially on large text. Use the
        // approximated value instead (1 token ~= 4 characters).
        // const tokenizer = new GPT3Tokenizer({ type: 'gpt3' });
        // const allTextEncoded = tokenizer.encode(allText);
        // const tokenCount = allTextEncoded.text.length;
        const allText = fullPrompt + responseText;
        const estimatedTokenCount = Math.round(allText.length / 4);

        if (!byoOpenAIKey) {
          await recordProjectTokenCount(
            projectId,
            modelInfo,
            estimatedTokenCount,
            'completions',
          );
        }

        await storePrompt(
          supabaseAdmin,
          projectId,
          prompt,
          responseText,
          promptEmbedding,
          isIDontKnowResponse(responseText, iDontKnowMessage),
          references,
        );

        // We're done, wind down
        parser.reset();
        controller.close();
      },
    });

    // Headers cannot include non-UTF-8 characters, so make sure any strings
    // we pass in the headers are properly encoded before sending.
    const headerEncoder = new TextEncoder();
    const encodedReferences = headerEncoder
      .encode(JSON.stringify({ references }))
      .toString();
    // const encodedDebugInfo = headerEncoder
    //   .encode(JSON.stringify(debugInfo))
    //   .toString();

    const headers = new Headers();
    headers.append('x-markprompt-data', encodedReferences);
    // headers.append('x-markprompt-debug-info', encodedDebugInfo);

    return new Response(readableStream, { headers });
  } catch (e) {
    return new Response(
      `Error processing ${req.method} request: ${JSON.stringify(e)}`,
      { status: 500 },
    );
  }
}
