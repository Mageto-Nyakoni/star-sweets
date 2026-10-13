import { defineField, defineType } from 'sanity';
import { instagramPostKey } from '../src/lib/galleryVisibility.js';

export const instagramGallerySettings = defineType({
  name: 'instagramGallerySettings',
  title: 'Instagram Gallery',
  type: 'document',
  fields: [
    defineField({
      name: 'intro',
      title: 'Gallery description',
      description: 'The text below the Gallery heading. This comes from Sanity, not Instagram.',
      type: 'text',
      rows: 3,
      initialValue: 'Cakes and baked goods made for past celebrations.',
      validation: (Rule) => Rule.required().max(300),
    }),
    defineField({
      name: 'posts',
      title: 'Post descriptions and visibility',
      description: 'Recent Instagram posts appear here after the gallery sync runs. Open a post to write its gallery description or hide it from the website, then publish.',
      type: 'array',
      of: [{
        type: 'object',
        name: 'galleryPostSetting',
        title: 'Instagram post',
        fields: [
          defineField({
            name: 'postUrl',
            title: 'Instagram post link',
            description: 'Copy the link from the post or reel on Instagram.',
            type: 'url',
            validation: (Rule) => Rule.required().custom((value) => (
              !value || instagramPostKey(value) ? true : 'Paste a full Instagram post or reel link.'
            )),
          }),
          defineField({
            name: 'description',
            title: 'Description shown on the gallery card',
            description: 'Leave blank to show no description. Instagram captions are never shown on the gallery.',
            type: 'text',
            rows: 2,
            validation: (Rule) => Rule.max(180),
          }),
          defineField({
            name: 'isHidden',
            title: 'Hide this post from the gallery',
            type: 'boolean',
            initialValue: false,
          }),
        ],
        preview: {
          select: { title: 'description', subtitle: 'postUrl', isHidden: 'isHidden' },
          prepare({ title, subtitle, isHidden }) {
            const postKey = instagramPostKey(subtitle);
            return {
              title: title || `${isHidden ? 'Hidden post' : 'Instagram post'}${postKey ? ` ${postKey}` : ''}`,
              subtitle,
            };
          },
        },
      }],
    }),
  ],
  preview: {
    prepare: () => ({ title: 'Instagram Gallery' }),
  },
});
