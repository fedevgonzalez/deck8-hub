import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FolderOpen,
  Save,
  SaveAll,
  RotateCcw,
  Trash2,
} from "lucide-react";

interface ProfileBarProps {
  profiles: string[];
  currentProfile: string | null;
  onLoad: (name: string) => void;
  onSave: (name: string) => void;
  onDelete: (name: string) => void;
  onRestoreDefaults: () => void;
}

export function ProfileBar({
  profiles,
  currentProfile,
  onLoad,
  onSave,
  onDelete,
  onRestoreDefaults,
}: ProfileBarProps) {
  const [selected, setSelected] = useState<string>("");
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);

  const effectiveSelection = selected || currentProfile || "";

  return (
    <>
      <div className="flex items-center px-5 py-2.5 border-t border-white/10 bg-[#0d0d0f]">
        {/* Left: Profile label + selector */}
        <div className="flex-1 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.1em] text-white/25 font-medium select-none">
            Profile
          </span>
          <Select value={effectiveSelection} onValueChange={setSelected}>
            <SelectTrigger className="w-[140px] h-7 text-[11px] border border-white/10 hover:border-white/25 transition-smooth bg-[#141416] rounded-lg">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              {profiles.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Center: Action buttons grouped */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
          <Button
            variant="ghost" size="sm"
            className="text-[10px] text-white/35 hover:text-white/80 hover:bg-white/[0.06] h-7 px-2.5 gap-1.5 transition-smooth font-medium rounded-md"
            disabled={!effectiveSelection}
            onClick={() => { if (effectiveSelection) onLoad(effectiveSelection); }}
          >
            <FolderOpen className="w-3 h-3" />
            Load
          </Button>

          <div className="w-px h-3.5 bg-white/[0.08]" />

          <Button
            variant="ghost" size="sm"
            className="text-[10px] text-white/35 hover:text-white/80 hover:bg-white/[0.06] h-7 px-2.5 gap-1.5 transition-smooth font-medium rounded-md"
            disabled={!currentProfile}
            onClick={() => { if (currentProfile) onSave(currentProfile); }}
          >
            <Save className="w-3 h-3" />
            Save
          </Button>

          <div className="w-px h-3.5 bg-white/[0.08]" />

          <Button
            variant="ghost" size="sm"
            className="text-[10px] text-white/35 hover:text-white/80 hover:bg-white/[0.06] h-7 px-2.5 gap-1.5 transition-smooth font-medium rounded-md"
            onClick={() => { setSaveAsName(""); setSaveAsOpen(true); }}
          >
            <SaveAll className="w-3 h-3" />
            Save As
          </Button>

          <div className="w-px h-3.5 bg-white/[0.08]" />

          <Button
            variant="ghost" size="sm"
            className="text-[10px] text-white/35 hover:text-white/80 hover:bg-white/[0.06] h-7 px-2.5 gap-1.5 transition-smooth font-medium rounded-md"
            onClick={() => setRestoreOpen(true)}
          >
            <RotateCcw className="w-3 h-3" />
            Defaults
          </Button>
        </div>

        {/* Right: Delete */}
        <div className="flex-1 flex items-center justify-end">
          <Button
            variant="ghost" size="sm"
            className="text-[10px] text-red-400/40 hover:text-red-400 hover:bg-red-500/10 h-7 px-2.5 gap-1.5 transition-smooth font-medium rounded-md"
            disabled={!effectiveSelection}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </Button>
        </div>
      </div>

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
              Delete &quot;{effectiveSelection}&quot;? This cannot be undone.
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
                if (effectiveSelection) { onDelete(effectiveSelection); setSelected(""); }
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
