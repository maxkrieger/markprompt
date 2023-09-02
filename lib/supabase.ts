import type { SupabaseClient } from '@supabase/auth-helpers-nextjs';
import { PostgrestError, User, createClient } from '@supabase/supabase-js';

import { Database, Json } from '@/types/supabase';
import {
  DbUser,
  GitHubSourceDataType,
  MotifSourceDataType,
  OAuthProvider,
  Project,
  DbSource,
  SourceType,
  DbTeam,
  WebsiteSourceDataType,
  PromptQueryStat,
} from '@/types/types';

import { DEFAULT_MARKPROMPT_CONFIG } from './constants';
import { MarkpromptConfig } from './schema';
import { PlanDetails, getEmbeddingTokensAllowance } from './stripe/tiers';
import { generateKey } from './utils';

export const getBYOOpenAIKey = async (
  supabaseAdmin: SupabaseClient<Database>,
  projectId: Project['id'],
): Promise<string | undefined> => {
  const { data } = await supabaseAdmin
    .from('projects')
    .select('openai_key')
    .eq('id', projectId)
    .limit(1)
    .select()
    .maybeSingle();

  return data?.openai_key || undefined;
};

export const getProjectConfigData = async (
  supabaseAdmin: SupabaseClient<Database>,
  projectId: Project['id'],
): Promise<{
  byoOpenAIKey: string | undefined;
  markpromptConfig: MarkpromptConfig;
}> => {
  const { data } = await supabaseAdmin
    .from('projects')
    .select('openai_key,markprompt_config')
    .eq('id', projectId)
    .limit(1)
    .select()
    .maybeSingle();

  // We cannot use Ajv in edge runtimes, so use non-typesafe
  // parsing and assume the format is correct. Cf.
  // https://github.com/vercel/next.js/discussions/47063
  const markpromptConfig = (data?.markprompt_config ||
    JSON.parse(DEFAULT_MARKPROMPT_CONFIG)) as MarkpromptConfig;

  return {
    byoOpenAIKey: data?.openai_key || undefined,
    markpromptConfig: markpromptConfig,
  };
};

export const getTeamTierInfo = async (
  supabaseAdmin: SupabaseClient<Database>,
  projectId: Project['id'],
) => {
  const { data } = await supabaseAdmin
    .from('teams')
    .select('stripe_price_id,plan_details,projects!inner (id)')
    .match({ 'projects.id': projectId })
    .limit(1)
    .maybeSingle();

  return data
    ? {
        stripe_price_id: data.stripe_price_id,
        plan_details: data.plan_details as unknown as PlanDetails,
      }
    : undefined;
};

export const setGitHubAuthState = async (
  supabase: SupabaseClient<Database>,
  userId: DbUser['id'],
): Promise<string> => {
  const state = generateKey();
  const { data } = await supabase
    .from('user_access_tokens')
    .select('id')
    .match({ user_id: userId, provider: 'github' })
    .limit(1)
    .maybeSingle();
  if (data) {
    await supabase
      .from('user_access_tokens')
      .update({ state })
      .eq('id', data.id);
  } else {
    await supabase
      .from('user_access_tokens')
      .insert([{ user_id: userId, state, provider: 'github' }]);
  }
  return state;
};

export const deleteUserAccessToken = async (
  supabase: SupabaseClient<Database>,
  userId: DbUser['id'],
  provider: OAuthProvider,
): Promise<PostgrestError | null> => {
  const { error } = await supabase
    .from('user_access_tokens')
    .delete()
    .match({ user_id: userId, provider });
  return error;
};

export const getProjectIdFromSource = async (
  supabaseAdmin: SupabaseClient<Database>,
  sourceId: DbSource['id'],
): Promise<Project['id'] | undefined> => {
  const { data } = await supabaseAdmin
    .from('sources')
    .select('project_id')
    .eq('id', sourceId)
    .limit(1)
    .maybeSingle();
  return data?.project_id || undefined;
};

