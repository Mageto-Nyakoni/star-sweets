export function instagramPostKey(value) {
  if (typeof value !== 'string') return null;

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !['instagram.com', 'www.instagram.com', 'm.instagram.com'].includes(url.hostname)) return null;

    const match = url.pathname.match(/^\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)\/?$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function applyInstagramGallerySettings(posts, settings) {
  const entries = new Map();
  for (const entry of Array.isArray(settings?.posts) ? settings.posts : []) {
    const key = instagramPostKey(entry?.postUrl);
    if (key) entries.set(key, entry);
  }

  return posts.flatMap((post) => {
    const entry = entries.get(instagramPostKey(post.permalink));
    if (entry?.isHidden) return [];
    return [{
      ...post,
      description: typeof entry?.description === 'string'
        ? entry.description.trim()
        : '',
    }];
  });
}
