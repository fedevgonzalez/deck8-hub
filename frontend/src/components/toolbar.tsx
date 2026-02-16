import { useState } from "react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Keyboard,
  Palette,
  Settings,
  ChevronDown,
  FolderOpen,
  Save,
  SaveAll,
  RotateCcw,
  Trash2,
  ArrowLeftRight,
} from "lucide-react";
import type { ActiveSlot } from "@/lib/tauri";
import { cn } from "@/lib/utils";

interface ToolbarProps {
  connected: boolean;
  editSlot: ActiveSlot;
  activeSlot: ActiveSlot;
  onSlotChange: (slot: ActiveSlot) => void;
  onToggle: () => void;
  onReconnect: () => void;
  // Profile
  profiles: string[];
  currentProfile: string | null;
  onLoad: (name: string) => void;
  onSave: (name: string) => void;
  onDelete: (name: string) => void;
  onRestoreDefaults: () => void;
}

export function Toolbar({
  connected,
  editSlot,
  activeSlot,
  onSlotChange,
  onToggle,
  onReconnect,
  profiles,
  currentProfile,
  onLoad,
  onSave,
  onDelete,
  onRestoreDefaults,
}: ToolbarProps) {
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState("");
  const [restoreOpen, setRestoreOpen] = useState(false);

  return (
    <>
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

        {/* Slot A/B switcher */}
        <div className="flex items-center gap-1.5">
          <div className="flex gap-px bg-white/[0.04] rounded-md p-[2px] border border-white/[0.06]">
            {(["A", "B"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSlotChange(s)}
                className={cn(
                  "w-6 h-5 rounded-[4px] text-[10px] font-bold transition-all duration-100",
                  editSlot === s
                    ? "bg-white text-black shadow-sm"
                    : "text-white/30 hover:text-white/60",
                )}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Active slot indicator + swap */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggle}
                className="flex items-center gap-1 px-1.5 py-1 rounded-md text-white/25 hover:text-white/50 hover:bg-white/[0.04] transition-all duration-100"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80" />
                <span className="font-pixel text-[9px] text-white/35">{activeSlot}</span>
                <ArrowLeftRight className="w-2.5 h-2.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              <p className="text-[10px]">Swap active slot on device</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-white/[0.08]" />

        {/* Profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium text-white/35 hover:text-white/60 hover:bg-white/[0.04] transition-all duration-100"
            >
              <span className="font-pixel text-[9px] max-w-[80px] truncate">
                {currentProfile || "No profile"}
              </span>
              <ChevronDown className="w-3 h-3 opacity-50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-[#111113] border-white/12">
            <DropdownMenuLabel className="font-pixel text-[9px] text-white/30 uppercase tracking-wider">
              Profiles
            </DropdownMenuLabel>

            {profiles.length > 0 ? (
              profiles.map((name) => (
                <DropdownMenuItem
                  key={name}
                  className="font-pixel text-[10px] gap-2"
                  onClick={() => onLoad(name)}
                >
                  <FolderOpen className="w-3 h-3 text-white/30" />
                  <span className={cn(
                    "flex-1 truncate",
                    name === currentProfile && "text-emerald-400",
                  )}>
                    {name}
                  </span>
                  {name === currentProfile && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  )}
                </DropdownMenuItem>
              ))
            ) : (
              <div className="px-2 py-3 text-center">
                <span className="font-pixel text-[9px] text-white/20">No saved profiles</span>
              </div>
            )}

            <DropdownMenuSeparator className="bg-white/[0.06]" />

            <DropdownMenuItem
              className="font-pixel text-[10px] gap-2"
              disabled={!currentProfile}
              onClick={() => { if (currentProfile) onSave(currentProfile); }}
            >
              <Save className="w-3 h-3 text-white/30" />
              Save
            </DropdownMenuItem>
            <DropdownMenuItem
              className="font-pixel text-[10px] gap-2"
              onClick={() => { setSaveAsName(""); setSaveAsOpen(true); }}
            >
              <SaveAll className="w-3 h-3 text-white/30" />
              Save As...
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-white/[0.06]" />

            <DropdownMenuItem
              className="font-pixel text-[10px] gap-2"
              onClick={() => setRestoreOpen(true)}
            >
              <RotateCcw className="w-3 h-3 text-white/30" />
              Restore Defaults
            </DropdownMenuItem>

            {currentProfile && (
              <>
                <DropdownMenuSeparator className="bg-white/[0.06]" />
                <DropdownMenuItem
                  className="font-pixel text-[10px] gap-2 text-red-400/70 focus:text-red-400"
                  onClick={() => { setDeleteTarget(currentProfile); setDeleteOpen(true); }}
                >
                  <Trash2 className="w-3 h-3" />
                  Delete "{currentProfile}"
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Divider */}
        <div className="w-px h-4 bg-white/[0.08]" />

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

      {/* Save As Dialog */}
      <Dialog open={saveAsOpen} onOpenChange={setSaveAsOpen}>
        <DialogContent className="max-w-sm bg-[#111113] border-white/12 animate-scale-in">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Save Profile As</DialogTitle>
            <DialogDescription className="text-xs text-white/40">
              Enter a name for the new profile.
            </DialogDescription>
          </DialogHeader>
          <input
            className="w-full px-4 py-2.5 rounded-lg bg-[#09090b] border border-white/12 text-white/90 text-xs focus:outline-none focus:ring-2 focus:ring-white/25 placeholder:text-white/20 transition-smooth"
            placeholder="my-profile"
            value={saveAsName}
            onChange={(e) => setSaveAsName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && saveAsName.trim()) {
                const clean = saveAsName.trim().replace(/[^a-zA-Z0-9_-]/g, "");
                if (clean) { onSave(clean); setSaveAsOpen(false); }
              }
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" size="sm" className="text-xs text-white/40" onClick={() => setSaveAsOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm" className="text-xs font-semibold"
              disabled={!saveAsName.trim()}
              onClick={() => {
                const clean = saveAsName.trim().replace(/[^a-zA-Z0-9_-]/g, "");
                if (clean) { onSave(clean); setSaveAsOpen(false); }
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm bg-[#111113] border-white/12 animate-scale-in">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Delete Profile</DialogTitle>
            <DialogDescription className="text-xs text-white/40">
              Delete &quot;{deleteTarget}&quot;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" className="text-xs text-white/40" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xs bg-red-500 text-white hover:bg-red-600 font-semibold"
              onClick={() => {
                if (deleteTarget) onDelete(deleteTarget);
                setDeleteOpen(false);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Defaults */}
      <Dialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <DialogContent className="max-w-sm bg-[#111113] border-white/12 animate-scale-in">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Restore Defaults</DialogTitle>
            <DialogDescription className="text-xs text-white/40">
              Reset all key colors to defaults? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" className="text-xs text-white/40" onClick={() => setRestoreOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm" className="text-xs font-semibold"
              onClick={() => { onRestoreDefaults(); setRestoreOpen(false); }}
            >
              Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
