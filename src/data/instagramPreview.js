// Temporary layout placeholders. Real post content comes from Instagram.
const titles = [
  'Lorem ipsum dolor sit amet',
  'Consectetur adipiscing elit',
  'Sed do eiusmod tempor',
  'Incididunt ut labore',
  'Dolore magna aliqua',
  'Ut enim ad minim veniam',
];

export const instagramPreviewPosts = titles.map((title, index) => ({
  id: `placeholder-${index + 1}`,
  title,
  imageUrl: null,
  permalink: null,
  isVideo: false,
}));
