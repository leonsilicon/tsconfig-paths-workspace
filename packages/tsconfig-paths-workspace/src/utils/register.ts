/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import findUp from 'find-up';
import isPathInside from 'is-path-inside';
import fs from 'node:fs';
import { Module } from 'node:module';
import path from 'node:path';
import * as tsConfigPaths from 'tsconfig-paths';

export function register() {
	// eslint-disable-next-line prefer-destructuring
	const _resolveFilename = (Module as any)._resolveFilename;

	const tsconfigPathToMatchPath: Record<
		string,
		// eslint-disable-next-line @typescript-eslint/consistent-type-imports
		import('tsconfig-paths').MatchPath
	> = {};

	(Module as any)._resolveFilename = function (
		request: string,
		parent: { id: string; path: string; filename: string },
		isMain: boolean,
		options: unknown
	) {
		if (!request.startsWith('~')) {
			return _resolveFilename(request, parent, isMain, options);
		}

		let tsconfigPath;

		const filePathOfImporter = parent.path;
		// Check all the existing parent folders of each known `tsconfig.json` file and see
		// if the current file's directory falls under a known directory containing a
		// `tsconfig.json` file
		for (const knownTsconfigPath of Object.keys(tsconfigPathToMatchPath).sort(
			(a, b) => a.length - b.length
		)) {
			if (isPathInside(filePathOfImporter, path.dirname(knownTsconfigPath))) {
				tsconfigPath = knownTsconfigPath;
			}
		}

		if (tsconfigPath === undefined) {
			// Could not find an existing `tsconfig.json` which is associated with the current file
			// Thus, find it manually by finding the nearest `tsconfig.json` in an above directory
			const tsconfigJsonPath = findUp.sync('tsconfig.json', {
				cwd: path.dirname(filePathOfImporter),
			});
			if (tsconfigJsonPath !== undefined) {
				const config = tsConfigPaths.loadConfig(tsconfigJsonPath);
				if (config.resultType === 'failed') {
					throw new Error('Failed to load tsconfig');
				}

				const { absoluteBaseUrl, paths } = config;
				let matchPath: tsConfigPaths.MatchPath;
				if (paths === undefined) {
					matchPath = () => undefined;
				} else {
					matchPath = tsConfigPaths.createMatchPath(absoluteBaseUrl, paths);
				}

				tsconfigPathToMatchPath[tsconfigJsonPath] = matchPath;

				tsconfigPath = tsconfigJsonPath;
			}
		}

		let matchPath: tsConfigPaths.MatchPath;
		if (tsconfigPath === undefined) {
			const config = tsConfigPaths.loadConfig();
			if (config.resultType === 'failed') {
				throw new Error('Failed to load tsconfig');
			}

			const { paths, absoluteBaseUrl } = config;
			if (paths === undefined) {
				matchPath = () => undefined;
			} else {
				matchPath = tsConfigPaths.createMatchPath(absoluteBaseUrl, paths);
			}
		} else {
			matchPath = tsconfigPathToMatchPath[tsconfigPath]!;
		}

		const extensions = ['.js', '.ts', '.jsx', '.tsx', '.json'];

		for (const extension of extensions) {
			const fileMatchPath = matchPath(request);
			if (fileMatchPath !== undefined) {
				const filePath = `${fileMatchPath}${extension}`;
				if (fs.existsSync(filePath)) {
					return filePath;
				}
			}
		}

		return _resolveFilename(request, parent, isMain, options);
	};
}
