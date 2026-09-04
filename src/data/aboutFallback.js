export const aboutPageFallback = {
  homeEyebrow: 'Meet the baker',
  homeHeading: '[Add a short heading about yourself]',
  homeIntroduction: '[Add a two or three sentence introduction about who you are, your background, and what you want customers to know about you.]',
  portraitUrl: '',
  portraitAlt: 'Star Sweets baker',
  heroEyebrow: 'The story behind the sweets',
  heroTitle: 'About Star Sweets',
  heroIntroduction: '[Add a short introduction to your story and what Star Sweets means to you.]',
  storyEyebrow: 'Your introduction',
  storyHeading: '[Add your name or introduction heading]',
  biography: [
    '[Add your main biography here. You could include how you started baking, your professional background, and why you created Star Sweets.]',
    '[Add a second paragraph about your baking style, process, or what customers can expect when they order from you.]',
  ],
  valuesEyebrow: 'Your values',
  valuesHeading: '[Add a heading for what matters to you]',
  values: [
    { _key: 'value-one', title: '[First value]', description: '[Explain one principle that guides your work.]' },
    { _key: 'value-two', title: '[Second value]', description: '[Explain another part of your approach or service.]' },
    { _key: 'value-three', title: '[Third value]', description: '[Explain what customers can expect from you.]' },
  ],
  ctaEyebrow: "Let's make something memorable",
  ctaHeading: 'Ready to plan your cake?',
  ctaLabel: 'Start your order',
  seoTitle: 'About - Star Sweets',
  seoDescription: 'Meet the baker and owner behind the Star Sweets microbakery.',
};

export function withAboutPageFallback(content) {
  if (!content) return aboutPageFallback;

  return {
    ...aboutPageFallback,
    ...content,
    biography: Array.isArray(content.biography) && content.biography.length
      ? content.biography.filter(Boolean)
      : aboutPageFallback.biography,
    values: Array.isArray(content.values) && content.values.length
      ? content.values
      : aboutPageFallback.values,
  };
}
