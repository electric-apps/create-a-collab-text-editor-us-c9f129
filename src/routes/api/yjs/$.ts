import { createFileRoute } from "@tanstack/react-router"

const HOP_BY_HOP = new Set([
	"connection",
	"keep-alive",
	"proxy-authenticate",
	"proxy-authorization",
	"te",
	"trailer",
	"transfer-encoding",
	"upgrade",
	"host",
	"content-encoding",
	"content-length",
])

async function proxyYjs({
	request,
	params,
}: {
	request: Request
	params: { _splat?: string }
}): Promise<Response> {
	const baseUrl = process.env.YJS_URL
	const secret = process.env.YJS_SECRET
	if (!baseUrl || !secret) {
		return new Response("Yjs service not configured (missing YJS_URL or YJS_SECRET)", {
			status: 500,
		})
	}

	const requestUrl = new URL(request.url)
	const splat = params._splat ?? ""
	const upstream = `${baseUrl}/${splat}${requestUrl.search}`

	const hasBody =
		request.method !== "GET" && request.method !== "HEAD" && request.method !== "OPTIONS"

	const forwardedRequestHeaders = new Headers()
	for (const [key, value] of request.headers) {
		const lower = key.toLowerCase()
		if (HOP_BY_HOP.has(lower)) continue
		if (lower === "cookie") continue
		if (lower === "authorization") continue
		if (lower === "host") continue
		forwardedRequestHeaders.set(key, value)
	}
	forwardedRequestHeaders.set("Authorization", `Bearer ${secret}`)

	const upstreamResponse = await fetch(upstream, {
		method: request.method,
		headers: forwardedRequestHeaders,
		body: hasBody ? request.body : undefined,
		duplex: "half",
	} as RequestInit)

	const forwardedResponseHeaders = new Headers()
	for (const [key, value] of upstreamResponse.headers) {
		if (HOP_BY_HOP.has(key.toLowerCase())) continue
		forwardedResponseHeaders.set(key, value)
	}

	return new Response(upstreamResponse.body, {
		status: upstreamResponse.status,
		statusText: upstreamResponse.statusText,
		headers: forwardedResponseHeaders,
	})
}

export const Route = createFileRoute("/api/yjs/$")({
	// @ts-expect-error — server.handlers types lag behind runtime support
	server: {
		handlers: {
			GET: proxyYjs,
			POST: proxyYjs,
			PUT: proxyYjs,
			PATCH: proxyYjs,
			DELETE: proxyYjs,
			OPTIONS: proxyYjs,
		},
	},
})
