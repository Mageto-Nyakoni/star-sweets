import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { schemaTypes } from './schemaTypes/index.js';

const ABOUT_PAGE_TYPE = 'aboutPage';
const INSTAGRAM_GALLERY_TYPE = 'instagramGallerySettings';
const SINGLETON_TYPES = [ABOUT_PAGE_TYPE, INSTAGRAM_GALLERY_TYPE];

export default defineConfig({
  name: 'star-sweets',
  title: 'Star Sweets',
  projectId: '34g7qoff',
  dataset: 'production',
  plugins: [
    structureTool({
      structure: (S) => S.list()
        .title('Content')
        .items([
          S.listItem()
            .id('aboutPage')
            .title('About Page')
            .child(
              S.document()
                .schemaType(ABOUT_PAGE_TYPE)
                .documentId('aboutPage')
            ),
          S.listItem()
            .id('instagramGallery')
            .title('Instagram Gallery')
            .child(
              S.document()
                .schemaType(INSTAGRAM_GALLERY_TYPE)
                .documentId('instagramGallerySettings')
            ),
          S.divider(),
          ...S.documentTypeListItems().filter((item) => !SINGLETON_TYPES.includes(item.getId())),
        ]),
    }),
  ],
  schema: {
    types: schemaTypes,
  },
  document: {
    actions: (previousActions, { schemaType }) => (
      SINGLETON_TYPES.includes(schemaType)
        ? previousActions.filter(({ action }) => action !== 'duplicate' && action !== 'delete')
        : previousActions
    ),
    newDocumentOptions: (previousOptions) => (
      previousOptions.filter(({ templateId }) => !SINGLETON_TYPES.includes(templateId))
    ),
  },
});
