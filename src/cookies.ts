import { join } from 'node:path';

import { env } from './env';

async function checkCookies(cookies: string): Promise<boolean> {
	try {
		const res = await fetch('https://evades.io/api/auth/check', {
			method: 'POST',
			headers: {
				cookie: cookies,
			},
		});

		if (res.status !== 200) return false;

		void (await res.json());
		return true;
	} catch (e) {
		console.error('Error checking cookies:', e);
		return false;
	}
}

async function loginAndGetCookies(
	name: string,
	password: string,
): Promise<string> {
	console.log(`Logging in to evades.io as user: ${name}...`);

	const res = await fetch('https://evades.123000777.xyz/api/auth/login', {
		method: 'POST',
		body: JSON.stringify({
			username: name,
			password,
		}),
	});

	if (res.status !== 200) {
		const text = await res.text();
		throw new Error(`Login failed with status ${res.status}: ${text}`);
	}

	return res.headers.getSetCookie().join('; ');
}

export async function getOrRefreshCookies(
	name: string,
	password: string,
): Promise<string> {
	let data: Record<string, string> = {};

	const cookiesPath = join(import.meta.dirname, '../cookies.json');
	const file = Bun.file(cookiesPath);

	if (env.COOKIES_CACHE) {
		if (await file.exists()) {
			try {
				const text = await file.text();
				const parsed = JSON.parse(text);
				if (parsed) data = parsed;
			} catch (e) {
				console.error('Error parsing cookies.json:', e);
			}
		}

		const savedCookies = data[name];

		if (savedCookies) {
			const isValid = await checkCookies(savedCookies);

			if (isValid) {
				console.log(`Saved cookies for user "${name}" are valid.`);
				return savedCookies;
			}

			console.log(
				`Saved cookies for user "${name}" are expired or invalid. Re-authenticating...`,
			);
		}

		console.log(`No saved cookies found for user "${name}". Logging in...`);
	}

	const cookies = await loginAndGetCookies(name, password);

	data[name] = cookies;

	if (env.COOKIES_CACHE) {
		await Bun.write(cookiesPath, JSON.stringify(data));
		console.log(`Saved new cookies for user "${name}" to cookies.json`);
	}

	return cookies;
}
