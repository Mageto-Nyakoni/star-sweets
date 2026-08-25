import type { APIRoute } from 'astro';
import { fetchMukbangs } from '../../lib/sanity.js';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const videos = await fetchMukbangs();
    return new Response(JSON.stringify(videos), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to fetch mukbang videos' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
