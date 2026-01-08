import { Router } from "express";
import { optionController } from "@/controller/option.controller";

const router = Router();

router.post("/", optionController);

export default router;
