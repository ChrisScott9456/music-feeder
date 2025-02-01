import { Album } from './Album';
import { Artist } from './Artist';
import { ExternalURLs } from './ExternalURLs';

export interface Track {
	added_at: string;
	added_by: {
		external_urls: ExternalURLs;
		href: string;
		id: string;
		type: 'user';
		uri: string;
	};
	is_local: boolean;
	primary_color: null;
	track: {
		preview_url: null;
		available_markets: string[];
		explicit: boolean;
		type: 'track';
		episode: boolean;
		track: boolean;
		album: Album;
		artists: Artist[];
		disc_number: number;
		track_number: number;
		duration_ms: number;
		external_ids: { isrc: string };
		external_urls: ExternalURLs;
		href: string;
		id: string;
		name: string;
		popularity: number;
		uri: string;
		is_local: boolean;
	};
	video_thumbnail: { url: string };
}
