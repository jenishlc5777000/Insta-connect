import { Captions, Clapperboard, Mic, Play, Sparkles, Wand2 } from 'lucide-react';

/**
 * Hero visual for the AI video workshop: an AI video editor with a vertical Reel preview,
 * generated timeline tracks and floating feature chips. Pure HTML/CSS/SVG (no stock media).
 * Upload a workshop banner image in the admin to replace it with your own artwork.
 */
export default function VideoHeroVisual() {
  const tracks = [
    { label: 'Video', color: 'from-brand to-blue-400', blocks: [[0, 28], [30, 24], [56, 26], [84, 16]] },
    { label: 'Voice', color: 'from-purple to-fuchsia-400', blocks: [[4, 40], [48, 36]] },
    { label: 'Captions', color: 'from-teal to-emerald-400', blocks: [[0, 14], [16, 12], [30, 18], [50, 14], [66, 20], [88, 12]] },
    { label: 'Music', color: 'from-amber-400 to-orange-400', blocks: [[0, 100]] },
  ];
  return (
    <div className="relative mx-auto w-full max-w-lg" aria-hidden="true">
      <div className="absolute -inset-8 rounded-[3rem] bg-gradient-to-tr from-brand/40 via-purple/30 to-teal/30 blur-3xl" />

      {/* editor window */}
      <div className="relative rounded-3xl border border-white/15 bg-[#0d1c36]/90 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="mb-3 flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-rose-400" />
          <span className="size-2.5 rounded-full bg-amber-400" />
          <span className="size-2.5 rounded-full bg-emerald-400" />
          <span className="ml-2 flex items-center gap-1.5 text-[11px] text-white/50"><Clapperboard className="size-3.5" /> ai-video-studio</span>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-4">
          {/* prompt panel */}
          <div className="space-y-3">
            <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-cyan-300"><Wand2 className="size-3.5" /> Prompt</p>
              <p className="text-[13px] leading-snug text-white/90">“A creator explaining 3 AI tools, cinematic lighting, fast cuts, vertical 9:16”</p>
            </div>
            <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
              <div className="mb-1.5 flex items-center justify-between text-[11px] text-white/60">
                <span className="flex items-center gap-1.5"><Sparkles className="size-3.5 text-amber-300" /> Generating…</span>
                <span className="font-semibold text-white">87%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-[87%] rounded-full bg-gradient-to-r from-teal to-cyan-300" />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {['9:16 Reel', '4K', 'Hindi + English', 'Auto B-roll'].map((t) => (
                <span key={t} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/80">{t}</span>
              ))}
            </div>
          </div>

          {/* vertical reel preview */}
          <div className="relative h-52 w-[7.5rem] overflow-hidden rounded-2xl bg-gradient-to-b from-[#1e3a8a] via-[#6E4FE8] to-[#0A9F90] ring-2 ring-white/20 sm:h-60 sm:w-32">
            <div className="absolute inset-0 opacity-40 [background:radial-gradient(circle_at_50%_35%,#fff_0,transparent_45%)]" />
            <svg viewBox="0 0 100 160" className="absolute inset-x-0 bottom-6 mx-auto w-20 opacity-90">
              <circle cx="50" cy="52" r="20" fill="#fde7d6" />
              <path d="M30 46c2-16 38-18 41 2-6-6-13-9-20-9s-14 3-21 7z" fill="#1f2937" />
              <path d="M16 140c0-28 16-44 34-44s34 16 34 44z" fill="#0B1F3A" />
              <rect x="40" y="70" width="20" height="10" rx="5" fill="#fde7d6" />
            </svg>
            <span className="absolute left-1/2 top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/25 backdrop-blur ring-1 ring-white/40">
              <Play className="size-5 translate-x-0.5 fill-white text-white" />
            </span>
            <p className="absolute inset-x-2 bottom-2 rounded-md bg-black/55 px-1.5 py-1 text-center text-[9px] font-bold uppercase leading-tight text-yellow-300">3 AI tools that edit for you</p>
          </div>
        </div>

        {/* timeline */}
        <div className="mt-4 space-y-1.5 rounded-2xl bg-black/20 p-3">
          {tracks.map((t) => (
            <div key={t.label} className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-[10px] text-white/50">{t.label}</span>
              <div className="relative h-3 flex-1 rounded bg-white/5">
                {t.blocks.map(([left, width], i) => (
                  <span key={i} className={`absolute inset-y-0 rounded bg-gradient-to-r ${t.color}`} style={{ left: `${left}%`, width: `${width}%` }} />
                ))}
              </div>
            </div>
          ))}
          <div className="relative ml-14 h-0">
            <span className="absolute -top-[4.6rem] left-[62%] h-[4.6rem] w-0.5 bg-rose-400" />
          </div>
        </div>
      </div>

      {/* floating chips */}
      <div className="absolute -top-5 right-24 hidden animate-float rounded-2xl bg-white px-3.5 py-2.5 shadow-xl sm:block">
        <p className="flex items-center gap-2 text-sm font-semibold text-navy"><Mic className="size-4 text-purple" /> AI voiceover</p>
      </div>
      <div className="absolute -bottom-5 -right-3 hidden animate-float rounded-2xl bg-white px-3.5 py-2.5 shadow-xl [animation-delay:1.5s] sm:block">
        <p className="flex items-center gap-2 text-sm font-semibold text-navy"><Captions className="size-4 text-teal" /> Auto captions</p>
      </div>
    </div>
  );
}
