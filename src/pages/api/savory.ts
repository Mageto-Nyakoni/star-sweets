import type { APIRoute } from 'astro';
import { fetchRecipes } from '../../lib/sanity.js';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const recipes = await fetchRecipes('savory');
    return new Response(JSON.stringify(recipes), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to fetch savory recipes' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
