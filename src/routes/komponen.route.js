import express from 'express';
const router = express.Router();
import { KomponenController } from '../controllers/komponen.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

router.get('/status', authenticate, KomponenController.getKomponenStatus);

router.get('/', authenticate, KomponenController.getAllKomponen);
router.get('/:id', authenticate, KomponenController.getKomponenById);
router.post('/', authenticate, KomponenController.createKomponen);
router.put('/:id', authenticate, KomponenController.updateKomponen);
router.delete('/:id', authenticate, KomponenController.deleteKomponen);

export default router;