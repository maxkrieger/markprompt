import { parse, transform, renderers } from '@markdoc/markdoc';

import { turndownService } from './turndown-instance';

export const markdocToMarkdown = (markdocContent: string) => {
  const ast = parse(markdocContent);
  // In Markdoc, we make an exception and transform {% img %}
  // and {% image %} tags to <img> html since this is a common
  // use as an improvement to the ![]() Markdown tag. We could
  // offer to pass such rules via the API call.
  const transformed = transform(ast, {
    tags: {
      img: { render: 'img', attributes: { src: { type: String } } },
      image: { render: 'img', attributes: { src: { type: String } } },
    },
  });
  const html = renderers.html(transformed) || '';
  return turndownService.turndown(html);
};
