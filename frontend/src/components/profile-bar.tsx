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
      <div className="flex items-center gap-2 px-5 py-3 border-t border-white/[0.04]">
        <span className="text-[11px] text-muted-foreground mr-1">Profile</span>
        <Select value={effectiveSelection} onValueChange={setSelected}>
          <SelectTrigger className="w-[140px] h-7 text-[11px]">
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

        <Button
          variant="ghost" size="sm"
          className="text-[11px] text-muted-foreground hover:text-foreground h-7"
          disabled={!effectiveSelection}
          onClick={() => { if (effectiveSelection) onLoad(effectiveSelection); }}
        >
          Load
        </Button>

        <Button
          variant="ghost" size="sm"
          className="text-[11px] text-muted-foreground hover:text-foreground h-7"
          disabled={!currentProfile}
          onClick={() => { if (currentProfile) onSave(currentProfile); }}
        >
          Save
        </Button>

        <Button
          variant="ghost" size="sm"
          className="text-[11px] text-muted-foreground hover:text-foreground h-7"
          onClick={() => { setSaveAsName(""); setSaveAsOpen(true); }}
        >
          Save As
        </Button>

        <Button
          variant="ghost" size="sm"
          className="text-[11px] text-muted-foreground hover:text-foreground h-7"
          onClick={() => setRestoreOpen(true)}
        >
          Defaults
        </Button>

        <div className="flex-1" />

        <Button
          variant="ghost" size="sm"
          className="text-[11px] text-red-400/60 hover:text-red-400 hover:bg-red-500/10 h-7"
          disabled={!effectiveSelection}
          onClick={() => setDeleteOpen(true)}
        >
          Delete
        </Button>
      </div>

      {/* Save As Dialog */}
      <Dialog open={saveAsOpen} onOpenChange={setSaveAsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Save Profile As</DialogTitle>
            <DialogDescription className="text-xs">
              Enter a name for the new profile.
            </DialogDescription>
          </DialogHeader>
          <input
            className="w-full px-3 py-2 rounded-md bg-black border border-white/10 text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-white/25"
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
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSaveAsOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm" className="text-xs"
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

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Delete Profile</DialogTitle>
            <DialogDescription className="text-xs">
              Delete &quot;{effectiveSelection}&quot;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xs bg-red-500 text-white hover:bg-red-600"
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

      {/* Restore Defaults Dialog */}
      <Dialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Restore Defaults</DialogTitle>
            <DialogDescription className="text-xs">
              Reset all key colors to defaults? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setRestoreOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xs"
              onClick={() => {
                onRestoreDefaults();
                setRestoreOpen(false);
              }}
            >
              Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
