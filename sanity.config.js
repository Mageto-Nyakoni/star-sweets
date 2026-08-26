import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { schemaTypes } from './schemaTypes/index.js';

export default defineConfig({
  name: 'star-sweets',
  title: 'Star Sweets',
  projectId: '34g7qoff',
  dataset: 'production',
  plugins: [structureTool()],
  schema: {
    types: schemaTypes,
  },
});
