import { SpotifyArtistSettings } from "@/features/settings/components/SpotifyArtistSettings";

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">Account Settings</h1>
      <SpotifyArtistSettings />
    </div>
  );
}
