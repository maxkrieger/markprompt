import {
  Container,
  Heading,
  Hr,
  Img,
  Link,
  Section,
  Text,
} from '@react-email/components';
import { format } from 'date-fns';
import { FC } from 'react';

import { MarkdownEmailContainer } from './MarkdownContainer';
import { Wrapper } from './Shared';
import { SocialSection } from './SocialSection';

type MonthlyUpdateTemplateProps = {
  date: Date;
  markdown: string;
  preview: string;
  withHtml?: boolean;
};

export const MonthlyUpdateTemplate: FC<MonthlyUpdateTemplateProps> = ({
  date,
  markdown,
  preview,
  withHtml,
}) => {
  return (
    <Wrapper
      preview={preview}
      bodyClassName="my-auto mx-auto bg-white p-8 font-sans"
      withHtml={withHtml}
    >
      <Container className="mx-auto w-full max-w-[720px] border-separate  bg-white">
        <Section>
          <Img
            src="https://res.cloudinary.com/djp21wtxm/image/upload/v1689959311/Email_u1tegg.png"
            width={50}
            height={50}
            alt="Markprompt logo"
          />
        </Section>
        <Heading className="mt-8 text-xl font-bold">
          Markprompt Update
          <span className="font-normal text-neutral-500">
            {' '}
            — {format(date, 'MMMM yyyy')}
          </span>
        </Heading>
        <Section className="prose prose-sm">
          <MarkdownEmailContainer markdown={markdown} />
        </Section>
        <Hr className="mt-8 border-neutral-200" />
        <SocialSection className="mt-8" />
        <Hr className="mt-8 border-neutral-200" />
        <Section className="mt-6 text-xs text-neutral-500">
          <Text>
            Motif Land Inc, 2261 Market Street #4059, San Francisco CA, 94114
          </Text>
          <Text>
            You are receiving this email because you signed up at{' '}
            <Link
              className="text-neutral-500 underline"
              href="https://markprompt.com"
            >
              markprompt.com
            </Link>
            .
          </Text>
        </Section>
        <Text>
          You are receiving this email because you signed up at{' '}
          <Link href="https://markprompt.com" className="underline">
            markprompt.com
          </Link>
          .{' '}
          <Link href="{{{RESEND_UNSUBSCRIBE_URL}}}" className="underline">
            Unsubscribe
          </Link>
          .
        </Text>
      </Container>
    </Wrapper>
  );
};
