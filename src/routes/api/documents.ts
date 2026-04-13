import { createFileRoute } from "@tanstack/react-router"
import { proxyElectricRequest } from "@/lib/electric-proxy"
import { db } from "@/db"
import { documents } from "@/db/schema"
import { parseDates, generateTxId } from "@/db/utils"
import { documentInsertSchema } from "@/db/zod-schemas"

export const Route = createFileRoute("/api/documents")({
	// @ts-expect-error — server.handlers types lag behind runtime support
	server: {
		handlers: {
			GET: ({ request }: { request: Request }) => proxyElectricRequest(request, "documents"),
			POST: async ({ request }: { request: Request }) => {
				const body = parseDates(await request.json())
				const parsed = documentInsertSchema.safeParse(body)
				if (!parsed.success) {
					return new Response(JSON.stringify({ error: parsed.error.issues }), {
						status: 400,
						headers: { "Content-Type": "application/json" },
					})
				}
				const { created_at, updated_at, ...data } = parsed.data
				const result = await db.transaction(async (tx) => {
					const [row] = await tx.insert(documents).values(data).returning({ id: documents.id })
					const txid = await generateTxId(tx)
					return { id: row.id, txid }
				})
				return new Response(JSON.stringify(result), {
					headers: { "Content-Type": "application/json" },
				})
			},
		},
	},
})
