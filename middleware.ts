import { NextRequest, NextResponse } from 'next/server';

import AppMiddleware from './lib/middleware/app';
import CompletionsMiddleware from './lib/middleware/completions';
import EmailMiddleware from './lib/middleware/email';
import EmbedMiddleware from './lib/middleware/embed';
import InsightsMiddleware from './lib/middleware/insights';
import SearchMiddleware from './lib/middleware/search';
import MatchSectionsMiddleware from './lib/middleware/sections';
import TrainMiddleware from './lib/middleware/train';
import { getAppHost } from './lib/utils.edge';

export const config = {
  matcher: [
    '/((?!_next/|_proxy/|_auth/|_root/|_static|static|_vercel|[\\w-]+\\.\\w+).*)',
  ],
};

export default async function middleware(req: NextRequest) {
  const hostname = req.headers.get('host');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200 });
  }

  if (req.nextUrl.pathname.startsWith('/api/oauth/')) {
    return NextResponse.next();
  }

  if (req.nextUrl.pathname.startsWith('/.well-known/')) {
    return NextResponse.next();
  }

  if (req.nextUrl.pathname.startsWith('/embed/')) {
    return EmbedMiddleware(req);
  }

  const path = req.nextUrl.pathname;

  if (hostname === getAppHost()) {
    if (path?.startsWith('/emails')) {
      return EmailMiddleware(req);
    } else {
      return AppMiddleware(req);
    }
  }

  // If the hostname is not the app host, make sure that /api/v1
  // routes cannot be accessed directly: we need to go through middleware
  // to check auth tokens, whitelisted domains etc.
  if (path?.startsWith('/api/v1')) {
    return new Response('Not found', { status: 404 });
  }

  if (hostname === 'api.markprompt.com' || hostname === 'api.localhost:3000') {
    if (
      path?.startsWith('/completions') ||
      path?.startsWith('/v1/completions') ||
      path?.startsWith('/v1/chat')
    ) {
      return CompletionsMiddleware(req);
    } else if (path?.startsWith('/train') || path?.startsWith('/v1/train')) {
      return TrainMiddleware(req);
    } else if (path?.startsWith('/v1/sections')) {
      return MatchSectionsMiddleware(req);
    } else if (path?.startsWith('/v1/search')) {
      return SearchMiddleware(req);
    } else if (path?.startsWith('/v1/insights')) {
      return InsightsMiddleware(req);
    } else if (path?.startsWith('/v1/feedback')) {
      return NextResponse.rewrite(new URL('/api/v1/feedback', req.url));
    }
  }

  return NextResponse.next();
}
