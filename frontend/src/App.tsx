import { TooltipProvider } from "@/components/ui/tooltip";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { Toolbar } from "@/components/toolbar";
import { ColorView } from "@/components/color-view";
import { KeyAssignmentView } from "@/components/key-assignment-view";
import { SettingsView } from "@/components/settings-view";
import { useDeck8 } from "@/hooks/use-deck8";
import { Unplug, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const isTauri = "__TAURI_INTERNALS__" in window;

export default function App() {
  const {
    state,
    selectedKey,
    setSelectedKey,
    profiles,
    connect,
    updateKeyColor,
    updateKeycode,
    toggleKeyOverride,
    toggleKeySlot,
    saveCustom,
    restoreDefaults,
    loadProfile,
    saveProfile,
    deleteProfile,
    updateRgb,
    updateRgbColor,
    saveRgb,
  } = useDeck8();

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col h-full select-none">
        {/* Connection indicator line — 2px bar at the very top */}
        <div
          className={cn(
            "h-[2px] shrink-0 transition-colors duration-300",
            state.connected
              ? "bg-emerald-500 shadow-[0_1px_8px_-1px_rgba(52,211,153,0.4)]"
              : "bg-red-500/70 shadow-[0_1px_8px_-1px_rgba(239,68,68,0.3)]",
          )}
        />

        {/* Main content with tabs — Toolbar is inside Tabs so TabsList works */}
        <Tabs defaultValue="keys" className="flex flex-col flex-1 min-h-0 !gap-0">
          {/* Unified toolbar: brand + tabs + slot controls + profile + connection */}
          <Toolbar
            connected={state.connected}
            onReconnect={connect}
            profiles={profiles}
            currentProfile={state.current_profile_name}
            onLoad={loadProfile}
            onSave={saveProfile}
            onDelete={deleteProfile}
            onRestoreDefaults={restoreDefaults}
          />

          <TabsContent value="keys" className="flex flex-col flex-1 min-h-0 overflow-hidden animate-fade-in">
            <KeyAssignmentView
              keys={state.keys}
              keymaps={state.keymaps}
              connected={state.connected}
              onKeycodeChange={updateKeycode}
            />
          </TabsContent>

          <TabsContent value="color" className="flex flex-col flex-1 min-h-0 overflow-hidden animate-fade-in">
            <ColorView
              keys={state.keys}
              selectedKey={selectedKey}
              onSelectKey={(i) => setSelectedKey(i === -1 ? null : i)}
              onColorChange={updateKeyColor}
              onToggleOverride={toggleKeyOverride}
              onToggleKeySlot={toggleKeySlot}
              onSaveCustom={saveCustom}
              connected={state.connected}
            />
          </TabsContent>

          <TabsContent value="settings" className="flex flex-col flex-1 min-h-0 overflow-hidden animate-fade-in">
            <SettingsView
              rgbMatrix={state.rgb_matrix}
              connected={state.connected}
              onRgbChange={updateRgb}
              onRgbColorChange={updateRgbColor}
              onRgbSave={saveRgb}
            />
          </TabsContent>
        </Tabs>

        {/* Connection overlay — only in Tauri, not in browser dev mode */}
        {isTauri && !state.connected && (
          <div className="connection-overlay fixed inset-0 z-50 flex items-center justify-center bg-[#09090b]/80 backdrop-blur-sm animate-fade-in">
            <div className="flex flex-col items-center gap-5 p-8 max-w-xs text-center">
              {/* Pulsing icon */}
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                  <Unplug className="w-7 h-7 text-white/20" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse-subtle" />
                </div>
              </div>

              {/* Text */}
              <div className="space-y-1.5">
                <h2 className="font-pixel text-sm text-white/70 font-bold">
                  No Device Connected
                </h2>
                <p className="font-pixel text-[10px] text-white/30 leading-relaxed">
                  Connect your Deck-8 via USB and click reconnect, or the app will auto-detect on plug-in.
                </p>
              </div>

              {/* Reconnect button */}
              <button
                type="button"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.08] border border-white/15 text-white/70 hover:bg-white/[0.14] hover:text-white/90 hover:border-white/25 transition-all duration-150 font-pixel text-[11px] font-bold"
                onClick={connect}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reconnect
              </button>

              {/* Skip hint */}
              <button
                type="button"
                className="font-pixel text-[8px] text-white/15 hover:text-white/30 uppercase tracking-wider transition-colors"
                onClick={() => {
                  // Hide overlay by dispatching a custom event
                  document.querySelector('.connection-overlay')?.classList.add('hidden');
                }}
              >
                continue without device
              </button>
            </div>
          </div>
        )}
      </div>
      <Toaster position="top-right" richColors />
    </TooltipProvider>
  );
}
