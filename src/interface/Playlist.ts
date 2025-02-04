import { ExternalURLs } from './ExternalURLs';
import { Image } from './Image';
import { TrackList } from './Track';

export interface Playlist {
	collaborative: boolean;
	description: string;
	external_urls: ExternalURLs;
	followers: { href: string; total: number };
	href: string;
	id: string;
	images: Image[];
	name: string;
	owner: {
		display_name: string;
		external_urls: ExternalURLs;
		href: string;
		id: string;
		type: 'user';
		uri: string;
	};
	public: true;
	snapshot_id: string;
	tracks: PlaylistTracks;
	type: 'playlist';
	uri: string;
}

export interface PlaylistTracks {
	href: string;
	items: TrackList[];
	limit: number;
	next: string;
	offset: number;
	previous: string;
	total: number;
}
