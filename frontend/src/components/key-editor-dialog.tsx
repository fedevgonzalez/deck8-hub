import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  keycodeToLabel,
  getKeycodesByCategory,
  composeKeycode,
  decomposeKeycode,
  keyEventToKeycode,
  CATEGORIES,
  type KeycodeCategory,
  type KeycodeDef,
} from "@/lib/keycodes";
import { cn } from "@/lib/utils";

interface KeyEditorDialogProps {
  open: boolean;
  keyIndex: number;
  currentKeycode: number;
  onSave: (keycode: number) => void;
  onClose: () => void;
}

export function KeyEditorDialog({
  open,
  keyIndex,
  currentKeycode,
  onSave,
  onClose,
}: KeyEditorDialogProps) {
  const [newKeycode, setNewKeycode] = useState(currentKeycode);
  const [category, setCategory] = useState<KeycodeCategory>("basic");

  // Reset when dialog opens with new key
  useEffect(() => {
    if (open) {
      setNewKeycode(currentKeycode);
    }
  }, [open, currentKeycode]);

  // Physical keyboard capture
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const kc = keyEventToKeycode(e);
      if (kc !== null) {
        setNewKeycode(kc);
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [open]);

  const decomposed = decomposeKeycode(newKeycode);

  const toggleMod = useCallback(
    (mod: "ctrl" | "shift" | "alt" | "gui") => {
      const d = decomposeKeycode(newKeycode);
      const next = { ...d, [mod]: !d[mod] };
      setNewKeycode(composeKeycode(next.base, next.ctrl, next.shift, next.alt, next.gui));
    },
    [newKeycode],
  );

  const selectBase = useCallback(
    (code: number) => {
      const d = decomposeKeycode(newKeycode);
      // If selecting a special/non-basic code that can't have mods, set directly
      if (code > 0xff) {
        setNewKeycode(code);
      } else {
        setNewKeycode(composeKeycode(code, d.ctrl, d.shift, d.alt, d.gui));
      }
    },
    [newKeycode],
  );

  const keycodes = getKeycodesByCategory(category);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">
            Edit Key {keyIndex + 1}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Press a key or combination, or pick from the grid below.
          </DialogDescription>
        </DialogHeader>

        {/* Current → New display */}
        <div className="flex items-center justify-center gap-3 py-2">
          <KeycodeChip label={keycodeToLabel(currentKeycode)} muted />
          <span className="text-muted-foreground text-xs">&rarr;</span>
          <KeycodeChip label={keycodeToLabel(newKeycode)} />
        </div>

        {/* Modifier toggles */}
        <div className="flex gap-1.5 justify-center">
          {(["ctrl", "shift", "alt", "gui"] as const).map((mod) => (
            <button
              key={mod}
              type="button"
              className={cn(
                "px-2.5 py-1 rounded text-[10px] font-medium border transition-all",
                decomposed[mod]
                  ? "bg-white text-black border-white/40"
                  : "bg-transparent text-muted-foreground border-white/10 hover:border-white/20",
              )}
              onClick={() => toggleMod(mod)}
            >
              {mod === "gui" ? "Win" : mod.charAt(0).toUpperCase() + mod.slice(1)}
            </button>
          ))}
        </div>

        {/* Category tabs + virtual keyboard grid */}
        <Tabs value={category} onValueChange={(v) => setCategory(v as KeycodeCategory)}>
          <TabsList className="w-full">
            {CATEGORIES.map((cat) => (
              <TabsTrigger key={cat.id} value={cat.id} className="text-[10px]">
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {CATEGORIES.map((cat) => (
            <TabsContent key={cat.id} value={cat.id}>
              <div className="grid grid-cols-6 gap-1 max-h-[200px] overflow-y-auto p-1">
                {getKeycodesByCategory(cat.id).map((kc) => (
                  <VirtualKey
                    key={kc.code}
                    def={kc}
                    isActive={isBaseMatch(newKeycode, kc.code)}
                    onClick={() => selectBase(kc.code)}
                  />
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" size="sm" className="text-xs" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="text-xs"
            onClick={() => {
              onSave(newKeycode);
              onClose();
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KeycodeChip({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <span
      className={cn(
        "px-3 py-1.5 rounded-md text-xs font-medium border min-w-[60px] text-center",
        muted
          ? "bg-white/[0.03] border-white/10 text-muted-foreground"
          : "bg-white/10 border-white/20 text-foreground",
      )}
    >
      {label}
    </span>
  );
}

function VirtualKey({
  def,
  isActive,
  onClick,
}: {
  def: KeycodeDef;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "py-1.5 rounded text-[9px] font-medium border transition-all truncate",
        def.wide ? "col-span-2 px-2" : "px-1",
        isActive
          ? "bg-white text-black border-white/50"
          : "bg-white/[0.03] text-muted-foreground border-white/[0.06] hover:border-white/15 hover:text-foreground",
      )}
      onClick={onClick}
      title={def.label}
    >
      {def.label}
    </button>
  );
}

function isBaseMatch(keycode: number, defCode: number): boolean {
  if (defCode > 0xff) return keycode === defCode;
  const base = keycode <= 0xff ? keycode : keycode & 0xff;
  return base === defCode;
}
