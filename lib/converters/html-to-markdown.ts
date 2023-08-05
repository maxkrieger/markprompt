import { load } from 'cheerio';

import { turndownService } from './turndown-instance';

const htmlExcludeTags = ['head', 'script', 'style', 'nav', 'footer', 'aside'];

export const htmlToMarkdown = (htmlContent: string) => {
  const $ = load(htmlContent);

  htmlExcludeTags.forEach((tag) => {
    $(tag).remove();
  });

  let cleanedHtml = $('main').html();
  if (!cleanedHtml) {
    cleanedHtml = $('body').html();
  }

  return turndownService.turndown(cleanedHtml || '');
};
