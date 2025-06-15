import express from 'express';
import {authenticate} from "../middleware/auth.middleware.js";
import { RekapKehadiranController } from "../controllers/rekap_kehadiran.controller.js";

const router = express.Router();

router.get('/', authenticate, RekapKehadiranController.getAll);
router.put('/', authenticate, RekapKehadiranController.updateSingleKehadiran);

export default router;