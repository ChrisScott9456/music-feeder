import 'dotenv/config';
import axios from 'axios';
import qs from 'qs';
import fs from 'fs';
import ejs from 'ejs';
import { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_PLAYLIST_ID, SPOTIFY_USER_CODE } from './lib/envVariables';
import { Album, AlbumResponse } from './interface/Album';
import { PlaylistTracks } from './interface/Playlist';
import path from 'path';
import { createTables, db, DB_TABLES } from './lib/knex';
import { CronJob } from 'cron';
import { Track } from './interface/Track';

const playlistId = 'PLAYIST_ID_HERE';

// Cached tokens and expiration time
let cachedToken: string | null = null;
let tokenExpirationTime: number = 0;
let refreshToken: string | null = null;

let cachedUserToken: string | null = null;
let tokenUserExpirationTime: number = 0;
let refreshUserToken: string | null = null;

/**
 * Get access token from Spotify to authorize requests.
 */
async function getAccessToken(userToken: boolean = false): Promise<string> {
	const currentTime = Date.now();

	// If token is still valid, return
	if (!userToken && cachedToken && currentTime < tokenExpirationTime) {
		// console.log('cachedToken');
		return cachedToken;
	} else if (cachedUserToken && currentTime < tokenUserExpirationTime) {
		// console.log('cachedUserToken');
		return cachedUserToken;
	}

	// If the token is expired and we have a refresh token, try refreshing it
	if (!userToken && refreshToken) {
		// console.log('refreshToken');
		return await refreshAccessToken();
	}

	if (refreshUserToken) {
		// console.log('refreshUserToken');
		return await refreshAccessToken(true);
	}

	// If no valid token or refresh token, request a new one
	try {
		if (userToken) {
			// console.log('requestUserToken');
			return await requestUserToken();
		} else {
			// console.log('requestPublicToken');
			return await requestPublicToken();
		}
	} catch (error) {
		console.error('Error requesting new access token:', error);
	}
}

async function requestPublicToken(): Promise<string> {
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
 * Request a new access token from Spotify.
 */
async function requestUserToken(): Promise<string> {
	const tokenUrl = 'https://accounts.spotify.com/api/token';

	try {
		const response = await axios.post(
			tokenUrl,
			qs.stringify({
				grant_type: 'authorization_code',
				code: SPOTIFY_USER_CODE,
				redirect_uri: 'http://google.com',
			}),
			{
				headers: {
					Authorization: 'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64'),
					'Content-Type': 'application/x-www-form-urlencoded',
				},
			}
		);

		// Cache the new token and set the expiration time
		cachedUserToken = response.data.access_token;
		tokenUserExpirationTime = Date.now() + response.data.expires_in * 1000; // Expiration in milliseconds
		refreshUserToken = response.data.refresh_token; // Save the refresh token

		await db(DB_TABLES.TOKEN).insert({ id: 1, refreshUserToken }).onConflict('id').merge();

		return cachedUserToken;
	} catch (error) {
		console.error('Error requesting access token from Spotify:', error);
	}
}

/**
 * Refresh the existing access token.
 */
