import {
  ImageIcon,
  LanguageIcon,
  MindmapIcon,
  PenIcon,
  SendIcon,
} from '@blocksuite/icons/lit';

import { AIProvider } from '../../provider/ai-provider.js';
import completeWritingWithAI from './templates/completeWritingWithAI.zip';
import freelyCommunicateWithAI from './templates/freelyCommunicateWithAI.zip';
import readAforeign from './templates/readAforeign.zip';
import redHat from './templates/redHat.zip';
import TidyMindMapV3 from './templates/TidyMindMapV3.zip';

export const AIPreloadConfig = [
  {
    icon: LanguageIcon(),
    text: '\u7528 AI \u9605\u8bfb\u5916\u6587\u6587\u7ae0',
    testId: 'read-foreign-language-article-with-ai',
    handler: () => {
      AIProvider.slots.requestInsertTemplate.next({
        template: readAforeign,
        mode: 'edgeless',
      });
    },
  },
  {
    icon: MindmapIcon(),
    text: '\u7528 AI \u601d\u7ef4\u5bfc\u56fe\u6574\u7406\u6587\u7ae0',
    testId: 'tidy-an-article-with-ai-mindmap-action',
    handler: () => {
      AIProvider.slots.requestInsertTemplate.next({
        template: TidyMindMapV3,
        mode: 'edgeless',
      });
    },
  },
  {
    icon: ImageIcon(),
    text: '\u4e3a\u6587\u7ae0\u6dfb\u52a0\u63d2\u56fe',
    testId: 'add-illustrations-to-the-article',
    handler: () => {
      AIProvider.slots.requestInsertTemplate.next({
        template: redHat,
        mode: 'edgeless',
      });
    },
  },
  {
    icon: PenIcon(),
    text: '\u7528 AI \u5b8c\u6210\u5199\u4f5c',
    testId: 'complete-writing-with-ai',
    handler: () => {
      AIProvider.slots.requestInsertTemplate.next({
        template: completeWritingWithAI,
        mode: 'edgeless',
      });
    },
  },
  {
    icon: SendIcon(),
    text: '\u4e0e AI \u81ea\u7531\u5bf9\u8bdd',
    testId: 'freely-communicate-with-ai',
    handler: () => {
      AIProvider.slots.requestInsertTemplate.next({
        template: freelyCommunicateWithAI,
        mode: 'edgeless',
      });
    },
  },
];
