<a href="https://markprompt.com">
  <img alt="Markprompt – Enterprise-grade ChatGPT for your website and docs" src="https://github.com/motifland/markprompt-js/assets/504893/9df7ac5a-1ac3-4b33-9bb3-a146d119ed73">
  <h1 align="center">Markprompt</h1>
</a>

Markprompt is a platform for building GPT-powered prompts. It takes Markdown, Markdoc, MDX, reStructuredText, HTML and plain text files (from a GitHub repo, website, file uploads or API requests), and creates embeddings that you can use to create a prompt, for instance using the companion [Markprompt React or Web component](https://markprompt.com/docs#components). Markprompt also offers analytics, so you can gain insights on how users interact with your docs.

<br />

<p align="center">
  <a href="https://twitter.com/markprompt">
    <img alt="Twitter" src="https://img.shields.io/twitter/follow/markprompt?style=flat&label=%40markprompt&logo=twitter&color=0bf&logoColor=fff" />
  </a>
  <a aria-label="NPM version" href="https://www.npmjs.com/package/markprompt">
    <img alt="NPM version" src="https://badgen.net/npm/v/markprompt">
  </a>
  <a aria-label="License" href="https://github.com/motifland/markprompt/blob/main/LICENSE">
    <img alt="License" src="https://img.shields.io/badge/License-Apache_2.0-blue.svg">
  </a>
</p>

## Documentation

To use the Markprompt platform as is, please refer to the [Markprompt documentation](https://markprompt.com/docs).

Markprompt is built on top of the following stack:

- [Next.js](https://nextjs.org/) - framework
- [Vercel](https://vercel.com/) - hosting
- [Supabase](https://supabase.com/) - database and auth
- [Upstash](https://upstash.com/) - Redis and rate limiting
- [Typescript](https://www.typescriptlang.org/) - language
- [Tailwind](https://tailwindcss.com/) - CSS
- [Stripe](https://stripe.com/) - payments

## Using the React and Web components

Markprompt comes with React and Web components that make it easy to build a prompt interface on top of the Markprompt API. With a single line of code, you can provide a prompt interface to your React application. Follow the steps in the [Markprompt docs](https://markprompt.com/docs#components) to get started, or explore the [source code](https://github.com/motifland/markprompt-js).

Also, try out the [Markprompt starter template](https://github.com/motifland/markprompt-starter-template) for a fully working Next.js + Tailwind project.

## Usage

Currently, the Markprompt API has basic protection against misuse when making requests from public websites, such as rate limiting, IP blacklisting, allowed origins, and prompt moderation. These are not strong guarantees against misuse though, and it is always safer to expose an API like Markprompt's to authenticated users, and/or in non-public systems using private access tokens. We do plan to offer more extensive tooling on that front (hard limits, spike protection, notifications, query analysis, flagging).

## Data retention

OpenAI keeps training data for 30 days. Read more: [OpenAI API data usage policies](https://openai.com/policies/api-data-usage-policies).

Markprompt keeps the data as long as you need to query it. If you remove a file or delete a project, all associated data will be deleted immediately.

## Community

- [Twitter](https://twitter.com/markprompt)
- [Discord](https://discord.gg/MBMh4apz6X)

## License

[Apache](./LICENSE) © [Markprompt](https://markprompt.com)
