export const SHOW_DESKTOP_APP_DOWNLOAD = false;
export const SHOW_OPEN_IN_APP = false;

export const PRIVATE_SERVICE_NAME = 'Private Service';
export const PRIVATE_SERVICE_WORKSPACE_NAME = 'Remote Workspace';
export const SELF_HOSTED_SERVICE_NAME = 'Self-hosted Service';
export const PRIVATE_SERVICE_SUPPORT_EMAIL = 'support@example.com';
export const PRIVATE_SERVICE_SUPPORT_MAILTO = `mailto:${PRIVATE_SERVICE_SUPPORT_EMAIL}`;

type PrivateServiceUrlKey =
  | 'website'
  | 'community'
  | 'privacy'
  | 'terms'
  | 'blog'
  | 'download'
  | 'ai'
  | 'docs'
  | 'releaseNotes'
  | 'templateGuide';

export const PRIVATE_SERVICE_URLS: Record<PrivateServiceUrlKey, string | null> =
  {
    website: null,
    community: null,
    privacy: null,
    terms: null,
    blog: null,
    download: null,
    ai: null,
    docs: null,
    releaseNotes: null,
    templateGuide: null,
  };
