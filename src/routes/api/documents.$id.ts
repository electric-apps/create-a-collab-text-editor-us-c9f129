import { createFileRoute } from "@tanstack/react-router"
import { db } from "@/db"
import { documents } from "@/db/schema"
import { parseDates, generateTxId } from "@/db/utils"
import { eq } from "drizzle-orm"
import { z } from "zod/v4"

const patchSchema = z.object({
	title: z.string().min(1).optional(),
})

export const Route = createFileRoute("/api/documents/$id")({
	// @ts-expect-error — server.handlers types lag behind runtime support
	server: {
		handlers: {
			PATCH: async ({ request, params }: { request: Request; params: { id: string } }) => {
				const body = parseDates(await request.json())
				const { created_at, updated_at, id: _id, ...fields } = body
				const parsed = patchSchema.safeParse(fields)
				if (!parsed.success) {
					return new Response(JSON.stringify({ error: parsed.error.issues }), {
						status: 400,
						headers: { "Content-Type": "application/json" },
					})
				}
				const result = await db.transaction(async (tx) => {
					await tx
						.update(documents)
						.set({ ...parsed.data, updated_at: new Date() })
						.where(eq(documents.id, params.id))
					const txid = await generateTxId(tx)
					return { txid }
				})
				return new Response(JSON.stringify(result), {
					headers: { "Content-Type": "application/json" },
				})
			},
			DELETE: async ({ params }: { params: { id: string } }) => {
				const result = await db.transaction(async (tx) => {
					await tx.delete(documents).where(eq(documents.id, params.id))
					const txid = await generateTxId(tx)
					return { txid }
				})
				return new Response(JSON.stringify(result), {
					headers: { "Content-Type": "application/json" },
				})
			},
		},
	},
})
