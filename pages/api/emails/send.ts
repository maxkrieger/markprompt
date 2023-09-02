import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { parseISO } from 'date-fns';
import type { NextApiRequest, NextApiResponse } from 'next';
import pLimit from 'p-limit';
import { ReactElement } from 'react';
import { remark } from 'remark';
import { Resend } from 'resend';
import strip from 'strip-markdown';

import { getTemplate } from '@/lib/email';
import { canSendEmails } from '@/lib/middleware/email';
import { Database } from '@/types/supabase';
import { DbUser } from '@/types/types';

const resend = new Resend(process.env.RESEND_API_KEY);

interface Data {
  sent?: string[];
  errored?: string[];
  error?: string;
  done?: boolean;
}

const allowedMethods = ['POST'];

// In practice, this should always be set to true, so that we can send
// emails from localhost.
const RUN_AGAINST_PROD = true;

const SUPABASE_ADMIN_NEXT_PUBLIC_SUPABASE_URL = RUN_AGAINST_PROD
  ? process.env.NEXT_PUBLIC_SUPABASE_URL_PRODUCTION___WARNING___
  : process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_ADMIN_SERVICE_ROLE_KEY = RUN_AGAINST_PROD
  ? process.env.___WARNING___SUPABASE_SERVICE_ROLE_KEY_PRODUCTION
  : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const getProductionSupabaseAdminLocally = () => {
  // This code is for running against the Supabase production instance
  // locally. We deliberately use keys with warnings to ensure we don't
  // accidentally copy paste this code elsewhere.
  return createClient<Database>(
    SUPABASE_ADMIN_NEXT_PUBLIC_SUPABASE_URL || '',
    SUPABASE_ADMIN_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: true } },
  );
};

const productionSupabaseAdmin = getProductionSupabaseAdminLocally();

const sendEmail = async (
  subject: string,
  email: string,
  text: string,
  react: ReactElement<any, any>,
) => {
  return resend.emails.send({
    from: `${process.env.MARKPROMPT_NEWSLETTER_SENDER_NAME!} <${process.env
      .MARKPROMPT_NEWSLETTER_SENDER_EMAIL!}>`,
    reply_to: process.env.MARKPROMPT_NEWSLETTER_REPLY_TO!,
    to: email,
    subject,
    text,
    react,
  });
};

// Note: we've built this handler to make it possible to run
// locally. In particular, it uses the client Supabase instance
// to fetch session data (à priori on localhost), and the
// admin Supabase instance specifically with production keys,
// to run the user fetching/updating on the production database.

// The process for sending an email newsletter is:
// - Create a Markdown file in resoources/newsletters
// - Paste the file name (without the md extension) in pages/emails/preview
// - Preview it on localhost:3000/emails/preview
// - Remove the last_email_id values for all users
// - Hit send on the preview page. This will send the newsletter to
//   all users whose last_email_id value is not yet set to the id of the
//   email, and once the email is successfully sent, it will update the
//   last_email_id value so that the email cannot be sent twice.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>,
) {
  if (!req.method || !allowedMethods.includes(req.method)) {
    res.setHeader('Allow', allowedMethods);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // Use the session-based Supabase client here. This is required for the
  // canSendEmails check, which looks at the session active user.
  const localSupabaseClient = createServerSupabaseClient<Database>({
    req,
    res,
  });
  const _canSendEmails = await canSendEmails(localSupabaseClient);

  if (!_canSendEmails) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const emailId = req.body.emailId;
  if (!emailId) {
    return res.status(400).json({ error: 'Please provide an emailId.' });
  }

  let users: { id: string; email: string }[] = [];

  if (req.body.test) {
    const { data } = await productionSupabaseAdmin
      .from('users')
      .select('id,email')
      .eq('email', process.env.TEST_NEWSLETTER_EMAIL_RECIPIENT)
      .limit(1);
    users = data || [];
  } else {
    const { data } = await productionSupabaseAdmin
      .from('users')
      .select('id,email')
      .not('last_email_id', 'eq', req.body.emailId)
      .limit(10);

    users = data || [];
  }

  if (users.length === 0) {
    return res.status(200).json({ done: true });
  }

  const markdown = req.body.markdown;

  const react = getTemplate(req.body.templateId)({
    date: parseISO(req.body.date),
    markdown,
    preview: req.body.preview,
    withHtml: true,
  });

  if (!react) {
    res.status(400).json({ error: 'Unable to create React component.' });
    return;
  }

  // Make sure the unsubscribe Markdown is also included in the plain text
  // version.
  const text =
    String(await remark().use(strip).process(markdown)) +
    '\n\nUnsubscribe link: {{{RESEND_UNSUBSCRIBE_URL}}}';

  const successUsers: Pick<DbUser, 'id' | 'email'>[] = [];
  const errorUsers: Pick<DbUser, 'id' | 'email'>[] = [];

  const limit = pLimit(Math.min(10, users.length));

  try {
    await Promise.all(
      users.map((user) => {
        return limit(async () => {
          try {
            const result = await sendEmail(
              req.body.subject,
              user.email,
              text,
              react,
            );
            if ((result as any)?.message?.includes('unsubscribe')) {
              console.info(user.email, '-', JSON.stringify(result, null, 2));
            }

            successUsers.push(user);

            // Update immediately in DB, and not later, since the serveless
            // function could time out.
            await productionSupabaseAdmin
              .from('users')
              .update({ last_email_id: emailId })
              .eq('id', user.id);
          } catch {
            errorUsers.push(user);
          }
        });
      }),
    );
  } catch (e) {
    console.error(e);
  }

  res.status(200).json({
    sent: successUsers.map((u) => u.email),
    errored: errorUsers.map((u) => u.email),
    ...(req.body.test ? { done: true } : {}),
  });
}
