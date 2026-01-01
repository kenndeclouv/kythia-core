import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

import path from 'node:path';

export default defineConfig({
	plugins: [tsconfigPaths()],
	resolve: {
		alias: {
			'@src': path.resolve(__dirname, './src'),
			'@utils': path.resolve(__dirname, './src/utils'),
			'@managers': path.resolve(__dirname, './src/managers'),
			'@database': path.resolve(__dirname, './src/database'),
			'@middlewares': path.resolve(__dirname, './src/middlewares'),
			'@structures': path.resolve(__dirname, './src/structures'),
		},
	},
	test: {
		globals: true,
		environment: 'node',
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
		},
		include: ['tests/**/*.test.ts'],
	},
});
