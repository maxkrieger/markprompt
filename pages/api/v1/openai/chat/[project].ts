import {
  FileSectionReference,
  OpenAIChatCompletionsModelId,
} from '@markprompt/core';
import { createClient } from '@supabase/supabase-js';
import { stripIndent } from 'common-tags';
import {
  createParser,
  ParsedEvent,
  ReconnectInterval,
} from 'eventsource-parser';
import type { NextRequest } from 'next/server';
import {
  ChatCompletionRequestMessage,
  ChatCompletionRequestMessageRoleEnum,
} from 'openai';

import {
  getHeaders,
  getMatchingSections,
  storePromptOrPlaceholder,
  updatePrompt,
} from '@/lib/completions';
import { modelConfigFields } from '@/lib/config';
import { I_DONT_KNOW, STREAM_SEPARATOR } from '@/lib/constants';
import { getChatCompletionModelMaxTokenCount } from '@/lib/openai.edge';
import { track } from '@/lib/posthog';
import { DEFAULT_SYSTEM_PROMPT } from '@/lib/prompt';
import { checkCompletionsRateLimits } from '@/lib/rate-limits';
import {
  canUseCustomModelConfig,
  getAccessibleInsightsType,
  InsightsType,
} from '@/lib/stripe/tiers';
import { getProjectConfigData, getTeamTierInfo } from '@/lib/supabase';
import {
  buildSectionReferenceFromMatchResult,
  getChatCompletionsResponseText,
  getChatCompletionsUrl,
  stringToLLMInfo,
} from '@/lib/utils';
import { isRequestFromMarkprompt } from '@/lib/utils.edge';
import {
  approximatedTokenCount,
  isFalsyQueryParam,
  isTruthyQueryParam,
} from '@/lib/utils.nodeps';
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

function isChatMessages(data: unknown): data is ChatCompletionRequestMessage[] {
  if (!data) return false;
  if (!Array.isArray(data)) return false;
  return data.every((d) => {
    return (
      typeof d === 'object' &&
      d !== null &&
      'content' in d &&
      typeof d.content === 'string' &&
      'role' in d &&
      (d.role === 'user' || d.role === 'assistant')
    );
  });
}

const isIDontKnowResponse = (
  responseText: string,
  iDontKnowMessage: string,
) => {
  return !responseText || responseText.endsWith(iDontKnowMessage);
};

const getSupportedChatModelValueOrFallback = (
  model: OpenAIModelIdWithType,
): OpenAIChatCompletionsModelId => {
  if (model.value !== 'gpt-3.5-turbo' && model.value !== 'gpt-4') {
    return 'gpt-3.5-turbo';
  }
  return model.value;
};

const getPayload = (
  messages: ChatCompletionRequestMessage[],
  modelId: OpenAIChatCompletionsModelId,
  temperature: number,
  topP: number,
  frequencyPenalty: number,
  presencePenalty: number,
  maxTokens: number,
  stream: boolean,
) => {
  return {
    model: modelId,
    temperature,
    top_p: topP,
    frequency_penalty: frequencyPenalty,
    presence_penalty: presencePenalty,
    max_tokens: maxTokens,
    stream,
    n: 1,
    messages,
  };
};

const getChunkText = (response: any) => {
  return response.choices[0].delta.content;
};

// Admin access to Supabase, bypassing RLS.
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

const allowedMethods = ['POST'];

