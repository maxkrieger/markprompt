import { SupabaseClient } from '@supabase/supabase-js';
import { add, endOfWeek, format, formatISO, startOfWeek } from 'date-fns';
import { flatten, isEmpty, sum, uniq } from 'lodash-es';
import type { NextApiRequest, NextApiResponse } from 'next';
import { Resend } from 'resend';

import InsightsEmail from '@/components/emails/Insights';
import {
  getEmbeddingTokensAllowance,
  getMonthlyCompletionsAllowance,
  getTier,
  getTierName,
} from '@/lib/stripe/tiers';
import {
  createServiceRoleSupabaseClient,
  getJoinedTeams,
  getTeamProjectIds,
} from '@/lib/supabase';
import {
  getAuthorizationToken,
  redactEmail,
  redactPhoneNumbers,
} from '@/lib/utils';
import { Database } from '@/types/supabase';
import {
  DbTeam,
  DbUser,
  Project,
  QueryStatsProcessingResponseData,
} from '@/types/types';

const resend = new Resend(process.env.RESEND_API_KEY);

type Data =
  | {
      status?: string;
      error?: string;
    }
  | QueryStatsProcessingResponseData;

const allowedMethods = ['GET'];

// Admin access to Supabase, bypassing RLS.
const supabaseAdmin = createServiceRoleSupabaseClient();

export interface UserUsageStats {
  teamUsageStats: TeamUsageStats[];
}

interface TeamUsageStats {
  name: string;
  slug: string;
  tierName: string;
  numMonthlyAllowedCompletions: number;
  numAllowedEmbeddings: number;
  projectUsageStats: ProjectUsageStats[];
}

interface ProjectUsageStats {
  name: string;
  slug: string;
  numEmbeddingTokens: number;
  numFiles: number;
  numSections: number;
  latestQuestions: string[];
  unansweredQuestions: string[];
  numQuestionsAsked: number;
  numQuestionsUnanswered: number;
  numQuestionsDownvoted: number;
  numQuestionsUpvoted: number;
  mostCitedSources: string[];
}

const sanitizeQuestion = (question: string) => {
  // Replace emails and phone numbers with with [REDACTED]
  return redactEmail(redactPhoneNumbers(question)).replace(/[\r\n]+/g, ' ');
};

const getProjectUsageStats = async (
  supabase: SupabaseClient<Database>,
  projectId: Project['id'],
  from: Date,
  to: Date,
): Promise<ProjectUsageStats> => {
  const fromISO = formatISO(from);
  const toISO = formatISO(to);

  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('name,slug')
    .eq('id', projectId)
    .limit(1)
    .maybeSingle();

  const { data: queryStats } = await supabase.rpc('get_project_query_stats', {
    project_id: projectId,
    from_tz: formatISO(from),
    to_tz: formatISO(to),
  });

  const { data: references } = await supabase.rpc(
    'get_most_cited_references_stats',
    {
      project_id: projectId,
      from_tz: fromISO,
      to_tz: toISO,
      max_results: 10,
    },
  );

  const { data: fileStats } = await supabase.rpc('get_project_file_stats', {
    project_id: projectId,
  });

  const { data: queries } = await supabaseAdmin
    .from('decrypted_query_stats')
    .select('decrypted_prompt,id')
    .eq('project_id', projectId)
    .or('processed_state.eq.processed,processed_state.eq.skipped')
    .gte('created_at', fromISO)
    .lte('created_at', toISO)
    .not('response', 'is', null)
    .not('prompt', 'is', null)
    .neq('prompt', '')
    .neq('prompt', '[REDACTED]')
    .not('no_response', 'is', true)
    .order('created_at', { ascending: false })
    .limit(20);

  const { data: unanswered } = await supabaseAdmin
    .from('decrypted_query_stats')
    .select('decrypted_prompt')
    .eq('project_id', projectId)
    .or('processed_state.eq.processed,processed_state.eq.skipped')
    .gte('created_at', fromISO)
    .lte('created_at', toISO)
    .eq('no_response', true)
    .not('prompt', 'is', null)
    .neq('prompt', '')
    .neq('prompt', '[REDACTED]')
    .order('created_at', { ascending: false })
    .limit(20);

  return {
    name: project?.name || '',
    slug: project?.slug || '',
    numEmbeddingTokens: fileStats?.[0]?.num_tokens || 0,
    numFiles: fileStats?.[0]?.num_files || 0,
    numSections: fileStats?.[0]?.num_sections || 0,
    latestQuestions: uniq(
      (queries || [])
        .map((q) => sanitizeQuestion(q.decrypted_prompt || ''))
        .filter((q) => !isEmpty(q)),
    ).slice(0, 10),
    unansweredQuestions: uniq(
      (unanswered || [])
        .map((q) => sanitizeQuestion(q.decrypted_prompt || ''))
        .filter((q) => !isEmpty(q)),
    ).slice(0, 10),
    numQuestionsAsked: queryStats?.[0]?.num_queries || 0,
    numQuestionsUnanswered: queryStats?.[0]?.num_unanswered || 0,
    numQuestionsUpvoted: queryStats?.[0]?.num_upvotes || 0,
    numQuestionsDownvoted: queryStats?.[0]?.num_downvotes || 0,
    mostCitedSources: (references || []).map((r) => {
      return r.heading ? `${r.heading} - ${r.title}` : r.title;
    }),
  };
};

