import { Heading, Img, Link, Text } from '@react-email/components';
import { FC } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type MarkdownContainerProps = {
  markdown: string;
  components?: any;
};

export const MarkdownEmailContainer: FC<MarkdownContainerProps> = ({
  markdown,
  components,
}) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: (props) => <Text {...props} />,
        a: (props) => <Link {...props} />,
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
          ...components,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
};
