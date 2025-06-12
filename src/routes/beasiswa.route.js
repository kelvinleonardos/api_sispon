import express from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { BeasiswaController } from "../controllers/beasiswa.controller.js";

const router = express.Router();

router.use(authenticate)


router.get("/", BeasiswaController.getJenisBeasiswa);
// router.get("/:id", BeasiswaController.gete);
router.post("/", BeasiswaController.createJenisBeasiswa);
router.put("/:id", BeasiswaController.updateJenisBeasiswa);
router.delete("/:id", BeasiswaController.deleteJenisBeasiswa);

export default router;