import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Keyboard,
  Palette,
  Settings,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import packageJson from "../../package.json";

interface ToolbarProps {
  connected: boolean;
  onReconnect: () => void;
}

export function Toolbar({
  connected,
  onReconnect,
}: ToolbarProps) {
  return (
    <header className="toolbar flex items-center gap-2 px-3 h-10 border-b border-white/[0.08] bg-[#0c0c0e]">
      {/* Brand */}
      <span className="font-pixel text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 mr-1 select-none">
        Deck-8
      </span>

      {/* Divider */}
      <div className="w-px h-4 bg-white/[0.08]" />

      {/* Tab pills — the primary navigation */}
      <TabsList className="h-7 bg-transparent border-0 p-0 gap-0.5 ml-1">
        <TabsTrigger
          value="keys"
          className="toolbar-tab text-[10px] h-7 rounded-md px-2.5 gap-1.5 font-semibold tracking-wide
            data-[state=inactive]:text-white/30 data-[state=inactive]:hover:text-white/55 data-[state=inactive]:hover:bg-white/[0.04]
            data-[state=active]:bg-white/[0.10] data-[state=active]:text-white/90 data-[state=active]:shadow-none
            transition-all duration-100 cursor-default"
        >
          <Keyboard className="w-3 h-3" />
          Keys
        </TabsTrigger>
        <TabsTrigger
          value="color"
          className="toolbar-tab text-[10px] h-7 rounded-md px-2.5 gap-1.5 font-semibold tracking-wide
            data-[state=inactive]:text-white/30 data-[state=inactive]:hover:text-white/55 data-[state=inactive]:hover:bg-white/[0.04]
            data-[state=active]:bg-white/[0.10] data-[state=active]:text-white/90 data-[state=active]:shadow-none
            transition-all duration-100 cursor-default"
        >
          <Palette className="w-3 h-3" />
          Color
        </TabsTrigger>
        <TabsTrigger
          value="sound"
          className="toolbar-tab text-[10px] h-7 rounded-md px-2.5 gap-1.5 font-semibold tracking-wide
            data-[state=inactive]:text-white/30 data-[state=inactive]:hover:text-white/55 data-[state=inactive]:hover:bg-white/[0.04]
            data-[state=active]:bg-white/[0.10] data-[state=active]:text-white/90 data-[state=active]:shadow-none
            transition-all duration-100 cursor-default"
        >
          <Volume2 className="w-3 h-3" />
          Sound
        </TabsTrigger>
        <TabsTrigger
          value="settings"
          className="toolbar-tab text-[10px] h-7 rounded-md px-2.5 gap-1.5 font-semibold tracking-wide
            data-[state=inactive]:text-white/30 data-[state=inactive]:hover:text-white/55 data-[state=inactive]:hover:bg-white/[0.04]
            data-[state=active]:bg-white/[0.10] data-[state=active]:text-white/90 data-[state=active]:shadow-none
            transition-all duration-100 cursor-default"
        >
          <Settings className="w-3 h-3" />
          Settings
        </TabsTrigger>
      </TabsList>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Version */}
      <span className="font-clean text-[9px] text-white/15 mr-1">
        v{packageJson.version}
      </span>

      {/* Connection status */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onReconnect}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-md transition-all duration-100",
              connected
                ? "text-emerald-400/70 hover:bg-emerald-500/10"
                : "text-red-400/70 hover:bg-red-500/10",
            )}
          >
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                connected ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" : "bg-red-400 animate-pulse-subtle",
              )}
            />
            <span className="font-pixel text-[9px] font-bold uppercase">
              {connected ? "ON" : "OFF"}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          <p className="text-[10px]">
            {connected ? "Device connected — click to refresh" : "Click to reconnect"}
          </p>
        </TooltipContent>
      </Tooltip>
    </header>
  );
}
