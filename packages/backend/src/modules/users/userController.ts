import { Hono } from 'hono';
import { login, register, changePassword, getUserById } from './userServices';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@/lib/zValidator';
import { z } from 'zod';
import { sign } from "hono/jwt"
import { setCookie } from "hono/cookie"
import { jwt, JwtPayload } from '@/lib/jwt';

const tokenDuration = () => Math.floor(Date.now() / 1000) + 60 * 60 * 24 // 24 hours
export const userRouter = new Hono()
	.post('/register',
		zValidator("json", z.object({ username: z.string(), password: z.string() })),
		async (c) => {
			const { username, password } = await c.req.valid("json")
			const user = await register({ username, password });
			const token = await sign({
				sub: user.id,
				role: user.role,
				exp: tokenDuration(),
			}, Bun.env.JWT_SECRET!);
			setCookie(c, "token", token, { httpOnly: true, secure: Bun.env.NODE_ENV === "production", sameSite: "strict" });
			return c.json(user);

		})
	.post('/login',
		zValidator("json", z.object({ username: z.string(), password: z.string() })),
		async (c) => {
			const { username, password } = await c.req.valid("json")
			const user = await login({ username, password });
			const token = await sign({
				sub: user.id,
				role: user.role,
				exp: tokenDuration()
			}, Bun.env.JWT_SECRET!);
			setCookie(c, "token", token, { httpOnly: true, secure: Bun.env.NODE_ENV === "production", sameSite: "strict" });
			return c.json(user);

		})
	.post('/change-password',
		jwt(),
		zValidator("json", z.object({ username: z.string(), newPassword: z.string() })),
		async (c) => {
			const { sub: userId }: JwtPayload = c.get("jwtPayload")
			const user = await getUserById(userId);
			const hasPermission = user.id === userId; // Only the user can change their own password
			if (!hasPermission) throw new HTTPException(403, { message: "Forbidden" });
			const { username, newPassword } = c.req.valid("json")
			await changePassword({ username, newPassword });
			return c.json({ message: "Password changed" });
		});
