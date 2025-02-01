import { Artist } from './Artist';
import { ExternalURLs } from './ExternalURLs';
import { Image } from './Image';

export interface Album {
	album_type: 'album' | 'single' | 'compilation';
	total_tracks: number;
	available_markets: string[];
	external_urls: ExternalURLs;
	href: string;
	id: string;
	images: Image[];
	name: string;
	release_date: string;
	release_date_precision: 'year' | 'month' | 'day';
	restrictions: {
		reason: 'market' | 'product' | 'explicit';
	};
	type: 'album';
	uri: string;
	artists: Artist[];
	album_group: string;
}

export interface AlbumResponse {
	href: string;
	items: Album[];
	limit: number;
	next: string;
	offset: number;
	previous: string;
	total: number;
}
