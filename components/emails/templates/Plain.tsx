import { Container, Section, Link, Text } from '@react-email/components';
import { FC } from 'react';

import { MarkdownEmailContainer } from './MarkdownContainer';
import { Wrapper } from './Shared';

type PlainTemplate = {
  markdown: string;
  preview: string;
  withHtml?: boolean;
};

const container = {
  width: '100%',
  maxWidth: '100%',
};

const section = {
  width: '100%',
};

export const PlainTemplate: FC<PlainTemplate> = ({
  markdown,
  preview,
  withHtml,
}) => {
  return (
    <Wrapper
      preview={preview}
      bodyClassName="my-auto mx-auto bg-white p-0 w-full max-w-full font-sans"
      withHtml={withHtml}
    >
      <Container style={container}>
        <Section style={section}>
          <MarkdownEmailContainer markdown={markdown} />
        </Section>
        <Section>
          <Text>
            <Link href="{{{RESEND_UNSUBSCRIBE_URL}}}" className="underline">
              Unsubscribe
            </Link>{' '}
            if you do not wish to receive updates from me.
          </Text>
        </Section>
      </Container>
    </Wrapper>
  );
};
