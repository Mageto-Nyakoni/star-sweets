import { createClient } from '@sanity/client';

const PROJECT_ID_RE = /^[a-z0-9-]+$/;

export function isSanityConfigured() {
  const id = import.meta.env.SANITY_PROJECT_ID;
  return typeof id === 'string' && PROJECT_ID_RE.test(id);
}

let _client;
function getClient() {
  if (!isSanityConfigured()) {
    throw new Error(
      'Sanity is not configured. Set SANITY_PROJECT_ID in .env (lowercase letters, digits, and dashes only).'
    );
  }
  if (!_client) {
    _client = createClient({
      projectId:  import.meta.env.SANITY_PROJECT_ID,
      dataset:    import.meta.env.SANITY_DATASET     ?? 'production',
      apiVersion: import.meta.env.SANITY_API_VERSION ?? '2024-01-01',
      useCdn: true,
    });
  }
  return _client;
}

export async function fetchRecipes(category) {
  return getClient().fetch(
    `*[_type == "recipe" && category == $category] | order(_createdAt desc) {
      _id,
      title,
      category,
      time,
      difficulty,
      "imageUrl": image.asset->url
    }`,
    { category }
  );
}

export async function fetchMukbangs() {
  return getClient().fetch(
    `*[_type == "mukbang"] | order(_createdAt desc) {
      _id,
      title,
      views,
      duration,
      "thumbnailUrl": thumbnail.asset->url
    }`
  );
}

export async function fetchAboutPage() {
  return getClient().fetch(
    `*[_type == "aboutPage" && _id == "aboutPage"][0] {
      homeEyebrow,
      homeHeading,
      homeIntroduction,
      "portraitUrl": portrait.asset->url,
      "portraitAlt": portrait.alt,
      heroEyebrow,
      heroTitle,
      heroIntroduction,
      storyEyebrow,
      storyHeading,
      biography,
      valuesEyebrow,
      valuesHeading,
      values[] {
        _key,
        title,
        description
      },
      ctaEyebrow,
      ctaHeading,
      ctaLabel,
      seoTitle,
      seoDescription
    }`
  );
}

export async function fetchCakeOrderOptions() {
  return getClient().fetch(
    `{
      "sizes": *[_type == "cakeSize" && isActive != false] | order(sortOrder asc, name asc) {
        _id,
        name,
        servings,
        basePrice
      },
      "frostings": *[_type == "cakeFrosting" && isActive != false] | order(sortOrder asc, name asc) {
        _id,
        name,
        description,
        priceModifier
      },
      "tiers": *[_type == "tierOption" && isActive != false] | order(sortOrder asc, tiers asc) {
        _id,
        tiers,
        label,
        priceModifier
      },
      "addOns": *[_type == "addOn" && isActive != false] | order(sortOrder asc, name asc) {
        _id,
        name,
        description,
        priceModifier
      },
      "gallery": *[_type == "inspirationGallery" && isActive != false] | order(sortOrder asc, _createdAt desc) {
        _id,
        caption,
        tags,
        "imageUrl": image.asset->url
      }
    }`
  );
}
