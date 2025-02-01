import { ExternalURLs } from './ExternalURLs';

export interface Artist {
	external_urls: ExternalURLs;
	href: string;
	id: string;
	name: string;
	type: 'artist';
	uri: string;
}
