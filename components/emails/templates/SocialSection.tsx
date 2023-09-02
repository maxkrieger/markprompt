import {
  Button,
  Column,
  Img,
  Link,
  Row,
  Section,
} from '@react-email/components';
import { FC } from 'react';

const SocialCard = ({
  name,
  cta,
  href,
  icon,
}: {
  name: string;
  cta: string;
  href: string;
  icon: string;
}) => {
  return (
    <>
      <Img
        className="mb-2 opacity-40"
        src={icon}
        width={20}
        height={20}
        alt={`${name} logo`}
      />
      <Link
        href={href}
        className="inline-block max-w-full truncate overflow-ellipsis whitespace-nowrap text-xs font-semibold text-neutral-900 underline"
      >
        {cta}
      </Link>
    </>
  );
};

interface SocialSectionProps {
  excludeCTA?: boolean;
  className?: string;
}

export const SocialSection: FC<SocialSectionProps> = ({
  className,
  excludeCTA,
}) => {
  return (
    <>
      <Section className={className}>
        <Row>
          <Column align="left">
            <SocialCard
              name="Twitter"
              cta="Follow on Twitter"
              href="https://twitter.com/markprompt"
              icon="https://res.cloudinary.com/djp21wtxm/image/upload/v1689902910/Twitter_ibapjo.png"
            />
          </Column>
          <Column align="left">
            <SocialCard
              name="Discord"
              cta="Discuss on Discord"
              href="https://discord.gg/MBMh4apz6X"
              icon="https://res.cloudinary.com/djp21wtxm/image/upload/v1689902910/Discord_dxo3pd.png"
            />
          </Column>
          <Column align="left">
            <SocialCard
              name="GitHub"
              cta="Fork on GitHub"
              href="https://github.com/motifland/markprompt"
              icon="https://res.cloudinary.com/djp21wtxm/image/upload/v1689902910/GitHub_rsxnul.png"
            />
          </Column>
        </Row>
      </Section>
      {!excludeCTA && (
        <Section className="mt-8">
          <Row>
            <Column className="text-sm font-semibold" align="left">
              Supercharge your content with AI
            </Column>
            <Column align="right">
              <Button
                pX={10}
                pY={10}
                className="flex-none rounded-md bg-sky-500 px-3 py-1.5 text-sm font-semibold text-white no-underline"
                href="https://markprompt.com"
              >
                Get started
              </Button>
            </Column>
          </Row>
        </Section>
      )}
    </>
  );
};
