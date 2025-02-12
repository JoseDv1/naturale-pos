import { db } from "@/lib/prisma";
import { HTTPException } from "hono/http-exception";

interface UserCredentials {
	username: string;
	password: string;
}

export async function register({ username, password }: UserCredentials) {
	const hashedPassword = await Bun.password.hash(password);
	const user = await db.user.create({
		data: {
			username,
			password: hashedPassword,
		},
	});
	return user;
}

export async function login({ username, password }: UserCredentials) {
	const user = await db.user.findUniqueOrThrow({
		where: { username },
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


