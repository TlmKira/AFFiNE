import {
  CodeBlockModel,
  ImageBlockModel,
  ListBlockModel,
  ParagraphBlockModel,
} from '@blocksuite/affine/model';
import { getSelectedModelsCommand } from '@blocksuite/affine/shared/commands';
import { matchModels } from '@blocksuite/affine/shared/utils';
import type { Chain, InitCommandCtx } from '@blocksuite/affine/std';
import {
  CommentIcon,
  DoneIcon,
  ExplainIcon,
  ImageIcon,
  ImproveWritingIcon,
  LanguageIcon,
  LongerIcon,
  MakeItRealIcon,
  MindmapIcon,
  PenIcon,
  PresentationIcon,
  SearchIcon,
  SelectionIcon,
  ShorterIcon,
  ToneIcon,
} from '@blocksuite/icons/lit';

import { actionToHandler } from '../actions/doc-handler';
import {
  imageFilterStyles,
  imageProcessingTypes,
  textTones,
  translateLangs,
} from '../actions/types';
import type {
  AIItemGroupConfig,
  AISubItemConfig,
} from '../components/ai-item/types';
import { AIProvider } from '../provider';
import { getAIPanelWidget } from '../utils/ai-widgets';
import { getEdgelessCopilotWidget } from '../utils/get-edgeless-copilot-widget';
import {
  AIImageIconWithAnimation,
  AIPenIconWithAnimation,
  AIPresentationIconWithAnimation,
  AIStarIconWithAnimation,
  MakeItRealIconWithAnimation,
} from './icons';

export const translateSubItem: AISubItemConfig[] = translateLangs.map(lang => {
  return {
    type: lang,
    testId: `action-translate-${lang}`,
    handler: actionToHandler('translate', AIStarIconWithAnimation, { lang }),
  };
});

export const toneSubItem: AISubItemConfig[] = textTones.map(tone => {
  return {
    type: tone,
    testId: `action-change-tone-${tone.toLowerCase()}`,
    handler: actionToHandler('changeTone', AIStarIconWithAnimation, { tone }),
  };
});

export function createImageFilterSubItem(
  trackerOptions?: BlockSuitePresets.TrackerOptions
) {
  return imageFilterStyles.map(style => {
    return {
      type: style,
      testId: `action-image-filter-${style.toLowerCase().replace(' ', '-')}`,
      handler: actionToHandler(
        'filterImage',
        AIImageIconWithAnimation,
        {
          style,
        },
        trackerOptions
      ),
    };
  });
}

export function createImageProcessingSubItem(
  trackerOptions?: BlockSuitePresets.TrackerOptions
) {
  return imageProcessingTypes.map(type => {
    return {
      type,
      testId: `action-image-processing-${type.toLowerCase().replace(' ', '-')}`,
      handler: actionToHandler(
        'processImage',
        AIImageIconWithAnimation,
        {
          type,
        },
        trackerOptions
      ),
    };
  });
}

const blockActionTrackerOptions: BlockSuitePresets.TrackerOptions = {
  control: 'block-action-bar',
  where: 'ai-panel',
};

const textBlockShowWhen = (chain: Chain<InitCommandCtx>) => {
  const [_, ctx] = chain
    .pipe(getSelectedModelsCommand, {
      types: ['block', 'text'],
    })
    .run();
  const { selectedModels } = ctx;
  if (!selectedModels || selectedModels.length === 0) return false;

  return selectedModels.some(model =>
    matchModels(model, [ParagraphBlockModel, ListBlockModel])
  );
};

const codeBlockShowWhen = (chain: Chain<InitCommandCtx>) => {
  const [_, ctx] = chain
    .pipe(getSelectedModelsCommand, {
      types: ['block', 'text'],
    })
    .run();
  const { selectedModels } = ctx;
  if (!selectedModels || selectedModels.length > 1) return false;

  const model = selectedModels[0];
  return matchModels(model, [CodeBlockModel]);
};

const imageBlockShowWhen = (chain: Chain<InitCommandCtx>) => {
  const [_, ctx] = chain
    .pipe(getSelectedModelsCommand, {
      types: ['block'],
    })
    .run();
  const { selectedModels } = ctx;
  if (!selectedModels || selectedModels.length > 1) return false;

  const model = selectedModels[0];
  return matchModels(model, [ImageBlockModel]);
};

