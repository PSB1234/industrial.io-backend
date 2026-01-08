import type { Request, Response } from "express";
import { OptionSchema } from "@/types/zod";

//TODO: Implement option storage and retrieval logic
export function optionController(req: Request, res: Response) {
	try {
		const unValidatedData = req.body;
		if (!unValidatedData) {
			res.status(400).json({ message: "Option is required" });
			return;
		}
		const { success, data, error } = OptionSchema.safeParse(unValidatedData);
		if (!success) {
			res.status(400).json({ message: "Invalid option", error: error.message });
			return;
		}

		res.status(200).json({ message: "Option received", data });
	} catch (error) {
		console.error("Error processing option:", error);
		res.status(500).json({ message: "Internal server error" });
	}
}
