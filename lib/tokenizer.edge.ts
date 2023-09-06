import model from '@dqbd/tiktoken/encoders/cl100k_base.json';
import { init, Tiktoken } from '@dqbd/tiktoken/lite/init';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import wasm from '@dqbd/tiktoken/lite/tiktoken_bg.wasm?module';
import { ChatCompletionRequestMessage } from 'openai';

let tokenizer: Tiktoken | null = null;

export const getTokenizer = async () => {
  if (!tokenizer) {
    await init((imports) => WebAssembly.instantiate(wasm, imports));
    tokenizer = new Tiktoken(
      model.bpe_ranks,
      model.special_tokens,
      model.pat_str,
    );
  }
  return tokenizer;
};

/**
 * Count the tokens for multi-message chat completion requests
 */
export const getChatRequestTokenCount = (
  messages: ChatCompletionRequestMessage[],
  model = 'gpt-3.5-turbo-0301',
  tokenizer: Tiktoken,
): number => {
  const tokensPerRequest = 3; // every reply is primed with <|im_start|>assistant<|im_sep|>
  const numTokens = messages.reduce(
    (acc, message) => acc + getMessageTokenCount(message, model, tokenizer),
    0,
  );

  return numTokens + tokensPerRequest;
};

/**
 * Count the tokens for a single message within a chat completion request
 *
 * See "Counting tokens for chat API calls"
 * from https://github.com/openai/openai-cookbook/blob/834181d5739740eb8380096dac7056c925578d9a/examples/How_to_count_tokens_with_tiktoken.ipynb
 */
export const getMessageTokenCount = (
  message: ChatCompletionRequestMessage,
  model = 'gpt-3.5-turbo-0301',
  tokenizer: Tiktoken,
): number => {
  let tokensPerMessage: number;
  let tokensPerName: number;

  switch (model) {
    case 'gpt-3.5-turbo':
      console.warn(
        'Warning: gpt-3.5-turbo may change over time. Returning num tokens assuming gpt-3.5-turbo-0301.',
      );
      return getMessageTokenCount(message, 'gpt-3.5-turbo-0301', tokenizer);
    case 'gpt-4':
      console.warn(
        'Warning: gpt-4 may change over time. Returning num tokens assuming gpt-4-0314.',
      );
      return getMessageTokenCount(message, 'gpt-4-0314', tokenizer);
    case 'gpt-3.5-turbo-0301':
      tokensPerMessage = 4; // every message follows <|start|>{role/name}\n{content}<|end|>\n
      tokensPerName = -1; // if there's a name, the role is omitted
      break;
    case 'gpt-4-0314':
      tokensPerMessage = 3;
      tokensPerName = 1;
      break;
    default:
      throw new Error(
        `Unknown model '${model}'. See https://github.com/openai/openai-python/blob/main/chatml.md for information on how messages are converted to tokens.`,
      );
  }

  return Object.entries(message).reduce((acc, [key, value]) => {
    acc += tokenizer.encode(value).length;
    if (key === 'name') {
      acc += tokensPerName;
    }
    return acc;
  }, tokensPerMessage);
};

/**
 * Get the maximum number of tokens for a model's context.
 *
 * Includes tokens in both message and completion.
 */
export const getMaxTokenCount = (model: string): number => {
  switch (model) {
    case 'gpt-3.5-turbo':
      console.warn(
        'Warning: gpt-3.5-turbo may change over time. Returning max num tokens assuming gpt-3.5-turbo-0301.',
      );
      return getMaxTokenCount('gpt-3.5-turbo-0301');
    case 'gpt-4':
      console.warn(
        'Warning: gpt-4 may change over time. Returning max num tokens assuming gpt-4-0314.',
      );
      return getMaxTokenCount('gpt-4-0314');
    case 'gpt-3.5-turbo-0301':
      return 4097;
    case 'gpt-4-0314':
      return 4097;
    default:
      throw new Error(`Unknown model '${model}'`);
  }
};
