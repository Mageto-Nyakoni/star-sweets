import { defineField, defineType } from 'sanity';

export const homePage = defineType({
  name: 'homePage',
  title: 'Home Page',
  type: 'document',
  fields: [
    defineField({
      name: 'bannerImage',
      title: 'Banner image',
      type: 'image',
      options: { hotspot: true },
      description: 'The opening photo on the home page. Set its hotspot over the cake to frame the mobile photo. It is independent of Previous Orders and Baked Goods.',
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: { media: 'bannerImage' },
    prepare({ media }) {
      return { title: 'Home Page', subtitle: 'Banner image', media };
    },
  },
});
