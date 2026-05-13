import { defineModuleConfig } from '../../base';

declare global {
  interface AppConfigSchema {
    researchCitation: {
      contactEmail: string;
      openAlexApiKey: string;
      semanticScholarApiKey: string;
    };
  }
}

defineModuleConfig('researchCitation', {
  contactEmail: {
    desc: 'Contact email used in polite User-Agent headers for open academic metadata APIs.',
    default: '',
    env: ['AFFINE_CITATION_CONTACT_EMAIL', 'string'],
  },
  openAlexApiKey: {
    desc: 'Optional OpenAlex API key. Leave empty for public low-volume usage.',
    default: '',
    env: ['OPENALEX_API_KEY', 'string'],
  },
  semanticScholarApiKey: {
    desc: 'Optional Semantic Scholar API key. Leave empty for public low-volume usage.',
    default: '',
    env: ['SEMANTIC_SCHOLAR_API_KEY', 'string'],
  },
});
