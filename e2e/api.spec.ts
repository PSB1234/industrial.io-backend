import { expect, test } from "@playwright/test";

test("get rooms api", async ({ request }) => {
	const response = await request.get("/api/rooms");
	expect(response.ok()).toBeTruthy();
	const body = await response.json();
	expect(body).toHaveProperty("data");
});
