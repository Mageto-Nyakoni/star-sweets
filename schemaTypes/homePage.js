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
      description: 'The large image behind the opening section of the home page. It is independent of Previous Orders and Baked Goods.',
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