export const getOrCreateSource = async (
  supabase: SupabaseClient<Database>,
  projectId: Project['id'],
  type: SourceType,
  data: any | undefined,
): Promise<DbSource['id']> => {
  const source = await getSource(supabase, projectId, type, data);

  if (source?.id) {
    return source.id;
  }

  const { data: newSourceData } = await supabase
    .from('sources')
    .insert([{ project_id: projectId, type }])
    .select('id')
    .limit(1)
    .maybeSingle();

  return newSourceData!.id;
};

export const getSource = async (
  supabase: SupabaseClient<Database>,
  projectId: Project['id'],
  sourceType: SourceType,
  data: any,
): Promise<DbSource | undefined> => {
  const { data: sources, error } = await supabase
    .from('sources')
    .select('*')
    .match({ project_id: projectId, type: sourceType });

  if (error || !sources || sources.length === 0) {
    return undefined;
  }

  switch (sourceType) {
    case 'file-upload':
    case 'api-upload':
      return sources[0];
    case 'github':
      return sources.find((s) => {
        const _data = s.data as unknown as GitHubSourceDataType;
        return _data.url === data.url && _data.branch === data.branch;
      });
    case 'motif': {
      return sources.find((s) => {
        const _data = s.data as unknown as MotifSourceDataType;
        return (
          _data.projectDomain && _data.projectDomain === data.projectDomain
        );
      });
    }
    case 'website': {
      return sources.find((s) => {
        const _data = s.data as unknown as WebsiteSourceDataType;
        return _data.url && _data.url === data.url;
      });
    }
  }
};

export const getChecksums = async (
  supabase: SupabaseClient<Database>,
  sourceId: DbSource['id'],
) => {
  const { data } = await supabase
    .from('files')
    .select('path,checksum')
    .eq('source_id', sourceId);
  return data || [];
};

export const getProjectTeam = async (
  supabase: SupabaseClient<Database>,
  projectId: Project['id'],
): Promise<DbTeam | undefined> => {
  const { data: projectData } = await supabase
    .from('projects')
    .select('team_id')
    .eq('id', projectId)
    .limit(1)
    .maybeSingle();
  if (projectData?.team_id) {
    const { data: teamData } = await supabase
      .from('teams')
      .select('*')
      .eq('id', projectData.team_id)
      .limit(1)
      .maybeSingle();
    return teamData || undefined;
  }

  return undefined;
};

export const getTeamUsageInfoByTeamOrProject = async (
  supabase: SupabaseClient<Database>,
  teamOrProjectId: { teamId?: DbTeam['id']; projectId?: Project['id'] },
): Promise<{
  stripe_price_id: string | null;
  team_token_count: number;
  plan_details: Json | null;
}> => {
  // eslint-disable-next-line prefer-const
  let { data, error } = await supabase
    .from('v_team_project_usage_info')
    .select('stripe_price_id,team_token_count,plan_details')
    .eq(
      teamOrProjectId.teamId ? 'team_id' : 'project_id',
      teamOrProjectId.teamId ?? teamOrProjectId.projectId,
    )
    .limit(1)
    .maybeSingle();

  // Important: data will be null in the above query if no content has been
  // indexed. In that case, just fetch the team plan details.
  if (!data || error) {
    const { data: teamProjectInfoData } = await supabase
      .from('v_team_project_info')
      .select('stripe_price_id,plan_details')
      .eq(
        teamOrProjectId.teamId ? 'team_id' : 'project_id',
        teamOrProjectId.teamId ?? teamOrProjectId.projectId,
      )
      .limit(1)
      .maybeSingle();

    if (teamProjectInfoData) {
      data = { ...teamProjectInfoData, team_token_count: 0 };
    }
  }

  return {
    stripe_price_id: data?.stripe_price_id || null,
    team_token_count: data?.team_token_count || 0,
    plan_details: data?.plan_details || null,
  };
};

