import { describe, expect, test } from 'vitest';

import { PAPER_STATUS_LABELS, PAPER_STATUS_ORDER } from './types';
import {
  feedItemToPaper,
  findDuplicatePaper,
  findFuzzyDuplicate,
  getPaperReadTime,
  groupPapersByTags,
  normalizePaperTags,
  parseCitationInput,
  parseCitationInputs,
  sortPapersByReadTimeDesc,
  type PaperRecord,
} from './utils';

const existing: PaperRecord[] = [
  {
    docId: 'paper-1',
    title: 'Attention Is All You Need',
    paper: {
      title: 'Attention Is All You Need',
      authors: ['Ashish Vaswani'],
      year: '2017',
      doi: '10.5555/3295222.3295349',
      arxivId: '1706.03762v5',
      url: 'https://arxiv.org/abs/1706.03762',
      status: 'to-read',
      createdFrom: 'manual',
      addedAt: '2026-01-01T00:00:00.000Z',
    },
  },
];

describe('papers utils', () => {
  test('blocks strong duplicates by DOI, arXiv without version, and URL', () => {
    expect(
      findDuplicatePaper(existing, {
        doi: 'https://doi.org/10.5555/3295222.3295349',
      })
    ).toEqual({ duplicated: true, docId: 'paper-1', reason: 'doi' });
    expect(findDuplicatePaper(existing, { arxivId: '1706.03762v1' })).toEqual({
      duplicated: true,
      docId: 'paper-1',
      reason: 'arxiv',
    });
    expect(
      findDuplicatePaper(existing, { url: 'https://arxiv.org/abs/1706.03762/' })
    ).toEqual({ duplicated: true, docId: 'paper-1', reason: 'url' });
  });

  test('marks fuzzy title author year duplicate without blocking', () => {
    expect(
      findFuzzyDuplicate(existing, {
        title: 'Attention: Is All You Need',
        authors: ['Ashish Vaswani'],
        year: '2017',
        status: 'reading',
        createdFrom: 'manual',
        addedAt: '2026-01-02T00:00:00.000Z',
      })?.docId
    ).toBe('paper-1');
  });

  test('parses DOI, arXiv, URL and BibTeX fallback inputs', () => {
    expect(parseCitationInput('arXiv:1706.03762').arxivId).toBe('1706.03762');
    expect(parseCitationInput('https://doi.org/10.1000/test').doi).toBe(
      '10.1000/test'
    );
    expect(parseCitationInput('https://example.com/paper').source).toBe(
      'example.com'
    );
    expect(
      parseCitationInput(
        '@article{x, title={A Paper}, author={A and B}, year={2024}}'
      ).authors
    ).toEqual(['A', 'B']);
    expect(
      parseCitationInput(
        'TY  - JOUR\nTI  - RIS Paper\nAU  - Zhang San\nPY  - 2025\nER  -'
      )
    ).toMatchObject({
      title: 'RIS Paper',
      authors: ['Zhang San'],
      year: '2025',
    });
  });

  test('parses multiple citation file entries locally', () => {
    expect(
      parseCitationInputs(
        '@article{a, title={First Paper}}\n@article{b, title={Second Paper}}'
      ).map(item => item.title)
    ).toEqual(['First Paper', 'Second Paper']);

    expect(
      parseCitationInputs(
        'TY  - JOUR\nTI  - First RIS\nER  -\nTY  - JOUR\nTI  - Second RIS\nER  -'
      ).map(item => item.title)
    ).toEqual(['First RIS', 'Second RIS']);

    expect(parseCitationInputs('[{"title":"CSL Paper"}]')[0].title).toBe(
      'CSL Paper'
    );
  });

  test('converts feed item and keeps Chinese status labels ordered', () => {
    expect(
      feedItemToPaper({
        id: 'item-1',
        subscriptionId: 'feed-1',
        workspaceId: 'ws',
        fingerprint: 'fp',
        title: 'Robot Vision Paper',
        authors: ['A'],
        url: 'https://arxiv.org/abs/2501.00001',
        doi: null,
        arxivId: '2501.00001',
        abstract: 'abstract',
        publishedAt: '2025-01-01T00:00:00.000Z',
        importedDocId: null,
      })
    ).toMatchObject({
      title: 'Robot Vision Paper',
      year: '2025',
      status: 'to-read',
      createdFrom: 'feed',
    });
    expect(
      PAPER_STATUS_ORDER.map(status => PAPER_STATUS_LABELS[status])
    ).toEqual(['待读', '略读', '精读', '复现中', '已引用', '归档']);
  });

  test('normalizes tags, groups untagged papers and repeats multi-tag papers', () => {
    expect(normalizePaperTags('视觉, 机器人，视觉\nSLAM')).toEqual([
      '视觉',
      '机器人',
      'SLAM',
    ]);

    const groups = groupPapersByTags([
      {
        ...existing[0],
        paper: {
          ...existing[0].paper,
          tags: ['视觉', '机器人'],
          lastReadAt: '2026-01-03T00:00:00.000Z',
        },
      },
      {
        docId: 'paper-2',
        title: 'Untagged Paper',
        paper: {
          title: 'Untagged Paper',
          authors: [],
          status: 'to-read',
          createdFrom: 'manual',
          addedAt: '2026-01-02T00:00:00.000Z',
        },
      },
    ]);

    expect(groups.map(group => group.tag)).toEqual(
      expect.arrayContaining(['视觉', '机器人', '未分类'])
    );
    expect(groups.at(-1)?.tag).toBe('未分类');
    expect(groups.find(group => group.tag === '视觉')?.records[0].docId).toBe(
      'paper-1'
    );
    expect(groups.find(group => group.tag === '机器人')?.records[0].docId).toBe(
      'paper-1'
    );
    expect(groups.find(group => group.tag === '未分类')?.records[0].docId).toBe(
      'paper-2'
    );
  });

  test('sorts papers by last read time and falls back to added time', () => {
    const records: PaperRecord[] = [
      {
        docId: 'old',
        title: 'Old',
        paper: {
          title: 'Old',
          status: 'to-read',
          createdFrom: 'manual',
          addedAt: '2026-01-01T00:00:00.000Z',
        },
      },
      {
        docId: 'read',
        title: 'Read',
        paper: {
          title: 'Read',
          status: 'reading',
          createdFrom: 'manual',
          addedAt: '2026-01-01T00:00:00.000Z',
          lastReadAt: '2026-01-04T00:00:00.000Z',
        },
      },
      {
        docId: 'added',
        title: 'Added',
        paper: {
          title: 'Added',
          status: 'to-read',
          createdFrom: 'manual',
          addedAt: '2026-01-03T00:00:00.000Z',
        },
      },
    ];

    expect(getPaperReadTime(records[0].paper)).toBe('2026-01-01T00:00:00.000Z');
    expect(
      sortPapersByReadTimeDesc(records).map(record => record.docId)
    ).toEqual(['read', 'added', 'old']);
  });
});
