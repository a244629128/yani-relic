"use client";

export default function VideoFields({ value, onChange }) {
  const v = value || { src: "", poster: "" };
  const hasVideo = !!v.src || (value && value.src === "");

  const update = (patch) => onChange({ ...v, ...patch });
  const remove = () => onChange(null);

  if (!value) {
    return (
      <button
        type="button"
        onClick={() => onChange({ src: "", poster: "" })}
        className="btn-relic !py-2 !px-4 !text-[11px]"
      >
        + Add video
      </button>
    );
  }

  return (
    <div className="space-y-3 bg-forest/40 border border-parchment/15 rounded-md p-3">
      <div>
        <label className="block text-cream-dim text-[10px] uppercase tracking-[0.18em] mb-1">
          Video src (path or URL)
        </label>
        <input
          type="text"
          value={v.src}
          onChange={(e) => update({ src: e.target.value })}
          placeholder="/relics/moss-heart.mp4"
          className="w-full bg-forest/50 border border-parchment/25 rounded-md px-3 py-2 text-cream text-sm focus:outline-none focus:border-labradorite-light"
        />
      </div>
      <div>
        <label className="block text-cream-dim text-[10px] uppercase tracking-[0.18em] mb-1">
          Poster (blank = use first image)
        </label>
        <input
          type="text"
          value={v.poster || ""}
          onChange={(e) => update({ poster: e.target.value })}
          placeholder="/relics/moss-heart-1.jpg"
          className="w-full bg-forest/50 border border-parchment/25 rounded-md px-3 py-2 text-cream text-sm focus:outline-none focus:border-labradorite-light"
        />
      </div>
      <button
        type="button"
        onClick={remove}
        className="text-rose-300/80 hover:text-rose-300 text-xs uppercase tracking-[0.18em]"
      >
        Remove video
      </button>
    </div>
  );
}
