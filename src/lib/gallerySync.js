import { instagramPostKey } from './galleryVisibility.js';

export function mergeInstagramGalleryPosts(existingEntries, instagramPosts, createKey) {
  const previous = Array.isArray(existingEntries) ? existingEntries : [];
  const known = new Set(previous.map((entry) => instagramPostKey(entry?.postUrl)).filter(Boolean));
  const added = [];

  for (const post of instagramPosts) {
    const key = instagramPostKey(post?.permalink);
    if (!key || known.has(key)) continue;

    known.add(key);
    added.push({
      _type: 'galleryPostSetting',
      _key: createKey(),
      postUrl: post.permalink,
      description: '',
      isHidden: false,
    });
  }

  return { posts: [...added, ...previous], addedCount: added.length };
}
