import express from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { BeasiswaSantriController } from '../controllers/beasiswa_santri.controller.js';

const router = express.Router();

router.use(authenticate)

router.get('/', BeasiswaSantriController.getBeasiswaSantri);
router.post('/', BeasiswaSantriController.createBeasiswaSantri);
router.put('/:id/confirm', BeasiswaSantriController.applyBeasiswaPotonganbyId);
router.get('/list-potongan', BeasiswaSantriController.getPotonganBeasiswa);
router.put('/:id', BeasiswaSantriController.updateBeasiswaSantri);
router.delete('/:id', BeasiswaSantriController.deleteBeasiswaSantri);

export default router;