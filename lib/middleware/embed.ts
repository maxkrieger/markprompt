import LZString from 'lz-string';
import { NextRequest, NextResponse } from 'next/server';

import { MARKPROMPT_JS_PACKAGE_VERSIONS } from '../constants';
import { getApiUrl } from '../utils.edge';

export default async function EmbedMiddleware(req: NextRequest) {
  const params = JSON.parse(
    // eslint-disable-next-line import/no-named-as-default-member
    LZString.decompressFromEncodedURIComponent(
      req.nextUrl.pathname.replace(/^\/embed\//, ''),
    ),
  );

  const markpromptOptions = {
    ...params.markpromptOptions,
    display: 'plain',
    prompt: {
      ...params.markpromptOptions.prompt,
      apiUrl: getApiUrl('completions', false),
    },
    search: {
      ...params.markpromptOptions.search,
      apiUrl: getApiUrl('search', false),
    },
  };

  return new NextResponse(
    `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Chatbot Playground</title>
    <link rel="preconnect" href="https://rsms.me/" />
    <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
    <link rel="stylesheet" href="https://esm.sh/@markprompt/css@${
      MARKPROMPT_JS_PACKAGE_VERSIONS.css
    }?css" />
    <style>
      * {
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        font-family: 'Inter', sans-serif;
      }

      #markprompt {
        position: absolute;
        inset: 0px;
      }

      .MarkpromptContentPlain {
        grid-template-rows: 1fr auto !important;
      }
    </style>
  </head>
  <body>
    <main>
      <div id="markprompt" />
    </main>
    <script type="module">
      import { markprompt } from 'https://esm.sh/@markprompt/web@${
        MARKPROMPT_JS_PACKAGE_VERSIONS.web
      }';

      const el = document.querySelector('#markprompt');

      markprompt("${params.projectKey}", el, ${JSON.stringify(
        markpromptOptions,
      )});
    </script>
  </body>
</html>
`,
    {
      status: 200,
      headers: { 'content-type': 'text/html' },
    },
  );
}
