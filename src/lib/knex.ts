import knex, { Knex } from 'knex';

const knexConfig: Knex.Config = {
	client: 'sqlite3', // Or another database client like 'pg', 'mysql', etc.
	connection: {
		filename: './config/db.sqlite3', // Adjust the filename or connection details as needed
	},
	useNullAsDefault: true, // This is specific to SQLite; adjust for other databases
};

export const db = knex(knexConfig);

export enum DB_TABLES {
	ALBUMS = 'albums',
	TOKEN = 'refreshToken',
}

export async function createTables() {
	const exists = await db.schema.hasTable(DB_TABLES.ALBUMS);

	if (!exists) {
		await db.schema.createTable('albums', (table) => {
			// Unique identifier for each album
			table.string('id').primary(); // 'id' will be the primary key
			table.string('name').notNullable(); // Album name
			table.enum('album_type', ['album', 'single', 'compilation']).notNullable(); // Album type
			table.integer('total_tracks').notNullable(); // Total number of tracks
			table.json('external_urls').notNullable(); // JSON for external URLs (including Spotify)
			table.string('href').notNullable(); // Href link for album details
			table.text('images').notNullable(); // JSON array for images
			table.string('release_date').notNullable(); // Release date in YYYY-MM-DD format
			table.string('type').notNullable().defaultTo('album'); // Type of album (should be 'album')
			table.string('uri').notNullable(); // URI of the album
			table.text('artists').notNullable(); // JSON array of artist objects
			table.string('album_group').notNullable(); // Group type for album (e.g., album, single)

			table.timestamps(true, true); // Timestamps for created_at and updated_at
		});
	}

	const tokenTableExists = await db.schema.hasTable(DB_TABLES.TOKEN);

	if (!tokenTableExists) {
		await db.schema.createTable(DB_TABLES.TOKEN, (table) => {
			table.integer('id').primary();
			table.string('refreshUserToken');
		});
	}
}
