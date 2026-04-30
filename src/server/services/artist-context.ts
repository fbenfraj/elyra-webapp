import "server-only";

import { getUserSettings } from "@/server/services/user";
import { getCachedArtist } from "@/server/services/spotify-sync";

export type ArtistContext = {
  name: string;
  genres: string[] | null;
  audioProfile: {
    energy: number;
    valence: number;
    danceability: number;
    acousticness: number;
    instrumentalness: number;
    tempo: number;
    loudness: number;
  } | null;
  albums: Array<{ name: string; releaseDate: string; albumType: string }>;
};

export function buildArtistContextString(artist: ArtistContext): string {
  const parts: string[] = [];
  parts.push(`Artist: ${artist.name}`);
  if (artist.genres?.length) parts.push(`Genres: ${artist.genres.join(", ")}`);
  if (artist.audioProfile) {
    const ap = artist.audioProfile;
    parts.push(
      `Audio Profile: energy ${ap.energy.toFixed(2)}, valence ${ap.valence.toFixed(2)}, danceability ${ap.danceability.toFixed(2)}, acousticness ${ap.acousticness.toFixed(2)}, tempo ${ap.tempo.toFixed(0)}bpm`
    );
  }
  if (artist.albums.length) {
    const recent = artist.albums.slice(0, 8);
    parts.push(
      `Recent releases: ${recent.map((a) => `${a.name} (${a.releaseDate})`).join(", ")}`
    );
  }
  return parts.join("\n");
}

export async function loadArtistContext(userId: string): Promise<ArtistContext> {
  const settings = await getUserSettings(userId);
  if (!settings.artistId) {
    throw new Error(
      "No Spotify artist linked — connect an artist before generating"
    );
  }
  const artist = await getCachedArtist(settings.artistId);
  if (!artist) {
    throw new Error(`Cached artist not found for artistId: ${settings.artistId}`);
  }
  return artist;
}
