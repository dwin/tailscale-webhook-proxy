/**
 * Welcome to Cloudflare Workers!
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
import { TailscaleEvents, TailscaleEvent } from './types';

export interface Env {
	// Environment variables defined in the Cloudflare Workers UI or wrangler.toml are exposed to your Worker via the global `ENV` object.

	// PUSHOVER_API_URL is the base URL for the Pushover API, e.g. https://api.pushover.net
	PUSHOVER_API_URL: string;

	/**
	 * Secrets (below) are exposed to your Worker via the global `SECRETS` object. Learn more at https://developers.cloudflare.com/workers/cli-wrangler/commands#secret
	 **/

	// Create using wrangler, e.g. wrangler secret put PUSHOVER_API_TOKEN

	// PUSHOVER_API_TOKEN is the Pushover API token, which can be found at https://pushover.net/apps/build or your existing app at https://pushover.net/<your_app_name>.
	PUSHOVER_API_TOKEN: string;

	// PUSHOVER_USER_KEY is the Pushover user key, which can be found at https://pushover.net/
	PUSHOVER_USER_KEY: string;

	// TAILSCALE_WEBHOOK_SECRET is the secret used to sign the webhook request. This is configured in the Tailscale admin console at https://login.tailscale.com/admin/settings/webhooks.
	TAILSCALE_WEBHOOK_SECRET: string;
}

const pushoverMessageEndpoint = '/1/messages.json';

function parseRequest(request: Request): TailscaleEvents {
	let tailscaleEvents: TailscaleEvents;

	try {
		const requestBody = request.json() as Object;
		// Convert the request body to TailscaleEvents type
		tailscaleEvents = requestBody as TailscaleEvents;
	} catch (e) {
		throw new Error(`Failed to parse request body: ${e}`);
	}

	return tailscaleEvents;
}

function handleEvents(env: Env, events: TailscaleEvents): void {
	for (const event of events) {
		try {
			sendPushoverNotification(env, event);
		} catch (error) {
			throw new Error(`Failed to send Pushover notification: ${error}`);
		}
	}

	return;
}

async function sendPushoverNotification(env: Env, event: TailscaleEvent): Promise<void> {
	const body = {
		token: env.PUSHOVER_API_TOKEN,
		title: `${event.tailnet} - ${event.type}`,
		message: event.message,
		url: event.data?.url,
		user: env.PUSHOVER_USER_KEY,
	};

	try {
		const response = await fetch(env.PUSHOVER_API_URL + pushoverMessageEndpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			throw new Error(`Pushover API returned ${response.status} ${response.statusText} - ${await response.text()}`);
		}

		console.info('Pushover notification sent successfully.');
	} catch (error) {
		console.error(`Failed to send Pushover notification: ${error}.`);
	}

	return;
}

function hexStringToArrayBuffer(hexString: string): ArrayBuffer | undefined {
	hexString = hexString.replace(/^0x/, '');

	if (hexString.length % 2 !== 0) {
		return undefined;
	}

	if (hexString.match(/[G-Z\s]/i)) {
		return undefined;
	}

	return new Uint8Array(hexString.match(/[\dA-F]{2}/gi)?.map((s) => parseInt(s, 16)) ?? []).buffer;
}

async function verifyTailscaleWebhookSignature(secret: string, signatureHeader: string, requestBody: string): Promise<boolean> {
	const parts = signatureHeader.split(',');
	let timestamp: string = '';
	let signature: string = '';

	parts.forEach((part) => {
		if (part.startsWith('t=')) {
			timestamp = part.substring(2);
		} else if (part.startsWith('v1=')) {
			signature = part.substring(3);
		}
	});

	const currentTimestamp = Math.floor(Date.now() / 1000);
	const eventTimestamp = parseInt(timestamp, 10);

	const encoder = new TextEncoder();

	// Verify timestamp within a certain time window (e.g., 5 minutes)
	if (currentTimestamp - eventTimestamp > 300) {
		console.warn(`Event timestamp ${eventTimestamp} is too old. Current timestamp is ${currentTimestamp}.`);
		return false; // Consider the event as a replay attack
	}

	const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);

	const authenticationInput = `${timestamp}.${decodeURIComponent(requestBody)}`;

	const signatureArrayBuffer = hexStringToArrayBuffer(signature);

	if (!signatureArrayBuffer) {
		console.warn('Failed to convert signature to ArrayBuffer.');
		return false;
	}

	const verified = await crypto.subtle.verify('HMAC', key, signatureArrayBuffer, encoder.encode(authenticationInput));

	if (!verified) {
		return false;
	}

	return true;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// Verify the request method and content type
		if (request.method !== 'POST') {
			return new Response('Method Not Allowed', { status: 405 });
		}

		if (request.headers.get('Content-Type') !== 'application/json') {
			return new Response('Bad Request', { status: 400 });
		}

		// Verify the request signature
		const signatureHeader = request.headers.get('tailscale-webhook-signature');
		if (!signatureHeader) {
			console.warn('Missing tailscale-webhook-signature header.');
			return new Response('Unauthorized', { status: 401 });
		}

		// Verify the request signature
		const requestBody = await request.clone().text();
		if (!(await verifyTailscaleWebhookSignature(env.TAILSCALE_WEBHOOK_SECRET, signatureHeader, requestBody))) {
			console.warn('Failed to verify request signature.');
			return new Response('Unauthorized', { status: 401 });
		}

		// Parse the request body
		const webhookBody = await parseRequest(request);

		try {
			await handleEvents(env, webhookBody);
		} catch (error) {
			console.error(`Failed to handle events: ${error}.`);
			return new Response('Internal Server Error', { status: 500 });
		}

		console.info(`${webhookBody.length} events handled successfully.`);
		return new Response('OK', { status: 200 });
	},
};
