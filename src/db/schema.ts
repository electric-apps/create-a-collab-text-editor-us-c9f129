import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core"

export const documents = pgTable("documents", {
	id: uuid("id").primaryKey().defaultRandom(),
	title: text("title").notNull().default("Untitled"),
	created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})