async function refreshAccessToken(userToken: boolean = false): Promise<string> {
	const tokenUrl = 'https://accounts.spotify.com/api/token';

	try {
		const response = await axios.post(
			tokenUrl,
			qs.stringify({
				grant_type: 'refresh_token',
				refresh_token: userToken ? refreshUserToken : refreshToken,
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

async function getArtistAlbums(artistId: string, type?: string): Promise<Album[]> {
	const albumArr: Album[] = [];
	let URL = `https://api.spotify.com/v1/artists/${artistId}/albums`;

	while (URL) {
		try {
			const accessToken = await getAccessToken();

			const response = await axios.get<AlbumResponse>(URL, {
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
				params: {
					limit: 50,
					include_groups: type || 'album,single,compilation',
					fields: 'next,items.album_type,items.total_tracks,items.external_urls,items.href,items.id,items.images,items.name,items.release_date,items.type,items.uri,items.artists,items.album_group,',
				},
			});

			albumArr.push(...response.data.items);

			// Set the URL as the next URL provided for pagination
			URL = response.data.next;
		} catch (error) {
			console.error('Error fetching playlist from Spotify:', error);
		}
	}

	return albumArr;
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

interface ArtistCount {
	name: string;
	value: {
		id: string;
		count: number;
		exclude: boolean;
	};
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

	const sortedArtistCount: ArtistCount[] = Array.from(artistMap)
		.map((el) => {
			return { name: el[0], value: { ...el[1], exclude: false } };
		})
		.sort((a, b) => b.value.count - a.value.count);

	fs.writeFileSync('output.json', JSON.stringify(sortedArtistCount, null, 2));
	console.log(sortedArtistCount);
}

async function getAlbumTracks(albums: Album[]) {
	const trackURIList: string[] = [];
	try {
		for (let i = 0; i < 1; i++) {
			const URL = `https://api.spotify.com/v1/albums/${albums[i].id}/tracks`;
			const accessToken = await getAccessToken();

			const response = await axios.get<{ items: Track[] }>(URL, {
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
				params: {
					limit: 1,
				},
			});

			trackURIList.push(response.data.items[0].uri);
		}
	} catch (error) {
		console.error('Error getting album tracks from Spotify:', error);
	}

	return trackURIList;
}

async function writeToNewReleasesPlaylist(trackURIs: string[]) {
	const URL = `https://api.spotify.com/v1/playlists/${SPOTIFY_PLAYLIST_ID}/tracks`;
	try {
		const accessToken = await getAccessToken(true);

		await axios.post(
			URL,
			{
				uris: [trackURIs[0]],
			},
			{
				headers: {
					Authorization: `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				},
			}
		);
	} catch (error) {
		console.error('Error adding tracks to playlist in Spotify:', error.response);
	}
}

function readFile(filePath: string): ArtistCount[] {
	const data = fs.readFileSync(filePath, 'utf8');
	return JSON.parse(data);
}

function writeFile(filePath: string, newData: any) {
	let content = newData;

	fs.readFile(filePath, 'utf8', (err, data) => {
		if (err) {
			if (!err.stack.includes('no such file or directory')) {
				console.error('Error reading file:', err);
			}
			return;
		}

		content = newData + data;
	});

	fs.writeFile(filePath, content, 'utf8', (err) => {
		if (err) {
			console.error('Error writing to file:', err);
		}
	});
}

function removeObjectDuplicates(arr: Album[]) {
	const seen = new Map();

	return arr.filter((item) => {
		if (seen.has(item.id)) {
			return false; // Skip duplicates based on 'id'
		}
		seen.set(item.id, true);
		return true; // Keep the first occurrence
	});
}

function isFromThisYear(releaseDate) {
	const currentYear = new Date().getFullYear();
	const releaseYear = releaseDate.split('-')[0]; // Get the year from the release date string (format: YYYY-MM-DD)

	return releaseYear === String(currentYear); // Compare the release year with the current year
}

function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getRefreshUserTokenFromDB() {
	const newToken = await db(DB_TABLES.TOKEN).where('id', 1).first();
	return newToken.refreshUserToken;
}

async function run() {
	await createTables();

	// Get refresh token from DB on every run
	const newToken = await getRefreshUserTokenFromDB();
	refreshUserToken = newToken;

	const artistArr = readFile(path.join(__dirname, '..', 'config', 'input.json'));

	let sortedAlbumArr: Album[] = [];

	for (let i = 0; i < artistArr.length; i++) {
		const albumArr = await getArtistAlbums(artistArr[i].value.id);

		// Only include releases from this year
		sortedAlbumArr.push(...albumArr.filter((album) => isFromThisYear(album.release_date)));

		// Wait for 200 milliseconds between sets of requests to avoid rate limit issues
		await delay(100);
	}

	// Sort by release date and remove any duplicates in the array
	sortedAlbumArr = removeObjectDuplicates(sortedAlbumArr.sort((a, b) => b.release_date.localeCompare(a.release_date)));

	const newAlbums: Album[] = [];

	/*
	 * Iterate across the array of sorted albums and add them to the db
	 */
	for (let i = 0; i < sortedAlbumArr.length; i++) {
		const albumExists = await db(DB_TABLES.ALBUMS).where('id', sortedAlbumArr[i].id).first();

		if (albumExists) {
			break;
		}

		await db(DB_TABLES.ALBUMS).insert(sortedAlbumArr[i]).onConflict('id').ignore();
		newAlbums.push(sortedAlbumArr[i]);
	}

	if (newAlbums.length > 0) {
		const trackURIs = await getAlbumTracks(newAlbums);
		await writeToNewReleasesPlaylist(trackURIs);

		ejs.renderFile(path.join(__dirname, '..', 'config', 'release.ejs'), { newAlbums }, (err, str) => {
			if (err) {
				console.error(err);
				return;
			}

			writeFile('/output/MusicFeed.md', str); //! This is a Docker-specific mounted location
		});

		console.log(`${newAlbums.length} new albums added to the list!`);
	} else {
		console.log('No new albums to add!');
	}
}

export const runCronJob = new CronJob(
	'0 0 * * *', // Run once a day at midnight
	async () => {
		try {
			await run();
		} catch (e) {
			console.error(e);
		}
	},
	null,
	false,
	'America/New_York'
);

try {
	console.log('Starting up...');
	runCronJob.start();
	run(); // Run once on startup
} catch (e) {
	console.error(e);
}
