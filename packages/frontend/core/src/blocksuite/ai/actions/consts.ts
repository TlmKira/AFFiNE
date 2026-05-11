export const EXCLUDING_COPY_ACTIONS = [
  'brainstormMindmap',
  'expandMindmap',
  'makeItReal',
  'createSlides',
  'createImage',
  'findActions',
  'filterImage',
  'processImage',
];

export const EXCLUDING_REPLACE_ACTIONS = [
  'brainstormMindmap',
  'expandMindmap',
  'makeItReal',
  'createSlides',
  'createImage',
  'filterImage',
  'processImage',
];

export const EXCLUDING_INSERT_ACTIONS = ['generateCaption'];

export const IMAGE_ACTIONS = ['createImage', 'processImage', 'filterImage'];

const commonImageStages = [
  '\u6b63\u5728\u751f\u6210\u56fe\u7247',
  '\u6b63\u5728\u6e32\u67d3\u56fe\u7247',
];

export const generatingStages: {
  [key in keyof Partial<BlockSuitePresets.AIActions>]: string[];
} = {
  makeItReal: [
    '\u6b63\u5728\u751f\u6210\u4ee3\u7801',
    '\u6b63\u5728\u6e32\u67d3\u4ee3\u7801',
  ],
  brainstormMindmap: [
    '\u6b63\u5728\u601d\u8003\u4e3b\u9898',
    '\u6b63\u5728\u6e32\u67d3\u601d\u7ef4\u5bfc\u56fe',
  ],
  createSlides: [
    '\u6b63\u5728\u601d\u8003\u4e3b\u9898',
    '\u6b63\u5728\u6e32\u67d3\u5e7b\u706f\u7247',
  ],
  createImage: commonImageStages,
  processImage: commonImageStages,
  filterImage: commonImageStages,
};

export const INSERT_ABOVE_ACTIONS = ['createHeadings'];
