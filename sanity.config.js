import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { schemaTypes } from './schemaTypes/index.js';

const PROJECT_ID_RE = /^[a-z0-9-]+$/;
const envProjectId = process.env.SANITY_PROJECT_ID;
const projectId = PROJECT_ID_RE.test(envProjectId || '') ? envProjectId : 'your-project-id';
const dataset = process.env.SANITY_DATASET || 'production';

export default defineConfig({
  name: 'star-sweets',
  title: 'Star Sweets',
  projectId,
  dataset,
  plugins: [structureTool()],
  schema: {
    types: schemaTypes,
  },
});
