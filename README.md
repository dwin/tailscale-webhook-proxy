# tailscale-webhook-proxy

This is a simple webhook proxy for [Tailscale](https://tailscale.com/) that forwards notifications to [Pushover](https://pushover.net). It could be easily modified to support other notification services.

## Usage

This assumes you already have accounts with Tailscale and Pushover.

Click the button below to deploy to Cloudflare Workers. 

You will need to configure the following secrets in the newly created Github repository:
- `TAILSCALE_WEBHOOK_SECRET`: Your Tailscale webhook secret. You can find this in the [Tailscale admin console](https://login.tailscale.com/admin/settings). Note: You will need to set an temporary value like "test" first to obtain the Cloudflare Worker application URL. Once you have this URL you can set the real secret in the Github repository secrets.
- `PUSHOVER_USER_KEY`: Your Pushover user key. You can find this in the [Pushover dashboard](https://pushover.net/).
- `PUSHOVER_APP_TOKEN`: Your Pushover app token. You can find this in the [Pushover dashboard](https://pushover.net/).

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/dwin/tailscale-webhook-receiver)
