import { exec } from 'child_process';

import { createClient } from '@supabase/supabase-js';
import { expect, test, describe, assert, beforeAll, vi } from 'vitest';
import 'dotenv/config';

import { createRequest, createResponse } from 'node-mocks-http';

// Requires supabase CLI to be running the DB
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

const EMAIL = 'test@example.com';
const PASSWORD = 'example-password';

const isCI = !process.env.CI;

describe.skipIf(isCI)('User account creation', async () => {
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
    email: EMAIL,
    password: PASSWORD,
  });
  assert(!error);

  vi.doMock('@supabase/auth-helpers-nextjs', () => {
    return {
      createServerSupabaseClient: () => supabase,
    };
  });

  test('GET /api/user', async () => {
    const user = (await import('@/pages/api/user')).default;
    const req = createRequest({
      method: 'GET',
      url: '/api/user',
    });
    const res = createResponse();
    await user(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._isJSON()).toBe(true);
    const json = res._getJSONData();
    expect(json).toHaveProperty('id');
    expect(json).toHaveProperty('email');
    expect(json['email']).toBe(EMAIL);
    expect(json['id']).toBe(data?.user?.id);
  });
  test('POST /api/user/init', async () => {
    const init = (await import('@/pages/api/user/init')).default;
    const req = createRequest({
      method: 'POST',
      url: '/api/user/init',
    });
    const res = createResponse();
    await init(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._isJSON()).toBe(true);
    const json = res._getJSONData();
    expect(json).toHaveProperty('team');
    expect(json).toHaveProperty('project');
  });
});
