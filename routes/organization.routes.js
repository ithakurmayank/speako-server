import { Router } from "express";
import { createOrgInvitation } from "../controllers/organization.controller.js";

const router = Router();

router.post("/", createOrgInvitation);

export default router;
