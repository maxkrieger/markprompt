import { Heading, Img, Link, Text } from '@react-email/components';
import { Language } from 'prism-react-renderer';
import { FC } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Code } from '@/components/ui/Code';

interface MarkdownContainerProps {
  markdown: string;
  components?: any;
}

export const MarkdownEmailContainer: FC<MarkdownContainerProps> = ({
  markdown,
  components,
}) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: (props) => <Text className="text-sm" {...props} />,
        a: (props) => <Link className="text-sm" {...props} />,
        h1: (props) => (
          <Heading as="h1" className="mb-4 text-xl font-bold" {...props} />
        ),
        h2: (props) => (
          <Heading as="h2" className="mb-4 text-lg font-bold" {...props} />
        ),
        h3: (props) => (
          <Heading as="h3" className="mb-4 text-base font-bold" {...props} />
        ),
        img: (props) => (
          <Img
            className="my-6 w-full max-w-[600px] rounded-md border border-solid border-neutral-100"
            alt={props.alt || 'Untitled image'}
            src={props.src as string}
          />
        ),
        li: (props) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { ordered, ...rest } = props;
          return <li className="text-sm leading-relaxed" {...rest} />;
        },
        ...components,
      }}
    >
      {markdown}
    </ReactMarkdown>
  );
};

export const MarkdownContainer: FC<MarkdownContainerProps> = ({
  markdown,
  components,
}) => {
  return (
    <div className="markdown-container prose prose-sm prose-invert max-w-full">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: (props) => <Text {...props} />,
          a: (props) => (
            <Link
              className="subtle-underline text-neutral-300"
              {...props}
              style={{}}
            />
          ),
          h1: (props) => (
            <Heading as="h1" className="mb-4 text-xl font-bold" {...props} />
          ),
          h2: (props) => (
            <Heading as="h2" className="mb-4 text-lg font-bold" {...props} />
          ),
          h3: (props) => (
            <Heading as="h3" className="mb-4 text-base font-bold" {...props} />
          ),
          img: (props) => (
            <Img
              className="my-6 w-full rounded-md border border-solid border-neutral-900"
              alt={props.alt || 'Untitled image'}
              src={props.src as string}
            />
          ),
          code: (props) => {
            const match = /language-(\w+)/.exec(props.className || '');
            return match ? (
              <Code
                language={(match[1] as Language) || 'javascript'}
                code={(props.children?.[0] as string)?.trim() || ''}
              />
            ) : (
              <code className={props.className} {...props} />
            );
          },
          ...components,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
};
