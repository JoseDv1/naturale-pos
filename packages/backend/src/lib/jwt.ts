import { jwt as jsonwt } from "hono/jwt";
export const jwt = () =>
	jsonwt({
		secret: process.env.JWT_SECRET!,
		cookie: "token",
	})

export interface JwtPayload {
	sub: string
	role: string
	exp: number
	iat: number
}