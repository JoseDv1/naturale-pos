import { db } from "@/lib/prisma";
import { HTTPException } from "hono/http-exception";

interface UserCredentials {
	username: string;
	name: string;
	password: string;
}

export async function register(data: UserCredentials) {
	const hashedPassword = await Bun.password.hash(data.password);
	const username = data.username.toLowerCase();
	return await db.user.create({
		data: {
			...data,
			username,
			password: hashedPassword,
		},
	});
}

export async function login({ username, password }: Omit<UserCredentials, "name">) {
	username = username.toLowerCase();
	const user = await db.user.findUniqueOrThrow({
		where: { username },
		omit: {
			password: false,
		}
	});
	const isPasswordValid = await Bun.password.verify(password, user.password);
	if (!isPasswordValid) throw new HTTPException(401, { message: "Invalid password" });
	return user;
}

export async function changePassword({ username, newPassword }: { username: string; newPassword: string; }) {
	const hashedPassword = await Bun.password.hash(newPassword);
	return await db.user.update({
		where: { username },
		data: { password: hashedPassword },
	});
}

export async function getUserById(id: string) {
	return await db.user.findUniqueOrThrow({
		where: { id },
	});
}

export async function getUsers() {
	return await db.user.findMany();
}

