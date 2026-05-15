import test from 'ava';

import {
  cnkiExportHtmlToRefWorks,
  ResearchZoteroTranslatorService,
} from '../zotero-translator';
import type { ResearchZoteroRuntimeService } from '../zotero-runtime';

function createService() {
  const runtime = {
    translateHtml: async () => null,
    translateUrl: async () => null,
    listTranslators: async () => [],
    matchTranslators: async () => [],
  } as unknown as ResearchZoteroRuntimeService;

  return new ResearchZoteroTranslatorService(runtime);
}

test('loads Zotero translator manifests and matches Google Scholar', async t => {
  const service = createService();
  const translators = await service.listVendoredTranslators();
  const matched = await service.matchVendoredTranslators(
    'https://scholar.google.com/scholar?q=robot+vision'
  );

  t.true(translators.length > 100);
  t.true(matched.some(translator => translator.label === 'Google Scholar'));
});

test('translates Google Scholar search results into multiple candidates', async t => {
  const service = createService();
  const result = await service.translateHtml(
    'https://scholar.google.com/scholar?q=attention',
    `
      <html><body>
        <div class="gs_r" data-cid="abc123">
          <h3 class="gs_rt">
            <a href="https://arxiv.org/abs/1706.03762">Attention Is All You Need</a>
          </h3>
          <div class="gs_a">A Vaswani - 2017</div>
        </div>
      </body></html>
    `
  );

  t.truthy(result);
  t.is(result?.kind, 'multiple');
  if (result?.kind === 'multiple') {
    t.is(result.translator, 'Google Scholar');
    t.is(result.items[0].title, 'Attention Is All You Need');
    t.is(result.items[0].metadata?.arxivId, '1706.03762');
  }
});

test('translates generic citation meta tags', async t => {
  const service = createService();
  const result = await service.translateHtml(
    'https://example.org/paper',
    `
      <html>
        <head>
          <meta name="citation_title" content="Robot Vision Benchmark">
          <meta name="citation_author" content="Ada Lovelace">
          <meta name="citation_author" content="Grace Hopper">
          <meta name="citation_publication_date" content="2026/01/02">
          <meta name="citation_doi" content="10.1000/vision.2026">
          <meta name="citation_journal_title" content="Vision Robotics">
        </head>
      </html>
    `
  );

  t.is(result?.kind, 'single');
  if (result?.kind === 'single') {
    t.is(result.metadata.title, 'Robot Vision Benchmark');
    t.deepEqual(result.metadata.authors, ['Ada Lovelace', 'Grace Hopper']);
    t.is(result.metadata.year, '2026');
    t.is(result.metadata.doi, '10.1000/vision.2026');
  }
});

test('normalizes CNKI RefWorks export html', t => {
  const normalized = cnkiExportHtmlToRefWorks(
    "<ul class='literature-list'><li>RT Journal Article<br>T1 机器人视觉<br>A1 张三;李四<br>YR 2025<br></li></ul>"
  );

  t.true(normalized.includes('T1 机器人视觉'));
  t.true(normalized.includes('A1 张三'));
  t.true(normalized.includes('A1 李四'));
});
