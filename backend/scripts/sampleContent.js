/**
 * Sample content for the AI Video Creation Workshop (development seed / demo).
 * In production, edit everything from Admin → Workshops and Admin → Marketing Resources.
 */
const workshop = {
  title: 'AI Video Creation Workshop',
  slug: 'ai-video-creation-workshop',
  campaignCode: 'CMP-AIVIDEO',
  tagline: 'Script, generate, voice and edit scroll-stopping Instagram & YouTube videos with AI — no camera crew needed.',
  description:
    'A hands-on, beginner-friendly workshop where you go from idea to finished video using AI. Write hooks and scripts with AI, generate cinematic clips from text and images, create AI avatars and natural voiceovers, auto-edit with captions and B-roll, and publish with a strategy that grows your views. You will leave with finished videos for your own channel.',
  learnings: [
    'Write viral hooks, scripts and storyboards with ChatGPT and Claude',
    'Generate cinematic clips with text-to-video and image-to-video tools',
    'Create a realistic AI avatar and clone your own voice',
    'Add AI voiceovers and dub videos into Hindi, Tamil, Malayalam and more',
    'Auto-edit Reels with captions, B-roll, music and transitions',
    'Design click-worthy thumbnails and plan a 30-day posting calendar',
  ],
  benefits: [
    '3+ finished AI videos for your channel',
    'Certificate of completion',
    'Lifetime access to recordings',
    '500+ video prompt pack & script templates',
    'Private creator community access',
  ],
  curriculum: [
    { title: 'The AI video toolkit', description: 'Which tool to use for scripts, visuals, voice and editing — and the free options.', duration: '45 min' },
    { title: 'Hooks, scripts & storyboards', description: 'Turn one idea into an Instagram Reel and a YouTube video script with AI.', duration: '60 min' },
    { title: 'Text-to-video & image-to-video', description: 'Prompting for cinematic shots, consistent characters and B-roll.', duration: '75 min' },
    { title: 'AI avatars & voiceovers', description: 'Talking-head avatars, voice cloning and multilingual dubbing.', duration: '60 min' },
    { title: 'Editing, captions & thumbnails', description: 'Auto-edit, captions, music and thumbnails that get clicks.', duration: '60 min' },
    { title: 'Publish, grow & monetize', description: 'Posting strategy, analytics, brand deals and selling video services.', duration: '45 min' },
  ],
  faqs: [
    { question: 'Do I need a camera or editing experience?', answer: 'No. Everything is created with AI on your laptop or phone. The workshop is designed for complete beginners.' },
    { question: 'Which tools will we use? Are they free?', answer: 'We use a mix of free and freemium AI tools for scripts, video generation, voice and editing. You can complete every exercise on free plans.' },
    { question: 'Can I make videos in Indian languages?', answer: 'Yes — we cover AI voiceovers and dubbing in Hindi, Tamil, Malayalam, Telugu, Kannada and more.' },
    { question: 'Will I get the recording?', answer: 'Yes, every paid participant gets lifetime access to the recording and the prompt pack.' },
    { question: 'Is the workshop online or in person?', answer: 'It is a live online workshop, so you can join from anywhere on your laptop or phone. You will receive the live session link right after payment.' },
  ],
  trainer: {
    name: 'Dev Trainer',
    title: 'AI Video Creator & Educator (sample data)',
    bio: 'Sample trainer profile for development. Replace it from Admin → Workshops → Edit with your trainer’s photo and bio.',
  },
};

const resources = [
  {
    title: 'Instagram caption pack',
    type: 'caption',
    textContent:
      '🎬 No camera? No editor? No problem.\nLearn to create viral Instagram & YouTube videos with AI — scripts, AI avatars, voiceovers and auto-editing — at the JenCorps AI Video Creation Workshop.\nLimited seats. Link in bio 👇',
  },
  {
    title: 'Hashtag set',
    type: 'hashtags',
    textContent: '#AIVideo #AIVideoCreation #InstagramReels #ReelsTips #ContentCreator #AIAvatar #TextToVideo #VideoEditing #YouTubeGrowth #JenCorps #CreatorEconomy',
  },
  {
    title: '30-second reel script',
    type: 'script',
    textContent:
      'Hook (0-3s): "This entire video was made by AI. Even my voice."\nBody (3-22s): Show the prompt → generated clip → AI voiceover → auto captions, side by side.\nProof (22-26s): "Took me 20 minutes, zero camera."\nCTA (26-30s): "Learn it live at the JenCorps AI Video Creation Workshop — link in my bio."',
  },
  {
    title: 'Story sequence (3 slides)',
    type: 'script',
    textContent:
      'Slide 1: Poll — "Would you post a video made 100% with AI?" (Yes / No way)\nSlide 2: Before/after clip of a script turned into a finished Reel.\nSlide 3: Link sticker → your referral link: "Learn how (limited seats) 🎬"',
  },
];

module.exports = { workshop, resources };
