// Edge utilities. Cannot run Node APIs.

export const getAppHost = (subdomain?: string, forceProduction?: boolean) => {
  const isProd = forceProduction || process.env.NODE_ENV === 'production';
  const host = isProd ? process.env.NEXT_PUBLIC_APP_HOSTNAME : 'localhost:3000';
  return subdomain ? `${subdomain}.${host}` : host;
};

export const getAppOrigin = (subdomain?: string, forceProduction?: boolean) => {
  const host = getAppHost(subdomain, forceProduction);
  const isProd = forceProduction || process.env.NODE_ENV === 'production';
  const schema = isProd ? 'https://' : 'http://';
  return `${schema}${host}`;
};

export const getApiUrl = (
  api: 'embeddings' | 'completions' | 'chat' | 'sections' | 'search',
  forceProduction: boolean,
) => {
  return getAppOrigin('api', forceProduction) + '/v1/' + api;
};

export const isAppHost = (host: string) => {
  return host === getAppHost();
};

export const removeSchema = (origin: string) => {
  return origin.replace(/(^\w+:|^)\/\//, '');
};

export const getDomain = (url: string) => {
  let hostname: string;
  if (url.includes('://')) {
    hostname = new URL(url).hostname;
  } else {
    hostname = url.split('/')[0];
  }
  const domain = hostname.replace(/^www\./, '');
  return domain;
};

export const safeParseInt = (
  value: string | undefined | null,
  fallbackValue: number,
): number => {
  if (typeof value !== 'string') {
    return fallbackValue;
  }

  try {
    return parseInt(value);
  } catch {
    //
  }

  return fallbackValue;
};

export const safeParseJSON = <T>(
  value: string | undefined | null,
  fallbackValue: T,
): T => {
  if (typeof value !== 'string') {
    return fallbackValue;
  }

  try {
    return JSON.parse(value);
  } catch {
    //
  }

  return fallbackValue;
};

export const isRequestFromMarkprompt = (origin: string | undefined | null) => {
  const requesterHost = origin && removeSchema(origin);
  return requesterHost === getAppHost();
};

// Source: https://gist.github.com/ahtcx/0cd94e62691f539160b32ecda18af3d6?permalink_comment_id=4594127#gistcomment-4594127.
// We use our own implementation here, rather than lodash.merge, since
// lodash.merge makes use of non-edge-compatible functions.
export const deepMerge = (target: any | null, source: any | null) => {
  const result = { ...(target || {}), ...(source || {}) };
  for (const key of Object.keys(result)) {
    result[key] =
      typeof (target || {})[key] == 'object' &&
      typeof (source || {})[key] == 'object'
        ? deepMerge((target || {})[key], (source || {})[key])
        : structuredClone(result[key]);
  }
  return result;
};
