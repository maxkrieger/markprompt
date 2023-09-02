import Head from 'next/head';
import Link from 'next/link';
import { FC, ReactNode } from 'react';

import { MarkpromptIcon } from '../icons/Markprompt';

interface MDXComponentProps {
  children: ReactNode;
  meta: any;
}

export const MDXComponent: FC<MDXComponentProps> = ({ children, meta }) => {
  return (
    <>
      <Head>
        <title>{`${meta.title} | Markprompt`}</title>
      </Head>
      <div className="mx-auto mt-16 max-w-screen-md px-8 pb-20 pt-12">
        <div className="not-prose mb-20">
          <Link
            href="/"
            className="inline-block border-b-0 no-underline outline-none"
          >
            <MarkpromptIcon className="h-20 w-20 text-white" />
          </Link>
        </div>
        <div className="prose prose-invert ">{children}</div>
      </div>
    </>
  );
};
