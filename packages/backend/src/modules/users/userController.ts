import { Hono } from 'hono';
import { login, register, changePassword, getUserById, getUsers } from './userServices';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@/lib/zValidator';
import { z } from 'zod';
import { sign } from "hono/jwt"
import { setCookie } from "hono/cookie"
import { jwt, jwtGuard, JwtPayload } from '@/lib/jwt';

const tokenDuration = () => Math.floor(Date.now() / 1000) + 60 * 60 * 24 // 24 hours
const userSchema = z.object({ username: z.string(), password: z.string() })

export const userRouter = new Hono()
	.post('/register',
		zValidator("json", userSchema.extend({ name: z.string() })),
		async (c) => {
			const data = await c.req.valid("json")
			const user = await register(data);
			const token = await sign({
				sub: user.id,
				role: user.role,
				exp: tokenDuration(),
			}, Bun.env.JWT_SECRET!);
			setCookie(c, "token", token, { httpOnly: true, secure: Bun.env.NODE_ENV === "production", sameSite: "strict", expires: new Date(tokenDuration() * 1000), maxAge: 60 * 60 * 24 });
			return c.json(user);

		})
	.post('/login',
		zValidator("json", userSchema),
		async (c) => {
			const data = c.req.valid("json")
			const user = await login(data);
			const token = await sign({
				sub: user.id,
				role: user.role,
				exp: tokenDuration()
			}, Bun.env.JWT_SECRET!);
			setCookie(c, "token", token, { httpOnly: true, secure: Bun.env.NODE_ENV === "production", sameSite: "strict", expires: new Date(tokenDuration() * 1000), maxAge: 60 * 60 * 24 });
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
		})
	.get('/me',
		jwt(),
		async (c) => {
			const { sub: userId }: JwtPayload = c.get("jwtPayload")
			const user = await getUserById(userId);
			return c.json(user);
		})
	.get("/",
		jwt(),
		jwtGuard("ADMIN"),
		async (c) => {
			const users = await getUsers();
			return c.json(users);
		})
