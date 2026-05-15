import test from 'ava';

import {
  parseBibTeXCitation,
  parseBibTeXCitations,
  parseCitationFormatEntries,
  parseCslJsonCitations,
  parseRefWorksCitation,
  parseRefWorksCitations,
  parseRisCitation,
} from '../citation-format';

test('parses BibTeX with nested braces', t => {
  const metadata = parseBibTeXCitation(`
    @article{vaswani2017attention,
      title = {Attention Is {All} You Need},
      author = {Vaswani, Ashish and Shazeer, Noam},
      year = {2017},
      journal = {NeurIPS},
      doi = {10.5555/3295222.3295349}
    }
  `);

  t.truthy(metadata);
  t.is(metadata?.title, 'Attention Is All You Need');
  t.deepEqual(metadata?.authors, ['Vaswani, Ashish', 'Shazeer, Noam']);
  t.is(metadata?.year, '2017');
  t.is(metadata?.doi, '10.5555/3295222.3295349');
});

test('parses multiple BibTeX entries', t => {
  const items = parseBibTeXCitations(`
    @article{a, title = {First Paper}, author = {A and B}, year = {2024}}
    @inproceedings{b, title = {Second Paper}, booktitle = {CVPR}, year = {2025}}
  `);

  t.is(items.length, 2);
  t.is(items[0].title, 'First Paper');
  t.is(items[1].source, 'CVPR');
});

test('parses RIS metadata', t => {
  const metadata = parseRisCitation(`
TY  - JOUR
TI  - Visual SLAM for Robot Navigation
AU  - Zhang, San
AU  - Li, Si
PY  - 2024
JO  - Robotics and Vision
DO  - 10.1000/robot.2024.1
AB  - A robot vision paper.
ER  -
`);

  t.truthy(metadata);
  t.is(metadata?.title, 'Visual SLAM for Robot Navigation');
  t.deepEqual(metadata?.authors, ['Zhang, San', 'Li, Si']);
  t.is(metadata?.source, 'Robotics and Vision');
  t.is(metadata?.abstract, 'A robot vision paper.');
});

test('parses RefWorks metadata', t => {
  const metadata = parseRefWorksCitation(`
RT Journal Article
T1 机器人视觉中的语义地图构建
A1 张三
A1 李四
YR 2025
JF 机器人学报
DO 10.1000/cn.2025.1
AB 中文摘要
`);

  t.truthy(metadata);
  t.is(metadata?.title, '机器人视觉中的语义地图构建');
  t.deepEqual(metadata?.authors, ['张三', '李四']);
  t.is(metadata?.year, '2025');
  t.is(metadata?.source, '机器人学报');
});

test('parses multiple RefWorks records without splitting authors', t => {
  const items = parseRefWorksCitations(`
RT Journal Article
T1 First Chinese Paper
A1 张三
A1 李四
RT Journal Article
T1 Second Chinese Paper
A1 王五
`);

  t.is(items.length, 2);
  t.deepEqual(items[0].authors, ['张三', '李四']);
  t.is(items[1].title, 'Second Chinese Paper');
});

test('parses CSL JSON records', t => {
  const items = parseCslJsonCitations(
    JSON.stringify([
      {
        title: 'Robot Vision from CSL',
        author: [{ given: 'Ada', family: 'Lovelace' }],
        issued: { 'date-parts': [[2026, 1, 1]] },
        DOI: '10.1000/csl.2026',
        'container-title': 'Vision Robotics',
      },
    ])
  );

  t.is(items.length, 1);
  t.is(items[0].title, 'Robot Vision from CSL');
  t.deepEqual(items[0].authors, ['Ada Lovelace']);
  t.is(items[0].year, '2026');
  t.is(items[0].doi, '10.1000/csl.2026');
});

test('detects supported citation file formats', t => {
  t.is(
    parseCitationFormatEntries(
      'TY  - JOUR\nTI  - A RIS Paper\nAU  - Ada\nER  -'
    )[0].title,
    'A RIS Paper'
  );
  t.is(
    parseCitationFormatEntries('[{"title":"A CSL Paper"}]')[0].title,
    'A CSL Paper'
  );
});
