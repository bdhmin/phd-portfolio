export interface Paper {
  title: string;
  subtitle: string;
  type: 'publication' | 'poster' | 'demo' | 'workshop' | 'abstract';
  authors: string[];
  venue: string;
  resources: {
    type: string;
    link: string;
  }[];
  thumbnail: string;
  award: string;
  note: string;
  tags: ('malleable' | 'human-ai' | 'abstraction')[];
}

export const papers: Paper[] = [
  {
    title: 'Malleable Overview-Detail Interfaces',
    subtitle: '',
    type: 'publication',
    authors: ['Bryan Min', 'Allen Chen', 'Yining Cao', 'Haijun Xia'],
    venue: 'CHI 2025',
    resources: [
      // {
      //   type: 'DOI',
      //   link: 'https://dl.acm.org/doi/10.1145/3613904.3642400',
      // },
      {
        type: 'Paper',
        link: `/papers/chi25-malleable-odi.pdf`,
      },
    ],
    thumbnail: '/thumbnails/malleable-odi.png',
    award: '',
    note: '',
    tags: ['malleable'],
  },
  {
    title: 'Feedforward in Generative AI',
    subtitle: 'Opportunities for a Design Space',
    type: 'workshop',
    authors: ['Bryan Min', 'Haijun Xia'],
    // venue: 'arXiv (February 2025)',
    venue: 'CHI 2025 Workshop on Tools for Thought',
    resources: [
      {
        type: 'DOI',
        link: `https://arxiv.org/abs/2502.14229`,
      },
      {
        type: 'Paper',
        link: `/papers/chi24-workshop-feedforward-genAI.pdf`,
      },
    ],
    thumbnail: '/thumbnails/feedforward-genAI.png',
    award: '',
    note: '',
    tags: ['human-ai'],
  },
  {
    title: 'Luminate',
    subtitle: 'Structured Generation and Exploration of Design Space with Large Language Models for Human-AI Co-Creation',
    type: 'publication',
    authors: ['Sangho Suh*', 'Meng Chen*', 'Bryan Min', 'Toby Jia-Jun Li', 'Haijun Xia'],
    venue: 'CHI 2024',
    resources: [
      {
        type: 'DOI',
        link: 'https://dl.acm.org/doi/10.1145/3613904.3642400',
      },
      {
        type: 'Paper',
        link: `/papers/chi24-luminate.pdf`,
      },
      {
        type: 'Website',
        link: `https://luminate-research.github.io/`,
      },
    ],
    thumbnail: '/thumbnails/luminate.jpg',
    award: '',
    note: '',
    tags: ['human-ai'],
  },
  // {
  //   title: 'ChoiceMates',
  //   subtitle: 'Supporting Unfamiliar Online Decision-Making with Multi-Agent Conversational Interactions',
  //   authors: ['Jeongeon Park', 'Bryan Min', 'Xiaojuan Ma', 'Juho Kim'],
  //   venue: 'arXiv (October 2023)',
  //   resources: [
  //     {
  //       type: 'DOI',
  //       link: 'https://doi.org/10.48550/arXiv.2310.01331',
  //     },
  //     {
  //       type: 'Paper',
  //       link: `${process.env.PUBLIC_URL}/papers/arxiv-choicemates.pdf`,
  //     },
  //   ],
  //   thumbnail: projects.ChoiceMates,
  //   award: '',
  //   note: ''
  // },
  {
    title: '',
    subtitle: 'How do multiple LLM-powered conversational agents assist sensemaking and decision-making in an unfamiliar domain?',
    type: 'workshop',
    authors: ['Jeongeon Park', 'Bryan Min', 'Jean Y. Song', 'Xiaojuan Ma', 'Juho Kim'],
    venue: 'CHI 2024 Sensemaking Workshop',
    resources: [
      {
        type: 'Paper',
        link: `/papers/chi24-sensemaking.pdf`,
      },
    ],
    thumbnail: '/thumbnails/choicemates.jpg',
    award: '',
    note: '',
    tags: ['human-ai'],
  },
  {
    title: 'Demonstration of Masonview',
    subtitle: 'Content-Driven Viewport Management',
    type: 'demo',
    authors: ['Bryan Min', 'Matthew T Beaudouin-Lafon', 'Sangho Suh', 'Haijun Xia'],
    venue: 'UIST 2023 Demos',
    resources: [
      {
        type: 'DOI',
        link: 'https://doi.org/10.1145/3586182.3615827',
      },
      {
        type: 'Paper',
        link: `/papers/uist23-demo-masonview.pdf`,
      },
      {
        type: 'Video',
        link: 'https://www.youtube.com/watch?v=HwHb02fxe5w&t=7s',
      },
      {
        type: 'Website',
        link: 'https://creativity.ucsd.edu/masonview',
      },
      {
        type: 'Twitter',
        link: 'https://x.com/bdhmin/status/1710326548857811044?s=20',
      },
    ],
    thumbnail: '/thumbnails/masonview.jpg',
    award: "Best Demo Honorable Mention (Jury's Choice)",
    note: '',
    tags: ['malleable'],
  },
  {
    title: 'Sensecape',
    subtitle: 'Enabling Multilevel Exploration and Sensemaking with Large Language Models',
    type: 'publication',
    authors: ['Sangho Suh', 'Bryan Min', 'Srishti Palani', 'Haijun Xia'],
    venue: 'UIST 2023',
    resources: [
      {
        type: 'DOI',
        link: 'https://doi.org/10.1145/3586183.3606756',
      },
      {
        type: 'Paper',
        link: `/papers/uist23-sensecape.pdf`,
      },
      {
        type: 'Video',
        link: 'https://www.youtube.com/watch?v=MIfhunAwZew&t=146s',
      },
      {
        type: 'Preview',
        link: 'https://www.youtube.com/watch?v=X3cpRVGuC2w',
      },
      {
        type: 'Website',
        link: 'https://creativity.ucsd.edu/ai',
      },
      {
        type: 'Twitter',
        link: 'https://twitter.com/HaijunXia/status/1646919380704559104?s=20',
      },
    ],
    thumbnail: '/thumbnails/sensecape.png',
    award: '',
    note: '',
    tags: ['human-ai'],
  }
]
