import express from 'express';
import { SkemaTagihanController } from '../controllers/skema_tagihan.controller.js';

const router = express.Router()

router.get('/', SkemaTagihanController.getSkemaTagihan)
router.post('/', SkemaTagihanController.createSkemaTagihan)
router.put('/:id', SkemaTagihanController.updateSkemaTagihan)
router.delete('/:id', SkemaTagihanController.deleteSkemaTagihan)

router.post('/test', SkemaTagihanController.generateTagihanSantri)

export default router;