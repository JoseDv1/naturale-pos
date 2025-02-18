import { PrismaClientInitializationError, PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { HTTPResponseError } from "hono/types";

const prismaErrors = {
	"RecordNotFound": "P2025",
	"UniqueConstraintViolation": "P2002",
	"ForeignKeyConstraintViolation": "P2020",

}

export async function errorHandler(error: Error | HTTPResponseError, ctx: Context) {
	if (Bun.env.NODE_ENV !== "production") {
		console.log("<--------- Error Handler --------->")
		console.log(error)
		console.log("</--------- Error Handler --------->")
	}

	const defaultResponse = ctx.json({ message: "Internal Server Error" }, 500)

	if (error instanceof HTTPException) {
		return error.getResponse();
	}

	if (error instanceof PrismaClientKnownRequestError) {
		switch (error.code) {
			case prismaErrors.RecordNotFound:
				const modelName = error.meta?.modelName ?? "Record"
				const cause = error.meta?.cause ?? "not found"
				return ctx.text(
					`${modelName} not found ${cause}`, 404)
			case prismaErrors.UniqueConstraintViolation:
				const field = error.meta?.target ?? "field"
				const value = error.meta?.value ?? "value"
				return ctx.json({
					message: `A record with ${field} ${value} already exists`,
				}, 409)
			case prismaErrors.ForeignKeyConstraintViolation:
				const relation = error.meta?.relationName ?? "relation"
				return ctx.json({
					message: `Cannot delete record because of existing ${relation}`,
				}, 409)


			default:
				return defaultResponse
		}
	}
	if (error instanceof PrismaClientInitializationError) {
		return ctx.json({ message: "Database is not connected" }, 500)
	}
	return defaultResponse
}
