import { createCollection } from "@tanstack/db"
import { electricCollectionOptions } from "@tanstack/electric-db-collection"
import { absoluteApiUrl } from "@/lib/client-url"
import { documentSelectSchema } from "@/db/zod-schemas"

export const documentsCollection = createCollection(
	electricCollectionOptions({
		id: "documents",
		schema: documentSelectSchema,
		getKey: (row) => row.id,
		shapeOptions: {
			url: absoluteApiUrl("/api/documents"),
			parser: {
				timestamptz: (date: string) => new Date(date),
			},
		},
		onInsert: async ({ transaction }) => {
			const { modified: newDoc } = transaction.mutations[0]
			const res = await fetch("/api/documents", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(newDoc),
			})
			const { txid } = await res.json()
			return { txid }
		},
		onUpdate: async ({ transaction }) => {
			const { modified: updated } = transaction.mutations[0]
			const res = await fetch(`/api/documents/${updated.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: updated.title, updated_at: updated.updated_at }),
			})
			const { txid } = await res.json()
			return { txid }
		},
		onDelete: async ({ transaction }) => {
			const { original: deleted } = transaction.mutations[0]
			const res = await fetch(`/api/documents/${deleted.id}`, {
				method: "DELETE",
			})
			const { txid } = await res.json()
			return { txid }
		},
	}),
)
