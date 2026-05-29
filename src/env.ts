import { bool, cleanEnv, str } from 'envalid';

export const env = cleanEnv(process.env, {
	USERNAME: str(),
	PASSWORD: str(),
	COOKIES_CACHE: bool({ default: false }),
});
