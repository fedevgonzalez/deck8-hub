import { useState } from "react";
import { KeyGrid } from "@/components/key-grid";
import { KeyEditorDialog } from "@/components/key-editor-dialog";
import { keycodeToLabel } from "@/lib/keycodes";
import type { ActiveSlot, KeyConfig } from "@/lib/tauri";

interface KeyAssignmentViewProps {
  keys: KeyConfig[];
  keymaps: number[];
  editSlot: ActiveSlot;
  connected: boolean;
  onKeycodeChange: (keyIndex: number, keycode: number) => void;
}

export function KeyAssignmentView({
  keys,
  keymaps,
  editSlot,
  connected,
  onKeycodeChange,
}: KeyAssignmentViewProps) {
  const [selectedKey, setSelectedKey] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const keycodeLabels = keymaps.map((kc) => keycodeToLabel(kc));

  const handleKeyClick = (index: number) => {
    setSelectedKey(index);
    setEditorOpen(true);
  };

  return (
    <div className="flex flex-1 min-h-0 items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <KeyGrid
          keys={keys}
          editSlot={editSlot}
          selectedKey={selectedKey}
          onSelectKey={handleKeyClick}
          mode="keycode"
          keycodeLabels={keycodeLabels}
        />
        {!connected && (
          <div className="text-[10px] text-muted-foreground/50">
            Connect device to read/write key assignments
          </div>
        )}
      </div>

      {selectedKey !== null && (
        <KeyEditorDialog
          open={editorOpen}
          keyIndex={selectedKey}
          currentKeycode={keymaps[selectedKey]}
          onSave={(keycode) => onKeycodeChange(selectedKey, keycode)}
          onClose={() => {
            setEditorOpen(false);
            setSelectedKey(null);
          }}
        />
      )}
    </div>
  );
}
