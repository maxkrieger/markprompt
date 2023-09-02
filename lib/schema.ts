import Ajv, { JTDSchemaType } from 'ajv/dist/jtd';

import { RemarkLinkRewriteOptions } from './remark/remark-link-rewrite';

export interface MarkpromptConfig {
  include?: string[];
  exclude?: string[];
  processorOptions?: {
    linkRewrite?: RemarkLinkRewriteOptions;
  };
}

export const MARKPROMPT_CONFIG_SCHEMA: JTDSchemaType<MarkpromptConfig> = {
  optionalProperties: {
    include: { elements: { type: 'string' } },
    exclude: { elements: { type: 'string' } },
    processorOptions: {
      optionalProperties: {
        linkRewrite: {
          properties: {
            rules: {
              elements: {
                properties: {
                  pattern: { type: 'string' },
                  replace: { type: 'string' },
                },
              },
            },
          },
          optionalProperties: {
            excludeExternalLinks: { type: 'boolean' },
          },
        },
      },
    },
  },
};

const ajv = new Ajv();

export const parse = ajv.compileParser(MARKPROMPT_CONFIG_SCHEMA);
