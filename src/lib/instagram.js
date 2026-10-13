const INSTAGRAM_API_URL = 'https://graph.instagram.com/v25.0/me/media';
const CACHE_DURATION_MS = 15 * 60 * 1000;
const MAX_POSTS = 24;

const accessToken = import.meta.env?.INSTAGRAM_ACCESS_TOKEN?.trim();

export function isInstagramConfigured() {
  return Boolean(accessToken);
}

function safeHttpsUrl(value) {
  if (typeof value !== 'string') return null;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function normalizeInstagramPost(media) {
  if (!media || typeof media !== 'object' || typeof media.id !== 'string') return null;

  const permalink = safeHttpsUrl(media.permalink);
  const hostname = permalink && new URL(permalink).hostname;
  if (!hostname || (hostname !== 'instagram.com' && !hostname.endsWith('.instagram.com'))) return null;

  const firstChild = Array.isArray(media.children?.data)
    ? media.children.data.find((child) => child.media_type === 'VIDEO' ? child.thumbnail_url : child.media_url)
    : null;
  const imageUrl = safeHttpsUrl(
    media.media_type === 'VIDEO'
      ? media.thumbnail_url
      : media.media_url || (firstChild?.media_type === 'VIDEO' ? firstChild.thumbnail_url : firstChild?.media_url)
  );
  if (!imageUrl) return null;

  return {
    id: media.id,
    imageUrl,
    permalink,
    isVideo: media.media_type === 'VIDEO',
  };
}

async function requestInstagramPosts(token, request) {
  const url = new URL(INSTAGRAM_API_URL);
  url.searchParams.set('fields', 'id,media_type,media_url,thumbnail_url,permalink,children{media_type,media_url,thumbnail_url}');
  url.searchParams.set('limit', String(MAX_POSTS));

  const response = await request(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) throw new Error(`Instagram media request failed (${response.status})`);

  const payload = await response.json();
  if (!Array.isArray(payload.data)) throw new Error('Instagram media response was invalid');

  return payload.data.map(normalizeInstagramPost).filter(Boolean);
}

// Each client owns its cache so credentials and cached posts stay together.
export function createInstagramClient({ accessToken, request = fetch, now = Date.now } = {}) {
  const token = accessToken?.trim();
  let cachedPosts = [];
  let cachedAt;
  let pendingRequest;

  return async function fetchPosts() {
    if (!token) return [];
    if (cachedAt !== undefined && now() - cachedAt < CACHE_DURATION_MS) return cachedPosts;

    if (!pendingRequest) {
      pendingRequest = requestInstagramPosts(token, request)
        .then((posts) => {
          cachedPosts = posts;
          cachedAt = now();
          return posts;
        })
        .finally(() => { pendingRequest = undefined; });
    }

    try {
      return await pendingRequest;
    } catch (error) {
      if (cachedAt !== undefined) return cachedPosts;
      throw error;
    }
  };
}

export const fetchInstagramPosts = createInstagramClient({ accessToken });
