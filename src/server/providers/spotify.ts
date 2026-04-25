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
