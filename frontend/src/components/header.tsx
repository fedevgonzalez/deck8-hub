import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ActiveSlot } from "@/lib/tauri";
import { cn } from "@/lib/utils";

interface HeaderProps {
  connected: boolean;
  editSlot: ActiveSlot;
  activeSlot: ActiveSlot;
  onSlotChange: (slot: ActiveSlot) => void;
  onToggle: () => void;
  onReconnect: () => void;
}

export function Header({
  connected,
  editSlot,
  activeSlot,
  onSlotChange,
  onToggle,
  onReconnect,
}: HeaderProps) {
  return (
    <header className="flex items-center gap-3 px-4 py-2.5 border-b backdrop-blur-sm bg-black/40 border-white/[0.12]">
      {/* Title */}
      <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mr-2">
        Deck-8
      </span>

      {/* Slot switcher */}
      <div className="flex gap-0.5 bg-white/[0.04] rounded-lg p-0.5 border border-white/[0.08]">
        {(["A", "B"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSlotChange(s)}
            className={cn(
              "px-2.5 py-1 rounded-md text-[11px] font-medium transition-smooth",
              editSlot === s
                ? "bg-white text-black"
                : "text-muted-foreground hover:text-foreground/80",
            )}
          >
            {s}
            {activeSlot === s && (
              <span className={cn(
                "ml-1 inline-block w-1 h-1 rounded-full",
                editSlot === s ? "bg-green-600" : "bg-green-400",
              )} />
            )}
          </button>
        ))}
      </div>

      {/* Toggle */}
      <Button
        variant="ghost"
        size="sm"
        className="text-[11px] text-muted-foreground hover:text-foreground/80 h-7 px-2 transition-smooth"
        onClick={onToggle}
      >
        Toggle
        <kbd className="ml-1 px-1 text-[9px] rounded bg-white/5 border border-white/[0.08]">
          ^!M
        </kbd>
      </Button>

      <div className="flex-1" />

      {/* Status */}
      <Badge
        variant="outline"
        className={cn(
          "text-[10px] py-0 h-5 rounded-full",
          connected
            ? "border-green-500/30 text-green-400 bg-green-500/8"
            : "border-red-500/30 text-red-400 bg-red-500/8",
        )}
      >
        <span
          className={cn(
            "inline-block w-1.5 h-1.5 rounded-full mr-1.5",
            connected ? "bg-green-400" : "bg-red-400",
          )}
        />
        {connected ? "ON" : "OFF"}
      </Badge>

      <Button
        variant="ghost"
        size="sm"
        className="text-[10px] text-muted-foreground hover:text-foreground/80 h-6 px-2 transition-smooth"
        onClick={onReconnect}
      >
        Reconnect
      </Button>
    </header>
  );
}
