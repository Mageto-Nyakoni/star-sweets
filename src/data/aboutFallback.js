export const aboutPageFallback = {
  homeEyebrow: 'Meet the baker',
  homeHeading: '[Add a short heading about yourself]',
  homeIntroduction: 'Emily is a 23 year old self-taught baker, food enthusiast, and dental student. She enjoys sharing her love of food, especially sweet treats, with friends, family, and everyone in between. She hopes to bring smiles to others from her kitchen and dental practice!',
  portraitUrl: '/BakerHeadshot.png',
  portraitAlt: 'Star Sweets baker',
  heroEyebrow: 'The story behind the sweets',
  heroTitle: 'About Star Sweets',
  heroIntroduction: 'Pushing the boundaries of creativity with custom flavors and designs. From birthdays to graduations, these cakes are sure to make you feel like a star on your special day',
  storyEyebrow: 'Your introduction',
  storyHeading: '[Add your name or introduction heading]',
  biography: [
    'My first memory of baking was with my grandma as a young child making cookies together. My family has a tradition of baking box cakes for each of our birthdays, which inspired me to learn to bake them from scratch. I soon went on to teach myself everything I know now. My journey started in middle school and followed me all the way through university. I always loved baking for friends and family and showing my creativity through trying new recipes.',
    '[During my last year in undergrad, I created Star Sweets as a way to spread my love for baking beyond my close circle. I wanted the opportunity to bring light to someone’s special day and make them feel like a star. While my studies have brought me to dental school, my passion for baking has only burned brighter and I can’t wait to see what it brings to my dental career.',
  ],
  valuesEyebrow: 'Your values',
  valuesHeading: '[Add a heading for what matters to you]',
  values: [
    { _key: 'value-one', title: 'There are no boundaries for imagination', description: 'Thinking outside the box is where uniqueness and creativity live. My goal for each cake is to stand apart and shine in their own way.' },
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
