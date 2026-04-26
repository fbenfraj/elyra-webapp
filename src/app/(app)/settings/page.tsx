import { SpotifyArtistSettings } from "@/features/settings/components/SpotifyArtistSettings";
import { MoodboardIdentitySettings } from "@/features/settings/components/MoodboardIdentitySettings";

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">Account Settings</h1>
      <div className="space-y-6">
        <SpotifyArtistSettings />
        <MoodboardIdentitySettings />
      </div>
    </div>
  );
}
