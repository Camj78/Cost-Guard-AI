import Link from "next/link";

export default function FakeGate() {
  return (
    <div className="relative overflow-hidden rounded-lg border bg-muted/30">
      <div className="pointer-events-none select-none p-4 space-y-2 blur-sm opacity-60">
        <div className="h-4 w-28 rounded bg-muted-foreground/30" />
        <div className="h-3 w-full rounded bg-muted-foreground/20" />
        <div className="h-3 w-5/6 rounded bg-muted-foreground/20" />
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/60 backdrop-blur-[2px] px-4">
        <p className="text-xs font-semibold">🔒 Pro</p>
        <p className="text-[11px] text-muted-foreground text-center">
          Upgrade to unlock.
        </p>
        <Link
          href="/upgrade"
          className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 transition-opacity"
        >
          Upgrade to Pro
        </Link>
      </div>
    </div>
  );
}