const buildInitMessages = (
  systemPrompt: string,
  contextSections: string,
  doNotInjectContext = false,
): ChatCompletionRequestMessage[] => {
  const initMessages: ChatCompletionRequestMessage[] = [
    {
      role: ChatCompletionRequestMessageRoleEnum.System,
      content: systemPrompt,
    },
  ];

  if (!doNotInjectContext) {
    initMessages.push({
      role: ChatCompletionRequestMessageRoleEnum.System,
      content: stripIndent`Here is a set of context sections which may contain valuable information to answer the question. It is in the form of sections preceded by a section id. You must not mention that the answer is based on this context.\n\n${contextSections}`,
    });
  }

  return initMessages;
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

    const messages = params.messages;

    const iDontKnowMessage =
      (params.i_dont_know_message as string) || // v1
      (params.iDontKnowMessage as string) || // v0
      I_DONT_KNOW;

    let stream = true;
    if (isFalsyQueryParam(params.stream)) {
      stream = false;
    }

    let excludeFromInsights = false;
    if (isTruthyQueryParam(params.excludeFromInsights)) {
      excludeFromInsights = true;
    }

    let redact = false;
    if (isTruthyQueryParam(params.redact)) {
      redact = true;
    }

    const { pathname, searchParams } = new URL(req.url);

    const lastPathComponent = pathname.split('/').slice(-1)[0];
    let projectIdParam = undefined;
    // TODO: need to investigate the difference between a request
    // from the dashboard (2nd case here) and a request from
    // an external origin (1st case here).
    if (lastPathComponent === 'chat') {
      projectIdParam = searchParams.get('project');
    } else {
      projectIdParam = pathname.split('/').slice(-1)[0];
    }

    if (!projectIdParam) {
      console.error(`[CHAT] [${pathname}] Project not found`);
      return new Response('Project not found', { status: 400 });
    }

    const projectId = projectIdParam as Project['id'];

    if (!isChatMessages(messages)) {
      console.error(
        `[CHAT] [${projectId}] No messages or malformatted messages provided.`,
      );

      return new Response('No messages or malformatted messages provided.', {
        status: 400,
      });
    }

    // Apply completions rate limits, in addition to middleware rate limits.
    const rateLimitResult = await checkCompletionsRateLimits({
      value: projectId,
      type: 'projectId',
    });

    if (!rateLimitResult.result.success) {
      console.error(`[CHAT] [RATE-LIMIT] [${projectId}] IP: ${req.ip}`);
      return new Response('Too many requests', { status: 429 });
    }

    // todo: add support for messages to insights
    let insightsType: InsightsType | undefined = 'advanced';
    if (!isRequestFromMarkprompt(req.headers.get('origin'))) {
      // Custom model configurations are part of the Pro and Enterprise plans
      // when used outside of the Markprompt dashboard.
      const teamTierInfo = await getTeamTierInfo(supabaseAdmin, projectId);
      if (!teamTierInfo || !canUseCustomModelConfig(teamTierInfo)) {
        // Custom model configurations are part of the Pro and Enterprise plans.
        for (const field of modelConfigFields) {
          params = {
            ...params,
            [field]: undefined,
          };
        }
      }
      insightsType = teamTierInfo && getAccessibleInsightsType(teamTierInfo);
    }

    const modelId = getSupportedChatModelValueOrFallback(
      stringToLLMInfo(params?.model).model,
    );

    const { byoOpenAIKey } = await getProjectConfigData(
      supabaseAdmin,
      projectId,
    );

    const lastMessage = messages[messages.length - 1].content || '';
    const sanitizedQuery = lastMessage.trim().replace('\n', ' ');

    const pastUserMessages = messages
      .slice(0, -1)
      .filter((m) => m.role === 'user')
      .map((m) => m.content);

    const sectionsTs = Date.now();

    let fileSections: FileSectionMatchResult[] = [];
    let promptEmbedding: number[] | undefined = undefined;
    try {
      const sectionsResponse = await getMatchingSections(
        sanitizedQuery,
        lastMessage,
        params.sectionsMatchThreshold,
        params.sectionsMatchCount,
        projectId,
        byoOpenAIKey,
        'completions',
        supabaseAdmin,
      );
      fileSections = sectionsResponse.fileSections;
      promptEmbedding = sectionsResponse.promptEmbedding;

      if (pastUserMessages.length > 0) {
        // Find context sections for past messages
        const combinedMessage = pastUserMessages.join('\n\n');
        const sanitizedCombinedMessage = combinedMessage
          .trim()
          .replace('\n', ' ');
        const sectionsResponse = await getMatchingSections(
          sanitizedCombinedMessage,
          combinedMessage,
          params.sectionsMatchThreshold,
          5,
          projectId,
          byoOpenAIKey,
          'completions',
          supabaseAdmin,
        );

        for (const section of sectionsResponse.fileSections) {
          // Make sure not to include redundant sections
          if (
            !fileSections.some((s) => {
              return s.file_sections_content === section.file_sections_content;
            })
          ) {
            fileSections.push(section);
          }
        }
      }
    } catch (e) {
      const promptId = await storePromptOrPlaceholder(
        supabaseAdmin,
        projectId,
        lastMessage,
        undefined,
        promptEmbedding,
        'no_sections',
        [],
        insightsType,
        excludeFromInsights,
        redact,
      );

      const headers = getHeaders([], promptId);

      if (e instanceof ApiError) {
        return new Response(e.message, { status: e.code, headers });
      } else {
        return new Response(`${e}`, { status: 400, headers });
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

    // TODO: should we create references for each message?
    const references: FileSectionReference[] = [];
    const systemPrompt =
      (params.systemPrompt as string) || DEFAULT_SYSTEM_PROMPT.content!;

    const approxMessagesTokens =
      approximatedTokenCount(systemPrompt) +
      messages.reduce(
        (acc, m) => acc + approximatedTokenCount(m.content || ''),
        0,
      );

    const maxTokensWithBuffer =
      0.9 * getChatCompletionModelMaxTokenCount(modelId);
    const maxCompletionTokens = (params.maxTokens ?? 500) as number;

    for (const section of fileSections) {
      numTokens += section.file_sections_token_count;

      if (
        approxMessagesTokens + maxCompletionTokens + numTokens >=
        maxTokensWithBuffer
      ) {
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

    const initMessages = buildInitMessages(
      systemPrompt,
      contextText,
      !!params.doNotInjectContext,
    );

    const payload = getPayload(
      [...initMessages, ...messages],
      modelId,
      params.temperature ?? 0.1,
      params.topP ?? 1,
      params.frequencyPenalty ?? 0,
      params.presencePenalty ?? 0,
      maxCompletionTokens,
      stream,
    );

    console.log('payload', JSON.stringify(payload, null, 2));

    // console.log(
    //   'Input tokens',
    //   approximatedTokenCount(
    //     messagesWithSystemMessage.map((m) => m.content).join('\n'),
    //   ),
    // );

    const url = getChatCompletionsUrl();

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
      initMessages,
      ts: { sections: sectionsDelta },
    };

    if (!stream) {
      if (!res.ok) {
        const message = await res.text();
        const promptId = await storePromptOrPlaceholder(
          supabaseAdmin,
          projectId,
          lastMessage,
          undefined,
          promptEmbedding,
          'api_error',
          references,
          insightsType,
          excludeFromInsights,
          redact,
        );

        const headers = getHeaders(references, promptId);

        return new Response(
          `Unable to retrieve completions response: ${message}`,
          { status: 400, headers },
        );
      } else {
        const json = await res.json();
        // TODO: track token count
        // const tokenCount = safeParseInt(json.usage.total_tokens, 0);
        // console.log('json', JSON.stringify(json, null, 2));
        // await recordProjectTokenCount(
        //   projectId,
        //   modelWithType,
        //   tokenCount,
        //   'completions',
        // );
        const text = getChatCompletionsResponseText(json);
        const idk = isIDontKnowResponse(text, iDontKnowMessage);
        const promptId = await storePromptOrPlaceholder(
          supabaseAdmin,
          projectId,
          lastMessage,
          text,
          promptEmbedding,
          idk ? 'idk' : undefined,
          references,
          insightsType,
          excludeFromInsights,
          redact,
        );

        const headers = getHeaders(references, promptId);

        return new Response(
          JSON.stringify({
            text,
            references,
            responseId: promptId,
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

    // We need to store the prompt here before the streaming starts as
    // the prompt id needs to be sent in the header, which is done immediately.
    // We keep the prompt id and update the prompt with the generated response
    // once it is done.
    const promptId = await storePromptOrPlaceholder(
      supabaseAdmin,
      projectId,
      lastMessage,
      '',
      promptEmbedding,
      undefined,
      references,
      insightsType,
      excludeFromInsights,
      redact,
    );

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
              const text = getChunkText(json);
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

        // @ts-expect-error - Type 'ReadableStream<Uint8Array>' is not an array type or a string type.
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        for await (const chunk of res.body!) {
          parser.feed(decoder.decode(chunk));
        }

        // Estimate the number of tokens used by this request.
        // TODO: GPT3Tokenizer is slow, especially on large text. Use the
        // approximated value instead (1 token ~= 4 characters).
        // const tokenizer = new GPT3Tokenizer({ type: 'gpt3' });
        // const allTextEncoded = tokenizer.encode(allText);
        // const tokenCount = allTextEncoded.text.length;

        // TODO: track token count
        // const allText =
        //   messagesWithSystemMessage.map((m) => m.content).join('\n') +
        //   responseText;
        // const estimatedTokenCount = Math.round(allText.length / 4);

        // if (!byoOpenAIKey) {
        //   await recordProjectTokenCount(
        //     projectId,
        //     modelWithType,
        //     estimatedTokenCount,
        //     'completions',
        //   );
        // }

        if (promptId) {
          const idk = isIDontKnowResponse(responseText, iDontKnowMessage);
          await updatePrompt(
            supabaseAdmin,
            promptId,
            responseText,
            idk ? 'idk' : undefined,
          );
        }

        // We're done, wind down
        parser.reset();
        controller.close();
      },
    });

    const headers = getHeaders(references, promptId);

    // const encodedDebugInfo = headerEncoder
    //   .encode(JSON.stringify(debugInfo))
    //   .toString();
    // We need to make sure debug info is truncated to stay within
    // limits of header size.
    // headers.append('x-markprompt-debug-info', encodedDebugInfo);

    return new Response(readableStream, { headers });
  } catch (e) {
    return new Response(
      `Error processing ${req.method} request: ${JSON.stringify(e)}`,
      { status: 500 },
    );
  }
}
