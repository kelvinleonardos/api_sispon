import express from 'express';
import {authenticate} from "../middleware/auth.middleware.js";
import {IzinSantriController} from "../controllers/izin_santri.controller.js";
const router = express.Router();

router.get('/type', authenticate, IzinSantriController.getTipeIzin);

router.get('/', authenticate, IzinSantriController.getIzinSantri);
router.get('/:id', authenticate, IzinSantriController.getIzinSantriById);
router.post('/', authenticate, IzinSantriController.createIzinSantri);
router.put('/:id', authenticate, IzinSantriController.updateIzinSantri);
router.delete('/:id', authenticate, IzinSantriController.deleteIzinSantri);

export default router;