const getTeamUsageStats = async (
  supabase: SupabaseClient<Database>,
  team: DbTeam,
  from: Date,
  to: Date,
): Promise<TeamUsageStats> => {
  const projectIds = await getTeamProjectIds(supabase, team.id);
  const tierName = getTierName(getTier(team));
  return {
    name: team.name || 'Unnamed',
    slug: team.slug,
    tierName,
    numMonthlyAllowedCompletions: await getMonthlyCompletionsAllowance(team),
    numAllowedEmbeddings: await getEmbeddingTokensAllowance(team),
    projectUsageStats: await Promise.all(
      projectIds.map(async (projectId) =>
        getProjectUsageStats(supabase, projectId, from, to),
      ),
    ),
  };
};

const getUserUsageStats = async (
  supabase: SupabaseClient<Database>,
  userId: DbUser['id'],
  from: Date,
  to: Date,
): Promise<UserUsageStats> => {
  const teams = await getJoinedTeams(supabase, userId);
  return {
    teamUsageStats: await Promise.all(
      teams.map(async (team) => getTeamUsageStats(supabase, team, from, to)),
    ),
  };
};

const generateInsightsText = (stats: UserUsageStats) => {
  const numProjects = sum(
    stats.teamUsageStats.map((s) => s.projectUsageStats.length),
  );

  const numFiles = sum(
    flatten(
      stats.teamUsageStats.map((s) =>
        s.projectUsageStats.map((p) => p.numFiles),
      ),
    ),
  );

  const numQuestions = sum(
    flatten(
      stats.teamUsageStats.map((s) =>
        s.projectUsageStats.map((p) => p.numQuestionsAsked),
      ),
    ),
  );

  const numQuestionsUnanswered = sum(
    flatten(
      stats.teamUsageStats.map((s) =>
        s.projectUsageStats.map((p) => p.numQuestionsUnanswered),
      ),
    ),
  );

  return `You are member of ${stats.teamUsageStats.length} teams. You have access to ${numProjects} projects, totalling ${numFiles} files. In the past week, ${numQuestions} questions have been asked, of which ${numQuestionsUnanswered} were unanswered.`;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>,
) {
  if (!req.method || !allowedMethods.includes(req.method)) {
    res.setHeader('Allow', allowedMethods);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  let users:
    | {
        id: string | null;
        email: string | null;
        config: any;
      }[]
    | null;

  if (req.query.test === '1') {
    const { data } = await supabaseAdmin
      .from('users')
      .select('id,email,config')
      .eq('id', process.env.TEST_USER_ID);

    if (!data || data.length === 0) {
      return res.status(400).send({ error: 'Test user not found' });
    }

    users = [{ id: data[0].id, email: data[0].email, config: data[0].config }];
  } else if (req.query.testuser) {
    const token = getAuthorizationToken(req.headers.authorization);
    if (token !== process.env.MARKPROMPT_API_TOKEN) {
      return res.status(401).send({ error: 'Unauthorized' });
    }

    const { data } = await supabaseAdmin
      .from('users')
      .select('id,email,config')
      .eq('email', req.query.testuser);

    if (!data || data.length === 0) {
      return res
        .status(400)
        .send({ error: `User ${req.query.testuser} not found` });
    }

    users = [{ id: data[0].id, email: data[0].email, config: data[0].config }];
  } else {
    const { data: usersResponse } = await supabaseAdmin
      .from('v_users_with_pending_weekly_update_email')
      .select('id,email,config')
      .limit(10);
    users = usersResponse;
  }

  if (!users) {
    return res.status(200).send({ status: 'ok' });
  }

  // We execute the cron job every two minutes on Mondays. So we take
  // as reference date the Monday before.
  const referenceDate = add(new Date(), { days: -7 });
  const from = startOfWeek(referenceDate);
  const to = endOfWeek(referenceDate);

  // Once the email has been sent, or if the user was not
  // elligible (e.g. because there were no files), update the
  // `lastWeeklyUpdateEmail` to the start of the range of
  // the update, i.e. the beginning of the past week.
  const updateConfig = async (user: {
    id: string | null;
    email: string | null;
    config: any;
  }) => {
    const { error: updateConfigError } = await supabaseAdmin
      .from('users')
      .update({
        config: {
          ...user.config,
          lastWeeklyUpdateEmail: formatISO(from),
        },
      })
      .eq('id', user.id);
    if (updateConfigError) {
      console.error(`Error updating user config: ${updateConfigError}`);
    }
  };

  for (const user of users) {
    // If this is a test user, force recipient to be the test newsletter
    // email recipient.
    const recipientEmail = req.query.testuser
      ? process.env.TEST_NEWSLETTER_EMAIL_RECIPIENT!
      : user.email;

    if (!user.id || !recipientEmail) {
      continue;
    }

    // Immediately update the config, to ensure no race condition on next
    // cron job execution.
    await updateConfig(user);

    const stats = await getUserUsageStats(supabaseAdmin, user.id, from, to);

    const numFiles = sum(
      flatten(
        stats.teamUsageStats.map((s) =>
          s.projectUsageStats.map((p) => p.numFiles),
        ),
      ),
    );

    // Do not send email if there are no teams, projects or files
    if (numFiles === 0) {
      continue;
    }

    try {
      await resend.emails.send({
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        from: `${process.env.MARKPROMPT_WEEKLY_UPDATES_SENDER_NAME!} <${process
          .env.MARKPROMPT_WEEKLY_UPDATES_SENDER_EMAIL!}>`,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        reply_to: process.env.MARKPROMPT_WEEKLY_UPDATES_REPLY_TO!,
        to: recipientEmail,
        subject: 'Markprompt Weekly Report',
        text: generateInsightsText(stats),
        react: InsightsEmail({
          preview: `Markprompt weekly report for ${format(
            from,
            'LLL dd',
          )} - ${format(to, 'LLL dd, y')}`,
          withHtml: true,
          stats,
          from,
          to,
        }),
      });

      console.debug('[EMAIL] Weekly update email sent to', recipientEmail);
    } catch (e) {
      console.error(
        `[EMAIL] Error sending weekly usage email: ${JSON.stringify(e)}`,
      );
    }
  }

  return res.status(200).send({ status: 'ok' });
}
