"use client";

const LOADING_GIF_SRC = "/media/Side_Quest_Loading_Animation.gif";

export function FullscreenLoadingOverlay({ label }: { label: string }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 px-6"
      style={{ backgroundColor: "#fbf8f2" }}
      role="status"
      aria-live="polite"
    >
      <img
        src={LOADING_GIF_SRC}
        alt=""
        className="max-h-[min(50vh,320px)] w-auto max-w-[min(90vw,400px)] object-contain"
        decoding="async"
      />
      <p className="text-center text-sm font-medium text-zinc-800">{label}</p>
    </div>
  );
}