const EditTextAIGroup: AIItemGroupConfig = {
  name: '\u7f16\u8f91\u6587\u672c',
  items: [
    {
      name: '\u7ffb\u8bd1\u4e3a',
      testId: 'action-translate',
      icon: LanguageIcon(),
      showWhen: textBlockShowWhen,
      subItem: translateSubItem,
    },
    {
      name: '\u8bed\u6c14\u8c03\u6574\u4e3a',
      testId: 'action-change-tone',
      icon: ToneIcon(),
      showWhen: textBlockShowWhen,
      subItem: toneSubItem,
    },
    {
      name: '\u4f18\u5316\u5199\u4f5c',
      testId: 'action-improve-writing',
      icon: ImproveWritingIcon(),
      showWhen: textBlockShowWhen,
      handler: actionToHandler('improveWriting', AIStarIconWithAnimation),
    },
    {
      name: '\u6269\u5199\u5185\u5bb9',
      testId: 'action-make-it-longer',
      icon: LongerIcon(),
      showWhen: textBlockShowWhen,
      handler: actionToHandler('makeLonger', AIStarIconWithAnimation),
    },
    {
      name: '\u7cbe\u7b80\u5185\u5bb9',
      testId: 'action-make-it-shorter',
      icon: ShorterIcon(),
      showWhen: textBlockShowWhen,
      handler: actionToHandler('makeShorter', AIStarIconWithAnimation),
    },
    {
      name: '\u7ee7\u7eed\u5199\u4f5c',
      testId: 'action-continue-writing',
      icon: PenIcon(),
      showWhen: textBlockShowWhen,
      handler: actionToHandler('continueWriting', AIPenIconWithAnimation),
    },
  ],
};

const DraftFromTextAIGroup: AIItemGroupConfig = {
  name: '\u57fa\u4e8e\u6587\u672c\u5199\u4f5c',
  items: [
    {
      name: '\u56f4\u7ed5\u6b64\u5185\u5bb9\u5199\u6587\u7ae0',
      testId: 'action-write-article',
      icon: PenIcon(),
      showWhen: textBlockShowWhen,
      handler: actionToHandler('writeArticle', AIPenIconWithAnimation),
    },
    {
      name: '\u56f4\u7ed5\u6b64\u5185\u5bb9\u5199\u77ed\u5e16',
      testId: 'action-write-twitter-post',
      icon: PenIcon(),
      showWhen: textBlockShowWhen,
      handler: actionToHandler('writeTwitterPost', AIPenIconWithAnimation),
    },
    {
      name: '\u56f4\u7ed5\u6b64\u5185\u5bb9\u5199\u8bd7',
      testId: 'action-write-poem',
      icon: PenIcon(),
      showWhen: textBlockShowWhen,
      handler: actionToHandler('writePoem', AIPenIconWithAnimation),
    },
    {
      name: '\u56f4\u7ed5\u6b64\u5185\u5bb9\u5199\u535a\u5ba2',
      testId: 'action-write-blog-post',
      icon: PenIcon(),
      showWhen: textBlockShowWhen,
      handler: actionToHandler('writeBlogPost', AIPenIconWithAnimation),
    },
    {
      name: '\u56f4\u7ed5\u6b64\u5185\u5bb9\u5934\u8111\u98ce\u66b4',
      testId: 'action-brainstorm',
      icon: PenIcon(),
      showWhen: textBlockShowWhen,
      handler: actionToHandler('brainstorm', AIPenIconWithAnimation),
    },
  ],
};

const ReviewImageAIGroup: AIItemGroupConfig = {
  name: '\u56fe\u50cf\u7406\u89e3',
  items: [
    {
      name: '\u89e3\u91ca\u8fd9\u5f20\u56fe\u7247',
      testId: 'action-explain-image',
      icon: PenIcon(),
      showWhen: imageBlockShowWhen,
      handler: actionToHandler('explainImage', AIStarIconWithAnimation),
    },
  ],
};

