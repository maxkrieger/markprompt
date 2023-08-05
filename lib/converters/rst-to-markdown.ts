import { rstToHTML } from './rst-to-html';
import { turndownService } from './turndown-instance';

export const rstToMarkdown = (rstContent: string) => {
  const html = rstToHTML(rstContent);
  return turndownService.turndown(html);
};
