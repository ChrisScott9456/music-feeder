import 'dotenv/config';
import axios from 'axios';
import qs from 'qs';
import fs from 'fs';
import { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } from './lib/envVariables';
import { Album } from './interface/Album';
import { PlaylistTracks } from './interface/Playlist';

const playlistId = 'PLAYIST_ID_HERE';

// Cached tokens and expiration time
let cachedToken: string | null = null;
let tokenExpirationTime: number = 0;
let refreshToken: string | null = null;

/**
 * Get access token from Spotify to authorize requests.
 */
async function getAccessToken(): Promise<string> {
	const currentTime = Date.now();

	// If token is still valid, return
	if (cachedToken && currentTime < tokenExpirationTime) {
		return cachedToken;
	}

	// If the token is expired and we have a refresh token, try refreshing it
	if (refreshToken) {
		try {
			return await refreshAccessToken();
		} catch (error) {
			console.error('Error refreshing access token:', error);
		}
	}

	// If no valid token or refresh token, request a new one
	try {
		return await requestNewAccessToken();
	} catch (error) {
		console.error('Error requesting new access token:', error);
	}
}
/**
 * Request a new access token from Spotify.
 */
async function requestNewAccessToken(): Promise<string> {
	const tokenUrl = 'https://accounts.spotify.com/api/token';

	try {
		const response = await axios.post(
			tokenUrl,
			qs.stringify({
				grant_type: 'client_credentials',
			}),
			{
				headers: {
					Authorization: 'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64'),
					'Content-Type': 'application/x-www-form-urlencoded',
				},
			}
		);

		// Cache the new token and set the expiration time
		cachedToken = response.data.access_token;
		tokenExpirationTime = Date.now() + response.data.expires_in * 1000; // Expiration in milliseconds
		refreshToken = response.data.refresh_token; // Save the refresh token

		return cachedToken;
	} catch (error) {
		console.error('Error requesting access token from Spotify:', error);
	}
}

/**
 * Refresh the existing access token.
 */
async function refreshAccessToken(): Promise<string> {
	const tokenUrl = 'https://accounts.spotify.com/api/token';

	try {
		const response = await axios.post(
			tokenUrl,
			qs.stringify({
				grant_type: 'refresh_token',
				refresh_token: refreshToken,
			}),
			{
				headers: {
					Authorization: 'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64'),
					'Content-Type': 'application/x-www-form-urlencoded',
				},
			}
		);

		// Cache the new token and set the expiration time
		cachedToken = response.data.access_token;
		tokenExpirationTime = Date.now() + response.data.expires_in * 1000; // Expiration in milliseconds

		return cachedToken;
	} catch (error) {
		console.error('Error refreshing access token from Spotify:', error);
	}
}

async function getLatestRelease(artistId: string): Promise<Album[] | null> {
	try {
		const accessToken = await getAccessToken();

		const response = await axios.get<{ items: Album[] }>(`https://api.spotify.com/v1/artists/${artistId}/albums`, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		});

		console.log(response.data.items[0].name);

		// Check if any albums were returned
		if (response.data.items.length > 0) {
			return response.data.items; // The most recent album or single
		} else {
			console.log('No releases found for this artist.');
			return null;
		}
	} catch (error) {
		console.error('Error fetching latest release from Spotify:', error);
	}
}

async function getFullPlaylist(playlistId: string) {
	let playlist: PlaylistTracks;
	let URL = `https://api.spotify.com/v1/playlists/${playlistId}/tracks`;

	while (URL) {
		try {
			const accessToken = await getAccessToken();

			const response = await axios.get<PlaylistTracks>(URL, {
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
				params: {
					fields: 'next,items.track.artists.name, items.track.artists.id',
				},
			});

			if (!playlist) {
				playlist = response.data;
			} else {
				playlist.items.push(...response.data.items);
			}

			// Set the URL as the next URL provided for pagination
			URL = response.data.next;
		} catch (error) {
			console.error('Error fetching playlist from Spotify:', error);
		}
	}

	return playlist.items;
}

async function extractArtistsFromPlaylist() {
	const out = await getFullPlaylist(playlistId);

	let artistArray = out.map((el) => el.track.artists.flat());
	const artists = artistArray
		.flat()
		// .map((el) => el.name)
		.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

	const artistMap = new Map();

	for (let i = 0; i < artists.length; i++) {
		let value = artistMap.get(artists[i].name)?.count || 0;
		value++;
		artistMap.set(artists[i].name, { id: artists[i].id, count: value });
	}

	const sortedArtistCount = Array.from(artistMap)
		.map((el) => {
			return { name: el[0], value: { ...el[1], exclude: false } };
		})
		.sort((a, b) => b.value.count - a.value.count);

	fs.writeFileSync('output.json', JSON.stringify(sortedArtistCount, null, 2));

	console.log(sortedArtistCount);
}
