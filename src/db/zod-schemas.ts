import { createSelectSchema, createInsertSchema } from "drizzle-zod"
import { z } from "zod/v4"
import { documents } from "./schema"

export const documentSelectSchema = createSelectSchema(documents, {
	created_at: z.coerce.date().default(() => new Date()),
	updated_at: z.coerce.date().default(() => new Date()),
})

export const documentInsertSchema = createInsertSchema(documents, {
	created_at: z.coerce.date().default(() => new Date()),
	updated_at: z.coerce.date().default(() => new Date()),
})

export type Document = typeof documentSelectSchema._type
export type NewDocument = typeof documentInsertSchema._type
