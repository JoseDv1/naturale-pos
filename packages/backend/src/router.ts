import { Hono } from "hono";
import { userRouter } from "@/modules/users/userController"

export const apiRoutes =
	new Hono()
		.route('/users', userRouter);
