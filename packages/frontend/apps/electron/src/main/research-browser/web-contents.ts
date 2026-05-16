const researchBrowserWebContents = new Set<number>();

export const markResearchBrowserWebContents = (contentsId: number) => {
  researchBrowserWebContents.add(contentsId);
};

export const unmarkResearchBrowserWebContents = (contentsId: number) => {
  researchBrowserWebContents.delete(contentsId);
};

export const isResearchBrowserWebContents = (contentsId: number) => {
  return researchBrowserWebContents.has(contentsId);
};

export const isAllowedResearchBrowserUrl = (rawUrl: string) => {
  try {
    const { protocol } = new URL(rawUrl);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};
