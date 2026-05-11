import {
  EdgelessClipboardController,
  splitElements,
} from '@blocksuite/affine/blocks/root';
import { AIStarIconWithAnimation } from '@blocksuite/affine/components/icons';
import {
  MindmapElementModel,
  ShapeElementModel,
  TextElementModel,
} from '@blocksuite/affine/model';
import {
  CommentIcon,
  ExplainIcon,
  ImageIcon,
  ImproveWritingIcon,
  LanguageIcon,
  LongerIcon,
  MakeItRealIcon,
  MindmapIcon,
  MindmapNodeIcon,
  PenIcon,
  PresentationIcon,
  SearchIcon,
  SelectionIcon,
  ShorterIcon,
  ToneIcon,
} from '@blocksuite/icons/lit';

import {
  AIImageIconWithAnimation,
  AIMindMapIconWithAnimation,
  AIPenIconWithAnimation,
  AIPresentationIconWithAnimation,
  MakeItRealIconWithAnimation,
} from '../../_common/icons';
import {
  actionToHandler,
  imageOnlyShowWhen,
  mindmapChildShowWhen,
  mindmapRootShowWhen,
  notAllAIChatBlockShowWhen,
  noteBlockOrTextShowWhen,
  noteWithCodeBlockShowWen,
} from '../../actions/edgeless-handler';
import {
  imageFilterStyles,
  imageProcessingTypes,
  textTones,
  translateLangs,
} from '../../actions/types';
import type { AIItemGroupConfig } from '../../components/ai-item/types';
import { AIProvider } from '../../provider';
import { getAIPanelWidget } from '../../utils/ai-widgets';
import {
  getEdgelessCopilotWidget,
  mindMapToMarkdown,
} from '../../utils/edgeless';
import { extractSelectedContent } from '../../utils/extract';
import { canvasToBlob, randomSeed } from '../../utils/image';
import {
  getCopilotSelectedElems,
  imageCustomInput,
} from '../../utils/selection-utils';

const translateSubItem = translateLangs.map(lang => {
  return {
    type: lang,
    testId: `action-translate-${lang}`,
    handler: actionToHandler('translate', AIStarIconWithAnimation, { lang }),
  };
});

const toneSubItem = textTones.map(tone => {
  return {
    type: tone,
    testId: `action-change-tone-${tone.toLowerCase()}`,
    handler: actionToHandler('changeTone', AIStarIconWithAnimation, { tone }),
  };
});

export const imageFilterSubItem = imageFilterStyles.map(style => {
  return {
    type: style,
    testId: `action-image-filter-${style.toLowerCase().replace(' ', '-')}`,
    handler: actionToHandler(
      'filterImage',
      AIImageIconWithAnimation,
      {
        style,
      },
      imageCustomInput
    ),
  };
});

export const imageProcessingSubItem = imageProcessingTypes.map(type => {
  return {
    type,
    testId: `action-image-processing-${type.toLowerCase().replace(' ', '-')}`,
    handler: actionToHandler(
      'processImage',
      AIImageIconWithAnimation,
      {
        type,
      },
      imageCustomInput
    ),
  };
});

const othersGroup: AIItemGroupConfig = {
  name: '\u5176\u4ed6',
  items: [
    {
      name: '\u5728 AI \u5bf9\u8bdd\u4e2d\u7ee7\u7eed',
      testId: 'action-continue-with-ai',
      icon: CommentIcon({ width: '20px', height: '20px' }),
      showWhen: () => true,
      handler: host => {
        const panel = getAIPanelWidget(host);
        const edgelessCopilot = getEdgelessCopilotWidget(host);
        extractSelectedContent(host)
          .then(context => {
            AIProvider.slots.requestOpenWithChat.next({
              host,
              mode: 'edgeless',
              autoSelect: true,
              context,
            });
          })
          .catch(console.error);
        edgelessCopilot.hideCopilotPanel();
        panel.hide();
      },
    },
  ],
};