const ReviewCodeAIGroup: AIItemGroupConfig = {
  name: '\u4ee3\u7801\u5ba1\u9605',
  items: [
    {
      name: '\u89e3\u91ca\u8fd9\u6bb5\u4ee3\u7801',
      testId: 'action-explain-code',
      icon: ExplainIcon(),
      showWhen: codeBlockShowWhen,
      handler: actionToHandler('explainCode', AIStarIconWithAnimation),
    },
    {
      name: '\u68c0\u67e5\u4ee3\u7801\u9519\u8bef',
      testId: 'action-check-code-error',
      icon: ExplainIcon(),
      showWhen: codeBlockShowWhen,
      handler: actionToHandler('checkCodeErrors', AIStarIconWithAnimation),
    },
  ],
};

const ReviewTextAIGroup: AIItemGroupConfig = {
  name: '\u6587\u672c\u6821\u5bf9',
  items: [
    {
      name: '\u4fee\u6b63\u62fc\u5199',
      testId: 'action-fix-spelling',
      icon: DoneIcon(),
      showWhen: textBlockShowWhen,
      handler: actionToHandler('fixSpelling', AIStarIconWithAnimation),
    },
    {
      name: '\u4fee\u6b63\u8bed\u6cd5',
      testId: 'action-fix-grammar',
      icon: DoneIcon(),
      showWhen: textBlockShowWhen,
      handler: actionToHandler('improveGrammar', AIStarIconWithAnimation),
    },

    {
      name: '\u89e3\u91ca\u6240\u9009\u5185\u5bb9',
      testId: 'action-explain-selection',
      icon: SelectionIcon(),
      showWhen: textBlockShowWhen,
      handler: actionToHandler('explain', AIStarIconWithAnimation),
    },
  ],
};

const GenerateFromTextAIGroup: AIItemGroupConfig = {
  name: '\u6587\u672c\u751f\u6210',
  items: [
    {
      name: '\u603b\u7ed3\u8981\u70b9',
      testId: 'action-summarize',
      icon: PenIcon(),
      showWhen: textBlockShowWhen,
      handler: actionToHandler('summary', AIPenIconWithAnimation),
    },
    {
      name: '\u751f\u6210\u6807\u9898',
      testId: 'action-generate-headings',
      icon: PenIcon(),
      beta: true,
      handler: actionToHandler('createHeadings', AIPenIconWithAnimation),
      showWhen: chain => {
        const [_, ctx] = chain
          .pipe(getSelectedModelsCommand, {
            types: ['block', 'text'],
          })
          .run();
        const { selectedModels } = ctx;
        if (!selectedModels || selectedModels.length === 0) return false;

        return selectedModels.every(
          model =>
            matchModels(model, [ParagraphBlockModel, ListBlockModel]) &&
            !model.props.type.startsWith('h')
        );
      },
    },
    {
      name: '\u751f\u6210\u5927\u7eb2',
      testId: 'action-generate-outline',
      icon: PenIcon(),
      showWhen: textBlockShowWhen,
      handler: actionToHandler('writeOutline', AIPenIconWithAnimation),
    },
    {
      name: '\u751f\u6210\u56fe\u7247',
      testId: 'action-generate-image',
      icon: ImageIcon(),
      showWhen: textBlockShowWhen,
      handler: actionToHandler('createImage', AIImageIconWithAnimation),
    },
    {
      name: '\u7528\u8111\u56fe\u5934\u8111\u98ce\u66b4',
      testId: 'action-brainstorm-mindmap',
      icon: MindmapIcon(),
      showWhen: textBlockShowWhen,
      handler: actionToHandler('brainstormMindmap', AIPenIconWithAnimation),
    },
    {
      name: '\u751f\u6210\u6f14\u793a\u6587\u7a3f',
      testId: 'action-generate-presentation',
      icon: PresentationIcon(),
      showWhen: textBlockShowWhen,
      handler: actionToHandler('createSlides', AIPresentationIconWithAnimation),
      beta: true,
    },
    {
      name: '\u843d\u5730\u5b9e\u73b0',
      testId: 'action-make-it-real',
      icon: MakeItRealIcon(),
      beta: true,
      showWhen: textBlockShowWhen,
      handler: actionToHandler('makeItReal', MakeItRealIconWithAnimation),
    },
    {
      name: '\u63d0\u53d6\u884c\u52a8\u9879',
      testId: 'action-find-actions',
      icon: SearchIcon(),
      showWhen: textBlockShowWhen,
      handler: actionToHandler('findActions', AIStarIconWithAnimation),
      beta: true,
    },
  ],
};

