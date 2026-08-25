import { defineCliConfig } from 'sanity/cli';

const PROJECT_ID_RE = /^[a-z0-9-]+$/;
const envProjectId = process.env.SANITY_PROJECT_ID;
const projectId = PROJECT_ID_RE.test(envProjectId || '') ? envProjectId : 'your-project-id';
const dataset = process.env.SANITY_DATASET || 'production';

export default defineCliConfig({
  api: {
    projectId,
    dataset,
  },
});
