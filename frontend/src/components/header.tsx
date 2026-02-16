import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
    <TooltipProvider>
      <header className="flex items-center px-4 py-2.5 border-b border-white/10 bg-[#0d0d0f]">
        {/* Left: Title */}
        <div className="flex-1 flex items-center">
          <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/40">
            Deck-8
          </span>
        </div>

        {/* Center: Slot controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.1em] text-white/25 font-medium select-none">
              Edit
            </span>
            <div className="flex gap-0.5 bg-white/[0.06] rounded-lg p-0.5 border border-white/10">
              {(["A", "B"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSlotChange(s)}
                  className={cn(
                    "px-3 py-1 rounded-md text-[11px] font-semibold transition-smooth",
                    editSlot === s
                      ? "bg-white text-black shadow-sm"
                      : "text-white/40 hover:text-white/70",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="w-px h-4 bg-white/10" />

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 cursor-default select-none">
                  <span className="text-[10px] uppercase tracking-[0.1em] text-white/25 font-medium">
                    Active
                  </span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.08] border border-white/10">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[10px] font-semibold text-white/60">
                      {activeSlot}
                    </span>
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                <p className="text-[11px] max-w-[200px] leading-relaxed">
                  The device alternates between slot A and B colors for each key.
                </p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[11px] text-white/40 hover:text-white/80 h-7 px-2 transition-smooth"
                  onClick={onToggle}
                >
                  Swap
                  <kbd className="ml-1.5 px-1.5 py-0.5 text-[9px] rounded bg-white/[0.06] border border-white/10 text-white/30">
                    ^!M
                  </kbd>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                <p className="text-[11px]">
                  Switch active slot on the device
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Right: Status */}
        <div className="flex-1 flex items-center justify-end gap-3">
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] font-semibold py-0 h-5 rounded-full",
              connected
                ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                : "border-red-500/30 text-red-400 bg-red-500/10",
            )}
          >
            <span
              className={cn(
                "inline-block w-1.5 h-1.5 rounded-full mr-1.5",
                connected ? "bg-emerald-400" : "bg-red-400",
              )}
            />
            {connected ? "ON" : "OFF"}
          </Badge>

          <Button
            variant="ghost"
            size="sm"
            className="text-[10px] text-white/30 hover:text-white/70 h-6 px-2 transition-smooth"
            onClick={onReconnect}
          >
            Reconnect
          </Button>
        </div>
      </header>
    </TooltipProvider>
  );
}
