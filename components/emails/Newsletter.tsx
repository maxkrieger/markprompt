import { FC } from 'react';

import { TemplateId, getTemplate } from '@/lib/email';

interface NewsletterEmailProps {
  preview: string;
  markdown: string;
  date: Date;
  templateId: TemplateId;
}

// We create the email component as a standalone component, instead of
// creating it in the page itself, to avoid hydration errors (we
// import the component dynamically with SSR = false).
export const NewsletterEmail: FC<NewsletterEmailProps> = ({
  preview,
  markdown,
  date,
  templateId,
}) => {
  const Template = getTemplate(templateId);

  return <Template date={date} markdown={markdown} preview={preview} />;
};

export default NewsletterEmail;
