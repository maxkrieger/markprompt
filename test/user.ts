import { exec } from 'child_process';

import { createClient } from '@supabase/supabase-js';
import { expect, test, describe, assert, beforeAll, vi } from 'vitest';
import 'dotenv/config';

import { createRequest, createResponse } from 'node-mocks-http';

async function resetDB() {
  return new Promise((resolve, reject) => {
    exec('supabase db reset', (err, stdout, stderr) => {
      if (err) {
        reject(err);
      }
      resolve(stdout);
    });
  });
}

describe('test', async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing env vars.');
  }

  await resetDB();
  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: true },
  });

  const { data, error } = await supabase.auth.signUp({
    email: 'test@example.com',
    password: 'example-password',
  });
  assert(!error);

  vi.doMock('@supabase/auth-helpers-nextjs', () => {
    return {
      createServerSupabaseClient: () => supabase,
    };
  });

  const user = (await import('@/pages/api/user')).default;
  test('test', async () => {
    const req = createRequest({
      method: 'GET',
      url: '/api/user',
    });
    const res = createResponse();
    await user(req, res);
    expect(res.statusCode).toBe(200);
    const json = await res.json();
    console.log(json);
  });
});
