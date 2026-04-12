import { describe, it, expect } from "vitest"
import { generateValidRow, generateRowWithout } from "./helpers/schema-test-utils"
import { documentSelectSchema } from "@/db/zod-schemas"

describe("document schema", () => {
	it("accepts a complete row", () => {
		expect(documentSelectSchema.safeParse(generateValidRow(documentSelectSchema)).success).toBe(true)
	})
	it("rejects without id", () => {
		expect(documentSelectSchema.safeParse(generateRowWithout(documentSelectSchema, "id")).success).toBe(false)
	})
	it("rejects without title", () => {
		expect(documentSelectSchema.safeParse(generateRowWithout(documentSelectSchema, "title")).success).toBe(false)
	})
})