export const getTokenAllowanceInfo = async (
  supabase: SupabaseClient<Database>,
  teamOrProjectId: { teamId?: DbTeam['id']; projectId?: Project['id'] },
): Promise<{
  numRemainingTokensOnPlan: number;
  usedTokens: number;
  tokenAllowance: number;
}> => {
  const teamUsageInfo = await getTeamUsageInfoByTeamOrProject(
    supabase,
    teamOrProjectId,
  );
  const usedTokens = teamUsageInfo?.team_token_count || 0;
  const tokenAllowance = getEmbeddingTokensAllowance({
    stripe_price_id: teamUsageInfo?.stripe_price_id,
    plan_details: teamUsageInfo?.plan_details,
  });
  const numRemainingTokensOnPlan = Math.max(0, tokenAllowance - usedTokens);
  return { numRemainingTokensOnPlan, usedTokens, tokenAllowance };
};

export const getJoinedTeams = async (
  supabase: SupabaseClient<Database>,
  userId: DbUser['id'],
): Promise<DbTeam[]> => {
  const { data, error } = await supabase
    .from('memberships')
    .select('user_id, teams (*)')
    .match({ user_id: userId });

  if (error) {
    throw new Error(error.message);
  }

  return (data?.map((d) => d.teams) || []) as DbTeam[];
};

export const getTeamProjectIds = async (
  supabase: SupabaseClient<Database>,
  teamId: DbTeam['id'],
): Promise<Project['id'][]> => {
  const { data, error } = await supabase
    .from('projects')
    .select('id')
    .match({ team_id: teamId });

  if (error) {
    throw new Error(error.message);
  }

  return (data?.map((d) => d.id) || []) as DbTeam['id'][];
};

export const hasUserAccessToProject = async (
  supabase: SupabaseClient<Database>,
  userId: User['id'],
  projectId: Project['id'],
): Promise<boolean> => {
  const response = await supabase
    .rpc('is_project_accessible_to_user', {
      user_id: userId,
      project_id: projectId,
    })
    .limit(1)
    .maybeSingle();
  return !!response.data?.has_access;
};

export const getQueryStats = async (
  supabase: SupabaseClient<Database>,
  projectId: Project['id'],
  fromISO: string,
  toISO: string,
  limit: number,
  page: number,
): Promise<{
  error: PostgrestError | null;
  queries: PromptQueryStat[] | null;
}> => {
  const { data, error } = await supabase
    .from('decrypted_query_stats')
    .select('id,created_at,decrypted_prompt,no_response,feedback')
    .eq('project_id', projectId)
    .or('processed_state.eq.processed,processed_state.eq.skipped')
    .gte('created_at', fromISO)
    .lte('created_at', toISO)
    .not('decrypted_prompt', 'is', null)
    .neq('decrypted_prompt', '')
    .order('created_at', { ascending: false })
    .range(page * limit, (page + 1) * (limit - 1));

  await supabase
    .from('query_stats')
    .select('id,created_at,prompt,no_response,feedback')
    .eq('project_id', projectId)
    .or('processed_state.eq.processed,processed_state.eq.skipped')
    .gte('created_at', fromISO)
    .lte('created_at', toISO)
    .not('prompt', 'is', null)
    .neq('prompt', '')
    .order('created_at', { ascending: false })
    .range(page * limit, (page + 1) * (limit - 1));

  if (error) {
    return { error, queries: null };
  }

  const queries = (data || []).map((q) => {
    const { decrypted_prompt, ...rest } = q;
    return { ...rest, prompt: decrypted_prompt } as PromptQueryStat;
  });

  return { queries, error: null };
};

export const getPublicAnonSupabase = () => {
  return createClient<Database>(
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
};

export const createServiceRoleSupabaseClient = () => {
  return createClient<Database>(
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
};