const editTextGroup: AIItemGroupConfig = {
  name: '\u7f16\u8f91\u6587\u672c',
  items: [
    {
      name: '\u7ffb\u8bd1\u4e3a',
      testId: 'action-translate',
      icon: LanguageIcon(),
      showWhen: noteBlockOrTextShowWhen,
      subItem: translateSubItem,
    },
    {
      name: '\u8bed\u6c14\u8c03\u6574\u4e3a',
      testId: 'action-change-tone',
      icon: ToneIcon(),
      showWhen: noteBlockOrTextShowWhen,
      subItem: toneSubItem,
    },
    {
      name: '\u4f18\u5316\u5199\u4f5c',
      testId: 'action-improve-writing',
      icon: ImproveWritingIcon(),
      showWhen: noteBlockOrTextShowWhen,
      handler: actionToHandler('improveWriting', AIStarIconWithAnimation),
    },

    {
      name: '\u6269\u5199\u5185\u5bb9',
      testId: 'action-make-it-longer',
      icon: LongerIcon(),
      showWhen: noteBlockOrTextShowWhen,
      handler: actionToHandler('makeLonger', AIStarIconWithAnimation),
    },
    {
      name: '\u7cbe\u7b80\u5185\u5bb9',
      testId: 'action-make-it-shorter',
      icon: ShorterIcon(),
      showWhen: noteBlockOrTextShowWhen,
      handler: actionToHandler('makeShorter', AIStarIconWithAnimation),
    },
    {
      name: '\u7ee7\u7eed\u5199\u4f5c',
      testId: 'action-continue-writing',
      icon: PenIcon(),
      showWhen: noteBlockOrTextShowWhen,
      handler: actionToHandler('continueWriting', AIPenIconWithAnimation),
    },
  ],
};

const draftFromTextGroup: AIItemGroupConfig = {
  name: '\u57fa\u4e8e\u6587\u672c\u5199\u4f5c',
  items: [
    {
      name: '\u56f4\u7ed5\u6b64\u5185\u5bb9\u5199\u6587\u7ae0',
      testId: 'action-write-article',
      icon: PenIcon(),
      showWhen: noteBlockOrTextShowWhen,
      handler: actionToHandler('writeArticle', AIPenIconWithAnimation),
    },
    {
      name: '\u56f4\u7ed5\u6b64\u5185\u5bb9\u5199\u77ed\u5e16',
      testId: 'action-write-twitter-post',
      icon: PenIcon(),
      showWhen: noteBlockOrTextShowWhen,
      handler: actionToHandler('writeTwitterPost', AIPenIconWithAnimation),
    },
    {
      name: '\u56f4\u7ed5\u6b64\u5185\u5bb9\u5199\u8bd7',
      testId: 'action-write-poem',
      icon: PenIcon(),
      showWhen: noteBlockOrTextShowWhen,
      handler: actionToHandler('writePoem', AIPenIconWithAnimation),
    },
    {
      name: '\u56f4\u7ed5\u6b64\u5185\u5bb9\u5199\u535a\u5ba2',
      testId: 'action-write-blog-post',
      icon: PenIcon(),
      showWhen: noteBlockOrTextShowWhen,
      handler: actionToHandler('writeBlogPost', AIPenIconWithAnimation),
    },
    {
      name: '\u56f4\u7ed5\u6b64\u5185\u5bb9\u5934\u8111\u98ce\u66b4',
      testId: 'action-brainstorm',
      icon: PenIcon(),
      showWhen: noteBlockOrTextShowWhen,
      handler: actionToHandler('brainstorm', AIPenIconWithAnimation),
    },
  ],
};

const reviewImageGroup: AIItemGroupConfig = {
  name: '\u56fe\u50cf\u7406\u89e3',
  items: [
    {
      name: '\u89e3\u91ca\u8fd9\u5f20\u56fe\u7247',
      icon: PenIcon(),
      testId: 'action-explain-image',
      showWhen: imageOnlyShowWhen,
      handler: actionToHandler(
        'explainImage',
        AIStarIconWithAnimation,
        undefined,
        imageCustomInput
      ),
    },
  ],
};

const reviewCodeGroup: AIItemGroupConfig = {
  name: '\u4ee3\u7801\u5ba1\u9605',
  items: [
    {
      name: '\u89e3\u91ca\u8fd9\u6bb5\u4ee3\u7801',
      icon: ExplainIcon(),
      testId: 'action-explain-code',
      showWhen: noteWithCodeBlockShowWen,
      handler: actionToHandler('explainCode', AIStarIconWithAnimation),
    },
    {
      name: '\u68c0\u67e5\u4ee3\u7801\u9519\u8bef',
      icon: ExplainIcon(),
      testId: 'action-check-code-error',
      showWhen: noteWithCodeBlockShowWen,
      handler: actionToHandler('checkCodeErrors', AIStarIconWithAnimation),
    },
  ],
};

