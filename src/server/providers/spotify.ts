// apps/web/src/server/providers/spotify.ts
import "server-only";

// ---------------------------------------------------------------------------
// Spotify Web API — client credentials flow (app-level, no user OAuth)
// ---------------------------------------------------------------------------

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

// In-memory token cache
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set");
  }

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error(`Spotify token request failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  // Cache with 60s safety margin
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return cachedToken.value;
}

async function spotifyGet<T>(path: string): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(`${SPOTIFY_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Spotify API ${path} failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

type SpotifyImage = { url: string; width: number; height: number };

type SpotifyArtist = {
  id: string;
  name: string;
  images: SpotifyImage[];
};

type SpotifyAlbum = {
  id: string;
  name: string;
  release_date: string;
  images: SpotifyImage[];
};

type SpotifyAlbumsResponse = {
  items: SpotifyAlbum[];
};

type SpotifyTrack = {
  id: string;
  name: string;
};

type SpotifyTopTracksResponse = {
  tracks: SpotifyTrack[];
};

type SpotifyAudioFeature = {
  id: string;
  energy: number;
  valence: number;
  danceability: number;
  acousticness: number;
  instrumentalness: number;
  tempo: number;
  loudness: number;
};

type SpotifyAudioFeaturesResponse = {
  audio_features: (SpotifyAudioFeature | null)[];
};

type SpotifyArtistFull = {
  id: string;
  name: string;
  images: SpotifyImage[];
  genres: string[];
  popularity: number;
  followers: { total: number };
};

type SpotifyAlbumFull = {
  id: string;
  name: string;
  release_date: string;
  album_type: string;
  images: SpotifyImage[];
};

type SpotifyAlbumsPagedResponse = {
  items: SpotifyAlbumFull[];
  next: string | null;
};

/**
 * Extract Spotify artist ID from a full URL or raw ID.
 *
 * Accepts:
 *  - https://open.spotify.com/artist/6eUKZXaKkcviH0Ku9w2n3V
 *  - https://open.spotify.com/artist/6eUKZXaKkcviH0Ku9w2n3V?si=xxx
 *  - 6eUKZXaKkcviH0Ku9w2n3V
 */
export function parseSpotifyArtistId(input: string): string {
  const trimmed = input.trim();

  // Raw ID (22-char alphanumeric)
  if (/^[a-zA-Z0-9]{22}$/.test(trimmed)) {
    return trimmed;
  }

  // Full URL
  const match = trimmed.match(
    /open\.spotify\.com\/artist\/([a-zA-Z0-9]{22})/
  );
  if (match) {
    return match[1];
  }

  throw new Error(`Invalid Spotify artist URL or ID: ${input}`);
}

/**
 * Fetch artist profile. Returns the largest profile image.
 */
export async function fetchArtistProfile(
  artistId: string
): Promise<{ name: string; image: SpotifyImage | null }> {
  const artist = await spotifyGet<SpotifyArtist>(`/artists/${artistId}`);

  // Spotify returns images sorted largest-first
  const image = artist.images[0] ?? null;

  return { name: artist.name, image };
}

/**
 * Fetch full artist profile including genres, popularity, and followers.
 */
export async function fetchArtistFull(
  artistId: string
): Promise<{
  name: string;
  image: SpotifyImage | null;
  genres: string[];
  popularity: number;
  followerCount: number;
}> {
  const artist = await spotifyGet<SpotifyArtistFull>(`/artists/${artistId}`);
  return {
    name: artist.name,
    image: artist.images[0] ?? null,
    genres: artist.genres,
    popularity: artist.popularity,
    followerCount: artist.followers.total,
  };
}

/**
 * Fetch album/single covers for an artist.
 * Returns the 3 most recent releases with valid cover images,
 * each using the largest available image variant.
 */
export async function fetchArtistCovers(
  artistId: string,
  limit: number = 3
): Promise<SpotifyImage[]> {
  const albums = await spotifyGet<SpotifyAlbumsResponse>(
    `/artists/${artistId}/albums?limit=10&include_groups=album,single`
  );

  const covers: SpotifyImage[] = [];

  for (const album of albums.items) {
    if (covers.length >= limit) break;

    // Largest image first
    const image = album.images[0];
    if (image) {
      covers.push(image);
    }
  }

  return covers;
}

/**
 * Search for artists by name using Spotify's search API.
 */
export async function searchArtists(
  query: string,
  limit: number = 5
): Promise<Array<{ id: string; name: string; imageUrl: string | null }>> {
  const encoded = encodeURIComponent(query.trim());
  const data = await spotifyGet<{
    artists: { items: SpotifyArtist[] };
  }>(`/search?q=${encoded}&type=artist&limit=${limit}`);

  return data.artists.items.map((artist) => ({
    id: artist.id,
    name: artist.name,
    imageUrl: artist.images[0]?.url ?? null,
  }));
}

/**
 * Fetch artist's top tracks. Returns track IDs for audio features lookup.
 */
export async function fetchArtistTopTracks(
  artistId: string
): Promise<string[]> {
  const data = await spotifyGet<SpotifyTopTracksResponse>(
    `/artists/${artistId}/top-tracks?market=US`
  );
  return data.tracks.map((t) => t.id);
}

/**
 * Fetch audio features for a batch of track IDs.
 * Returns null if the endpoint is unavailable (403 / deprecated).
 */
export async function fetchAudioFeatures(
  trackIds: string[]
): Promise<SpotifyAudioFeature[] | null> {
  if (trackIds.length === 0) return null;

  const token = await getAccessToken();
  const ids = trackIds.slice(0, 100).join(",");
  const response = await fetch(
    `${SPOTIFY_API_BASE}/audio-features?ids=${ids}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (response.status === 403) {
    console.warn("Spotify audio-features endpoint returned 403 — skipping");
    return null;
  }

  if (!response.ok) {
    console.warn(`Spotify audio-features failed: ${response.status} — skipping`);
    return null;
  }

  const data = (await response.json()) as SpotifyAudioFeaturesResponse;
  return data.audio_features.filter(
    (f): f is SpotifyAudioFeature => f !== null
  );
}

/**
 * Fetch all albums/singles for an artist (up to `limit`).
 * Returns albums sorted by release date (most recent first from Spotify).
 */
export async function fetchArtistAlbums(
  artistId: string,
  limit: number = 50
): Promise<
  Array<{
    id: string;
    name: string;
    releaseDate: string;
    albumType: string;
    coverImageUrl: string | null;
  }>
> {
  const data = await spotifyGet<SpotifyAlbumsPagedResponse>(
    `/artists/${artistId}/albums?include_groups=album,single&limit=${limit}`
  );

  return data.items.map((album) => ({
    id: album.id,
    name: album.name,
    releaseDate: album.release_date,
    albumType: album.album_type,
    coverImageUrl: album.images[0]?.url ?? null,
  }));
}