const OthersAIGroup: AIItemGroupConfig = {
  name: '\u5176\u4ed6',
  items: [
    {
      name: '\u5728 AI \u5bf9\u8bdd\u4e2d\u7ee7\u7eed',
      testId: 'action-continue-with-ai',
      icon: CommentIcon(),
      handler: host => {
        const panel = getAIPanelWidget(host);
        const edgelessCopilot = getEdgelessCopilotWidget(host);
        AIProvider.slots.requestOpenWithChat.next({
          host,
          autoSelect: true,
        });
        edgelessCopilot.hideCopilotPanel();
        panel.hide();
      },
    },
  ],
};

export const pageAIGroups: AIItemGroupConfig[] = [
  ReviewTextAIGroup,
  ReviewCodeAIGroup,
  ReviewImageAIGroup,
  EditTextAIGroup,
  GenerateFromTextAIGroup,
  DraftFromTextAIGroup,
  OthersAIGroup,
];

export function buildAIImageItemGroups(): AIItemGroupConfig[] {
  return [
    {
      name: '\u56fe\u50cf\u7406\u89e3',
      items: [
        {
          name: '\u89e3\u91ca\u8fd9\u5f20\u56fe\u7247',
          testId: 'action-explain-image',
          icon: ImageIcon(),
          showWhen: () => true,
          handler: actionToHandler(
            'explainImage',
            AIStarIconWithAnimation,
            undefined,
            blockActionTrackerOptions
          ),
        },
      ],
    },
    {
      name: '\u6587\u672c\u751f\u6210',
      items: [
        {
          name: '\u751f\u6210\u56fe\u7247',
          testId: 'action-generate-image',
          icon: ImageIcon(),
          showWhen: () => true,
          handler: actionToHandler(
            'createImage',
            AIImageIconWithAnimation,
            undefined,
            blockActionTrackerOptions
          ),
        },
      ],
    },
    {
      name: '\u56fe\u7247\u5904\u7406',
      items: [
        {
          name: '\u56fe\u50cf\u5904\u7406',
          testId: 'action-image-processing',
          icon: ImageIcon(),
          showWhen: () => true,
          subItem: createImageProcessingSubItem(blockActionTrackerOptions),
          subItemOffset: [12, -6],
          beta: true,
        },
        {
          name: 'AI \u56fe\u50cf\u6ee4\u955c',
          testId: 'action-ai-image-filter',
          icon: ImproveWritingIcon(),
          showWhen: () => true,
          subItem: createImageFilterSubItem(blockActionTrackerOptions),
          subItemOffset: [12, -4],
          beta: true,
        },
        {
          name: '\u751f\u6210\u56fe\u7247\u8bf4\u660e',
          testId: 'action-generate-caption',
          icon: PenIcon(),
          showWhen: () => true,
          beta: true,
          handler: actionToHandler(
            'generateCaption',
            AIStarIconWithAnimation,
            undefined,
            blockActionTrackerOptions
          ),
        },
      ],
    },
    OthersAIGroup,
  ];
}

export function buildAICodeItemGroups(): AIItemGroupConfig[] {
  return [
    {
      name: '\u4ee3\u7801\u5ba1\u9605',
      items: [
        {
          name: '\u89e3\u91ca\u8fd9\u6bb5\u4ee3\u7801',
          testId: 'action-explain-code',
          icon: ExplainIcon(),
          showWhen: () => true,
          handler: actionToHandler(
            'explainCode',
            AIStarIconWithAnimation,
            undefined,
            blockActionTrackerOptions
          ),
        },
        {
          name: '\u68c0\u67e5\u4ee3\u7801\u9519\u8bef',
          testId: 'action-check-code-error',
          icon: ExplainIcon(),
          showWhen: () => true,
          handler: actionToHandler(
            'checkCodeErrors',
            AIStarIconWithAnimation,
            undefined,
            blockActionTrackerOptions
          ),
        },
      ],
    },
    OthersAIGroup,
  ];
}
