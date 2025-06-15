import express from 'express';
const router = express.Router();
import { RombelAnggotaController } from "../controllers/rombel_anggota.controller.js";
import { authenticate } from '../middleware/auth.middleware.js';

// Apply authentication middleware to all routes
router.use(authenticate);

router.get('/sync', RombelAnggotaController.syncRombel);
router.put('/move', RombelAnggotaController.moveAnggota);
router.put('/graduate', RombelAnggotaController.graduateSantri);

router.get('/history/:id_santri', RombelAnggotaController.getRiwayatSantri);
router.post('/', RombelAnggotaController.createRombelAnggota);

export default router;