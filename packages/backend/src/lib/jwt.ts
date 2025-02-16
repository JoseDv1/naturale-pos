import { Role } from "@prisma/client";
import { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { jwt as jsonwt } from "hono/jwt";

export interface JwtPayload {
	sub: string
	role: string
	exp: number
	iat: number
}
export const jwt = () =>
	jsonwt({
		secret: Bun.env.JWT_SECRET!,
		cookie: "token",
	})
export const jwtGuard = (role: Role) => {
	return async (c: Context, next: Next) => {
		const payload: JwtPayload = c.get("jwtPayload")
		if (payload.role !== role) {
			throw new HTTPException(403, { message: "Forbidden" })
		}
		await next()
	}
}