const reviewTextGroup: AIItemGroupConfig = {
  name: '\u6587\u672c\u6821\u5bf9',
  items: [
    {
      name: '\u4fee\u6b63\u62fc\u5199',
      icon: PenIcon(),
      testId: 'action-fix-spelling',
      showWhen: noteBlockOrTextShowWhen,
      handler: actionToHandler('fixSpelling', AIStarIconWithAnimation),
    },
    {
      name: '\u4fee\u6b63\u8bed\u6cd5',
      icon: PenIcon(),
      testId: 'action-fix-grammar',
      showWhen: noteBlockOrTextShowWhen,
      handler: actionToHandler('improveGrammar', AIStarIconWithAnimation),
    },

    {
      name: '\u89e3\u91ca\u6240\u9009\u5185\u5bb9',
      icon: SelectionIcon({ width: '20px', height: '20px' }),
      testId: 'action-explain-selection',
      showWhen: noteBlockOrTextShowWhen,
      handler: actionToHandler('explain', AIStarIconWithAnimation),
    },
  ],
};

const generateFromTextGroup: AIItemGroupConfig = {
  name: '\u6587\u672c\u751f\u6210',
  items: [
    {
      name: '\u603b\u7ed3\u8981\u70b9',
      icon: PenIcon(),
      testId: 'action-summarize',
      showWhen: noteBlockOrTextShowWhen,
      handler: actionToHandler('summary', AIPenIconWithAnimation),
    },
    {
      name: '\u751f\u6210\u6807\u9898',
      icon: PenIcon(),
      testId: 'action-generate-headings',
      showWhen: noteBlockOrTextShowWhen,
      handler: actionToHandler('createHeadings', AIPenIconWithAnimation),
      beta: true,
    },
    {
      name: '\u751f\u6210\u5927\u7eb2',
      icon: PenIcon(),
      testId: 'action-generate-outline',
      showWhen: noteBlockOrTextShowWhen,
      handler: actionToHandler('writeOutline', AIPenIconWithAnimation),
    },
    {
      name: '\u751f\u6210\u56fe\u7247',
      icon: ImageIcon(),
      testId: 'action-generate-image',
      showWhen: notAllAIChatBlockShowWhen,
      handler: actionToHandler(
        'createImage',
        AIImageIconWithAnimation,
        undefined,
        async (host, ctx) => {
          const selectedElements = getCopilotSelectedElems(host);
          const len = selectedElements.length;

          const aiPanel = getAIPanelWidget(host);
          // text to image
          // from user input
          if (len === 0) {
            const content = aiPanel.inputText?.trim();
            if (!content) return;
            return {
              input: content,
            };
          }

          let content = ctx.get().content || '';

          // from user input
          if (content.length === 0) {
            content = aiPanel.inputText?.trim() || '';
          }

          const {
            images,
            shapes,
            notes: _,
            frames: __,
          } = splitElements(selectedElements);

          const pureShapes = shapes.filter(
            e =>
              !(
                e instanceof TextElementModel ||
                (e instanceof ShapeElementModel && e.text?.length)
              )
          );

          // text to image
          if (content.length && images.length + pureShapes.length === 0) {
            return {
              input: content,
            };
          }

          const edgelessClipboard = host.std.getOptional(
            EdgelessClipboardController
          );
          if (!edgelessClipboard) return;
          // image to image
          const canvas = await edgelessClipboard.toCanvas(images, pureShapes, {
            dpr: 1,
            padding: 0,
            background: 'white',
          });
          if (!canvas) return;

          const png = await canvasToBlob(canvas);
          if (!png) return;
          return {
            input: content,
            attachments: [png],
            seed: String(randomSeed()),
          };
        }
      ),
    },
    {
      name: '\u4ece\u6b64\u8111\u56fe\u8282\u70b9\u6269\u5c55',
      icon: MindmapNodeIcon(),
      testId: 'action-expand-mindmap-node',
      showWhen: mindmapChildShowWhen,
      handler: actionToHandler(
        'expandMindmap',
        AIMindMapIconWithAnimation,
        undefined,
        function (host) {
          const selected = getCopilotSelectedElems(host);
          const firstSelected = selected[0] as ShapeElementModel;
          const mindmap = firstSelected?.group;

          if (!(mindmap instanceof MindmapElementModel)) {
            return Promise.resolve({});
          }

          return Promise.resolve({
            input: firstSelected.text?.toString() ?? '',
            mindmap: mindMapToMarkdown(mindmap),
          });
        }
      ),
      beta: true,
    },
    {
      name: '\u7528\u8111\u56fe\u5934\u8111\u98ce\u66b4',
      icon: MindmapIcon(),
      testId: 'action-brainstorm-mindmap',
      showWhen: noteBlockOrTextShowWhen,
      handler: actionToHandler('brainstormMindmap', AIMindMapIconWithAnimation),
    },
    {
      name: '\u91cd\u65b0\u751f\u6210\u8111\u56fe',
      icon: MindmapIcon(),
      testId: 'action-regenerate-mindmap',
      showWhen: mindmapRootShowWhen,
      handler: actionToHandler(
        'brainstormMindmap',
        AIMindMapIconWithAnimation,
        {
          regenerate: true,
        }
      ),
    },
    {
      name: '\u751f\u6210\u6f14\u793a\u6587\u7a3f',
      icon: PresentationIcon(),
      testId: 'action-generate-presentation',
      showWhen: noteBlockOrTextShowWhen,
      handler: actionToHandler('createSlides', AIPresentationIconWithAnimation),
      beta: true,
    },
    {
      name: '\u843d\u5730\u5b9e\u73b0',
      icon: MakeItRealIcon({ width: '20px', height: '20px' }),
      testId: 'action-make-it-real',
      beta: true,
      showWhen: notAllAIChatBlockShowWhen,
      handler: actionToHandler(
        'makeItReal',
        MakeItRealIconWithAnimation,
        undefined,
        async (host, ctx) => {
          const selectedElements = getCopilotSelectedElems(host);

          // from user input
          if (selectedElements.length === 0) {
            const aiPanel = getAIPanelWidget(host);
            const content = aiPanel.inputText?.trim();
            if (!content) return;
            return {
              input: content,
            };
          }

          const { notes, frames, shapes, images, edgelessTexts } =
            splitElements(selectedElements);
          const f = frames.length;
          const i = images.length;
          const n = notes.length;
          const s = shapes.length;
          const e = edgelessTexts.length;

          if (f + i + n + s + e === 0) {
            return;
          }
          let content = ctx.get().content || '';

          // single note, text
          if (
            i === 0 &&
            n + s + e === 1 &&
            (n === 1 ||
              e === 1 ||
              (s === 1 && shapes[0] instanceof TextElementModel))
          ) {
            return {
              input: content,
            };
          }

          // from user input
          if (content.length === 0) {
            const aiPanel = getAIPanelWidget(host);
            content = aiPanel.inputText?.trim() || '';
          }

          const edgelessClipboard = host.std.getOptional(
            EdgelessClipboardController
          );
          if (!edgelessClipboard) return;
          const canvas = await edgelessClipboard.toCanvas(
            [...notes, ...frames, ...images],
            shapes,
            {
              dpr: 1,
              background: 'white',
            }
          );
          if (!canvas) return;
          const png = await canvasToBlob(canvas);
          if (!png) return;
          ctx.set({
            width: canvas.width,
            height: canvas.height,
          });

          return {
            input: content,
            attachments: [png],
          };
        }
      ),
    },
    {
      name: 'AI \u56fe\u50cf\u6ee4\u955c',
      icon: PenIcon(),
      testId: 'action-ai-image-filter',
      showWhen: imageOnlyShowWhen,
      subItem: imageFilterSubItem,
      subItemOffset: [12, -4],
      beta: true,
    },
    {
      name: '\u56fe\u50cf\u5904\u7406',
      icon: ImageIcon(),
      testId: 'action-image-processing',
      showWhen: imageOnlyShowWhen,
      subItem: imageProcessingSubItem,
      subItemOffset: [12, -6],
      beta: true,
    },
    {
      name: '\u751f\u6210\u56fe\u7247\u8bf4\u660e',
      icon: PenIcon(),
      testId: 'action-generate-caption',
      showWhen: imageOnlyShowWhen,
      beta: true,
      handler: actionToHandler(
        'generateCaption',
        AIStarIconWithAnimation,
        undefined,
        imageCustomInput
      ),
    },
    {
      name: '\u63d0\u53d6\u884c\u52a8\u9879',
      icon: SearchIcon(),
      testId: 'action-find-actions',
      showWhen: noteBlockOrTextShowWhen,
      handler: actionToHandler('findActions', AIStarIconWithAnimation),
      beta: true,
    },
  ],
};

export const edgelessAIGroups: AIItemGroupConfig[] = [
  reviewTextGroup,
  reviewCodeGroup,
  reviewImageGroup,
  editTextGroup,
  generateFromTextGroup,
  draftFromTextGroup,
  othersGroup,
];
