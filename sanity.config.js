import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { schemaTypes } from './schemaTypes/index.js';

const ABOUT_PAGE_TYPE = 'aboutPage';

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
          S.divider(),
          ...S.documentTypeListItems().filter((item) => item.getId() !== ABOUT_PAGE_TYPE),
        ]),
    }),
  ],
  schema: {
    types: schemaTypes,
  },
  document: {
    actions: (previousActions, { schemaType }) => (
      schemaType === ABOUT_PAGE_TYPE
        ? previousActions.filter(({ action }) => action !== 'duplicate' && action !== 'delete')
        : previousActions
    ),
    newDocumentOptions: (previousOptions) => (
      previousOptions.filter(({ templateId }) => templateId !== ABOUT_PAGE_TYPE)
    ),
  },
});
