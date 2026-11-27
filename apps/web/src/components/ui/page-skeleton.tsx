// Placeholder while a page's data loads: the rough shape of a heading and two
// panels, so a tap gives instant feedback instead of a blank screen. The pulse
// stops for people who prefer reduced motion.
export function PageSkeleton() {
  return (
    <div aria-busy="true" className="space-y-4 motion-safe:animate-pulse">
      <div className="h-8 w-2/3 max-w-sm rounded-xl bg-surface/80" />
      <div className="h-40 rounded-2xl bg-surface/80 shadow-soft" />
      <div className="h-28 rounded-2xl bg-surface/80 shadow-soft" />
    </div>
  );
}
