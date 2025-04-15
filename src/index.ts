/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 * KV Namespace: https://developers.cloudflare.com/workers/runtime-apis/kv/
 */

interface Env {
	open_heart_kv: KVNamespace;
}

function ensureEmoji(emoji: string) {
	const segments = Array.from(new Intl.Segmenter().segment(emoji.trim()));
	const parsedEmoji = segments.length > 0 ? segments[0].segment : null;

	if (/\p{Emoji}/u.test(parsedEmoji!)) {
		return parsedEmoji;
	}
	return null;
}

// derived from https://gist.github.com/muan/388430d0ed03c55662e72bb98ff28f03
export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		let id = url.searchParams.get('id');
		if (!id) {
			const path = url.pathname.slice(1);
			if (path) id = decodeURIComponent(path);
		}

		const ORIGIN = 'http://localhost:8787';

		const CORS_HEADERS = {
			'Access-Control-Allow-Headers': '*',
			'Access-Control-Allow-Origin': ORIGIN,
			'Access-Control-Allow-Methods': 'GET, POST',
		};

		// Get: return count
		if (request.method === 'GET') {
			if (!id) {
				return new Response('ID not found', {
					status: 200,
					headers: {
						...CORS_HEADERS,
					},
				});
			}
			// @note: emojiString.match(/[\p{Emoji}]/gu) may use this to match multiple emojis
			const emoji = await env['open_heart_kv'].get(id);
			let resp: Response;
			if (!emoji) {
				resp = Response.json({});
			} else {
				const count = Number((await env['open_heart_kv'].get(`${id}:${emoji}`)) || 0);
				resp = Response.json({
					[emoji]: count,
				});
			}

			resp.headers.set('Access-Control-Allow-Headers', '*');
			resp.headers.set('Access-Control-Allow-Origin', ORIGIN);
			resp.headers.set('Access-Control-Allow-Methods', 'GET, POST');
			return resp;
		}

		// only GET & POST is allowed
		if (request.method !== 'POST')
			return new Response('Wrong Method!', {
				headers: {
					...CORS_HEADERS,
				},
			});

		// POST: add count
		const emoji = ensureEmoji(await request.text());

		if (!id || !emoji)
			return new Response('Input not found', {
				headers: {
					...CORS_HEADERS,
				},
			});

		const key = `${id}:${emoji}`;
		const val = await env['open_heart_kv'].get(id);
		if (!val || val !== emoji) {
			await env['open_heart_kv'].put(id, emoji);
		}

		const currentCount = Number((await env['open_heart_kv'].get(key)) || 0);
		await env['open_heart_kv'].put(key, (currentCount + 1).toString());

		const resp = new Response('ok', { status: 200 });
		resp.headers.set('Access-Control-Allow-Headers', '*');
		resp.headers.set('Access-Control-Allow-Origin', ORIGIN);
		resp.headers.set('Access-Control-Allow-Methods', 'GET, POST');

		return resp;
	},
} satisfies ExportedHandler<Env>;
