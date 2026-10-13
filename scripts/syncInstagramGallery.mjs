import { randomUUID } from 'node:crypto';
import { createClient } from '@sanity/client';
import { createInstagramClient } from '../src/lib/instagram.js';
import { mergeInstagramGalleryPosts } from '../src/lib/gallerySync.js';

const instagramToken = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
const sanityToken = process.env.SANITY_WRITE_TOKEN?.trim();
const projectId = process.env.SANITY_PROJECT_ID?.trim();

if (!instagramToken || !sanityToken || !projectId) {
  throw new Error('Set INSTAGRAM_ACCESS_TOKEN, SANITY_WRITE_TOKEN, and SANITY_PROJECT_ID before syncing the gallery.');
}

const sanity = createClient({
  projectId,
  dataset: process.env.SANITY_DATASET || 'production',
  apiVersion: process.env.SANITY_API_VERSION || '2024-01-01',
  token: sanityToken,
  useCdn: false,
});
const instagramPosts = await createInstagramClient({ accessToken: instagramToken })();
const documentId = 'instagramGallerySettings';
const draft = await sanity.getDocument(`drafts.${documentId}`);
if (draft) throw new Error('Publish or discard your unfinished Instagram Gallery edits in Sanity before syncing.');

for (let attempt = 0; attempt < 3; attempt += 1) {
  const settings = await sanity.getDocument(documentId);
  if (!settings) throw new Error('The Instagram Gallery settings document is missing in Sanity.');

  const { posts, addedCount } = mergeInstagramGalleryPosts(settings.posts, instagramPosts, randomUUID);
  if (addedCount === 0) {
    console.log(`Gallery is up to date: ${instagramPosts.length} recent Instagram posts checked.`);
    break;
  }

  try {
    await sanity.patch(documentId).ifRevisionId(settings._rev).set({ posts }).commit();
    console.log(`Added ${addedCount} Instagram posts to Sanity. Existing descriptions and visibility settings were kept.`);
    break;
  } catch (error) {
    if (error.statusCode !== 409 || attempt === 2) throw error;
  }
}
