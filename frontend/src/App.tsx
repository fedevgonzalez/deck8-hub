import { TooltipProvider } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { Header } from "@/components/header";
import { ColorView } from "@/components/color-view";
import { KeyAssignmentView } from "@/components/key-assignment-view";
import { ProfileBar } from "@/components/profile-bar";
import { useDeck8 } from "@/hooks/use-deck8";

export default function App() {
  const {
    state,
    selectedKey,
    setSelectedKey,
    editSlot,
    setEditSlot,
    profiles,
    connect,
    toggle,
    updateKeyColor,
    updateKeycode,
    toggleKeyOverride,
    restoreDefaults,
    loadProfile,
    saveProfile,
    deleteProfile,
  } = useDeck8();

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col h-screen select-none">
        {/* Header with slot selector */}
        <Header
          connected={state.connected}
          editSlot={editSlot}
          activeSlot={state.active_slot}
          onSlotChange={setEditSlot}
          onToggle={toggle}
          onReconnect={connect}
        />

        {/* Main content with tabs */}
        <Tabs defaultValue="keys" className="flex flex-col flex-1 min-h-0">
          <div className="px-4 pt-2">
            <TabsList>
              <TabsTrigger value="keys" className="text-[11px]">
                Key Assignment
              </TabsTrigger>
              <TabsTrigger value="color" className="text-[11px]">
                Color
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="keys" className="flex-1 min-h-0">
            <KeyAssignmentView
              keys={state.keys}
              keymaps={state.keymaps}
              editSlot={editSlot}
              connected={state.connected}
              onKeycodeChange={updateKeycode}
            />
          </TabsContent>

          <TabsContent value="color" className="flex-1 min-h-0">
            <ColorView
              keys={state.keys}
              editSlot={editSlot}
              selectedKey={selectedKey}
              onSelectKey={(i) => setSelectedKey(i === -1 ? null : i)}
              onColorChange={updateKeyColor}
              onToggleOverride={toggleKeyOverride}
            />
          </TabsContent>
        </Tabs>

        {/* Profile bar */}
        <ProfileBar
          profiles={profiles}
          currentProfile={state.current_profile_name}
          onLoad={loadProfile}
          onSave={saveProfile}
          onDelete={deleteProfile}
          onRestoreDefaults={restoreDefaults}
        />
      </div>
      <Toaster position="bottom-right" richColors />
    </TooltipProvider>
  );
}
