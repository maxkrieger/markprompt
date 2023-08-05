import { load } from 'cheerio';
import type { Content, Root } from 'mdast';
import { toMarkdown } from 'mdast-util-to-markdown';
import { toString } from 'mdast-util-to-string';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified';
import { u } from 'unist-builder';
import { filter } from 'unist-util-filter';

import { extractFrontmatter, getFileType, inferFileTitle } from '@/lib/utils';
import { FileSectionData, FileSectionsData } from '@/types/types';

import { htmlToMarkdown } from './converters/html-to-markdown';
import { markdocToMarkdown } from './converters/markdoc-to-markdown';
import { rstToMarkdown } from './converters/rst-to-markdown';
import { remarkLinkRewrite } from './remark/remark-link-rewrite';
import { MarkpromptConfig } from './schema';

const defaultFileSectionsData: FileSectionsData = {
  sections: [],
  meta: { title: 'Untitled' },
  leadFileHeading: undefined,
};

const splitTreeBy = <T extends Content>(
  tree: Root,
  predicate: (node: Content) => boolean,
): {
  predicateNode: T;
  tree: Root;
}[] => {
  return tree.children.reduce<{ predicateNode: T; tree: Root }[]>(
    (trees, node) => {
      const [lastTree] = trees.slice(-1);

      if (!lastTree || predicate(node)) {
        const tree: Root = u('root', [node]);
        return trees.concat({ predicateNode: node as T, tree });
      }

      lastTree.tree.children.push(node);
      return trees;
    },
    [],
  );
};

const getProcessor = (withMdx: boolean, markpromptConfig: MarkpromptConfig) => {
  let chain = unified();

  if (markpromptConfig.processorOptions?.linkRewrite) {
    chain.use(remarkLinkRewrite, markpromptConfig.processorOptions.linkRewrite);
  }

  chain
    .use(remarkParse)
    .use(remarkStringify)
    .use(remarkFrontmatter, ['yaml', 'toml']);

  if (withMdx) {
    chain = chain.use(remarkMdx);
  }

  return chain;
};

export const augmentMetaWithTitle = (
  meta: {
    [key: string]: string;
  },
  leadFileHeading: string | undefined,
  filePath: string,
) => {
  if (meta.title) {
    return meta;
  }

  if (leadFileHeading) {
    return { ...meta, title: leadFileHeading };
  }

  if (filePath) {
    return { ...meta, title: inferFileTitle(meta, filePath) };
  }

  return { ...meta, title: defaultFileSectionsData.meta.title };
};

// Use `asMDX = false` for Markdoc content. What might happen in Markdoc
// is that the page contains a statement like `{HI_THERE}`, which is
// rendered verbatim in Markdown/Markdoc. It's also not a problem à priori
// for MDX, since it's semantically correct MDX (no eval is happening here).
// However, specifically for `{HI_THERE}` with an underscore, the Markdoc
// transform will escape the underscore, turning it into `{HI\_THERE}`, and
// then it's actually semantically incorrect MDX, because what goes inside the
// curly braces is treated as a variable/expression, and `HI\_THERE` is
// not a valid JS variable/expression, so the parsing will fail.
// Similarly, statements like "<10" are valid Markdown/Markdoc, but not
// valid MDX (https://github.com/micromark/micromark-extension-mdx-jsx/issues/7)
// and we don't want this to break Markdoc.
export const markdownToFileSectionData = (
  content: string,
  asMDX: boolean,
  markpromptConfig: MarkpromptConfig,
): FileSectionsData | undefined => {
  const meta = extractFrontmatter(content);

  let tree: Root | undefined = undefined;

  const setTree = () => (t: Root) => {
    tree = t;
  };

  try {
    getProcessor(true, markpromptConfig).use(setTree).processSync(content);
  } catch {
    try {
      getProcessor(false, markpromptConfig).use(setTree).processSync(content);
    } catch {
      //
    }
  }

  if (!tree) {
    // Sometimes, only metadata is included and content is empty,
    // which is fine.
    return { sections: [], meta, leadFileHeading: undefined };
  }

  // Remove all JSX and expressions from MDX
  const mdTree = filter(
    tree,
    (node) =>
      ![
        'yaml',
        'toml',
        'mdxjsEsm',
        'mdxJsxFlowElement',
        'mdxJsxTextElement',
        'mdxFlowExpression',
        'mdxTextExpression',
      ].includes(node.type),
  );

  if (!mdTree) {
    // Sometimes, only metadata is included and content is empty,
    // which is fine.
    return { sections: [], meta, leadFileHeading: undefined };
  }

  const sectionTrees = splitTreeBy(mdTree, (node) => node.type === 'heading');

  const sections: FileSectionData[] = sectionTrees.map((tree) => {
    const node = tree.predicateNode as any;
    return {
      content: toMarkdown(tree.tree),
      leadHeading:
        node.type === 'heading'
          ? { value: toString(node), depth: node.depth }
          : undefined,
    };
  });

  const leadFileHeading = sections[0]?.leadHeading?.value;

  return { sections, meta, leadFileHeading };
};

export const markdocToFileSectionData = (
  content: string,
  markpromptConfig: MarkpromptConfig,
): FileSectionsData | undefined => {
  // In Markdoc, we start by extracting the frontmatter, because
  // the process is then to transform the Markdoc to HTML, and then
  // pass it through the Markdown processor. This erases traces of
  // the frontmatter. However, the frontmatter may not include
  // a title, which we will obtain from the Markdown processing.
  const meta = extractFrontmatter(content);
  const md = markdocToMarkdown(content);
  const fileSectionData = markdownToFileSectionData(
    md,
    false,
    markpromptConfig,
  );

  if (!fileSectionData) {
    return undefined;
  }

  return { ...fileSectionData, meta };
};

export const rstToFileSectionData = (
  content: string,
  markpromptConfig: MarkpromptConfig,
): FileSectionsData | undefined => {
  const md = rstToMarkdown(content);
  const fileSectionData = markdownToFileSectionData(
    md,
    false,
    markpromptConfig,
  );

  if (!fileSectionData) {
    return undefined;
  }

  return { ...fileSectionData, meta: {} };
};

export const htmlToFileSectionData = (
  content: string,
  markpromptConfig: MarkpromptConfig,
): FileSectionsData | undefined => {
  const $ = load(content);
  const title = $('title').text();
  const md = htmlToMarkdown(content);

  const fileSectionsData = md
    ? markdownToFileSectionData(md, false, markpromptConfig)
    : defaultFileSectionsData;

  if (!fileSectionsData) {
    return undefined;
  }

  return { ...fileSectionsData, meta: { title } };
};

export const convertToMarkdown = (content: string, filename: string) => {
  const fileType = getFileType(filename);
  switch (fileType) {
    case 'mdoc':
      return markdocToMarkdown(content);
    case 'rst':
      return rstToMarkdown(content);
    case 'html':
      return htmlToMarkdown(content);
    default:
      return content;
  }
};
