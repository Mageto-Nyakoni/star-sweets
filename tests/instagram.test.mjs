import assert from 'node:assert/strict';
import test from 'node:test';
import { createInstagramClient, normalizeInstagramPost } from '../src/lib/instagram.js';

test('normalizes an image post for the gallery', () => {
  const post = normalizeInstagramPost({
    id: '123',
    media_type: 'IMAGE',
    media_url: 'https://example.com/cake.jpg',
    permalink: 'https://www.instagram.com/p/cake/',
    caption: 'Birthday cake\nChocolate and berries',
  });

  assert.deepEqual(post, {
    id: '123',
    imageUrl: 'https://example.com/cake.jpg',
    permalink: 'https://www.instagram.com/p/cake/',
    caption: 'Birthday cake\nChocolate and berries',
    title: 'Birthday cake',
    isVideo: false,
  });
});

test('uses a thumbnail for videos and video-first albums', () => {
  const video = normalizeInstagramPost({
    id: 'video',
    media_type: 'VIDEO',
    media_url: 'https://example.com/cake.mp4',
    thumbnail_url: 'https://example.com/cake.jpg',
    permalink: 'https://www.instagram.com/reel/cake/',
  });
  const album = normalizeInstagramPost({
    id: 'album',
    media_type: 'CAROUSEL_ALBUM',
    permalink: 'https://www.instagram.com/p/album/',
    children: { data: [{ media_type: 'VIDEO', thumbnail_url: 'https://example.com/cover.jpg' }] },
  });

  assert.equal(video.imageUrl, 'https://example.com/cake.jpg');
  assert.equal(video.isVideo, true);
  assert.equal(album.imageUrl, 'https://example.com/cover.jpg');
});

test('skips items without a safe image and Instagram link', () => {
  assert.equal(normalizeInstagramPost({ id: '1', media_url: 'http://example.com/image.jpg', permalink: 'https://www.instagram.com/p/1/' }), null);
  assert.equal(normalizeInstagramPost({ id: '2', media_url: 'https://example.com/image.jpg', permalink: 'https://fakeinstagram.com/p/2/' }), null);
});

const imageMedia = {
  id: '123',
  media_type: 'IMAGE',
  media_url: 'https://example.com/cake.jpg',
  permalink: 'https://www.instagram.com/p/cake/',
  caption: 'Birthday cake',
};

test('stays empty without credentials and makes no request', async () => {
  const fetchPosts = createInstagramClient({
    accessToken: '   ',
    request() { assert.fail('A gallery without a token must not contact Instagram'); },
  });

  assert.deepEqual(await fetchPosts(), []);
});

test('requests Instagram media with a private bearer token and normalizes the response', async () => {
  const fetchPosts = createInstagramClient({
    accessToken: ' test-token ',
    request: async (url, options) => {
      assert.equal(url.origin, 'https://graph.instagram.com');
      assert.equal(url.pathname, '/v25.0/me/media');
      assert.equal(url.searchParams.get('limit'), '24');
      assert.match(url.searchParams.get('fields'), /children\{media_type,media_url,thumbnail_url\}/);
      assert.equal(url.searchParams.has('access_token'), false);
      assert.equal(options.headers.Authorization, 'Bearer test-token');
      assert.ok(options.signal instanceof AbortSignal);
      return Response.json({ data: [imageMedia, { id: 'unusable' }] });
    },
  });

  assert.deepEqual(await fetchPosts(), [normalizeInstagramPost(imageMedia)]);
});

test('shares concurrent requests, caches for 15 minutes, and keeps previous posts during an outage', async () => {
  let requests = 0;
  let time = 0;
  let unavailable = false;
  const fetchPosts = createInstagramClient({
    accessToken: 'test-token',
    now: () => time,
    request: async () => {
      requests += 1;
      return unavailable
        ? new Response(null, { status: 503 })
        : Response.json({ data: [{ ...imageMedia, id: String(requests) }] });
    },
  });

  const [first, concurrent] = await Promise.all([fetchPosts(), fetchPosts()]);
  assert.deepEqual(concurrent, first);
  assert.equal(requests, 1);
  time = 15 * 60 * 1000 - 1;
  assert.deepEqual(await fetchPosts(), first);
  assert.equal(requests, 1);

  time += 1;
  unavailable = true;
  assert.deepEqual(await fetchPosts(), first);
  assert.equal(requests, 2);

  unavailable = false;
  assert.equal((await fetchPosts())[0].id, '3');
  assert.equal(requests, 3);
});

test('rejects an invalid token without exposing response details and can retry', async () => {
  let requests = 0;
  const fetchPosts = createInstagramClient({
    accessToken: 'private-test-token',
    request: async () => {
      requests += 1;
      return requests === 1
        ? Response.json({ error: 'private-test-token' }, { status: 401 })
        : Response.json({ data: [imageMedia] });
    },
  });

  await assert.rejects(fetchPosts, { message: 'Instagram media request failed (401)' });
  assert.equal((await fetchPosts()).length, 1);
});

test('rejects an unexpected response instead of treating it as an empty account', async () => {
  const fetchPosts = createInstagramClient({
    accessToken: 'test-token',
    request: async () => Response.json({ error: 'Missing media data' }),
  });

  await assert.rejects(fetchPosts, { message: 'Instagram media response was invalid' });
});
