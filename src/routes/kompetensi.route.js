import express from 'express';
import {authenticate} from "../middleware/auth.middleware.js";
import {KompetensiController} from "../controllers/kompetensi.controller.js";
const router = express.Router();

router.get('/kd/:id_tingkat/:id_mapel', authenticate, KompetensiController.getMapelKD);

router.post('/ki/', authenticate, KompetensiController.createMapelKI);
router.post('/kd/', authenticate, KompetensiController.createMapelKD);



router.put('/ki/:id', authenticate, KompetensiController.updateMapelKI);
router.put('/kd/:id', authenticate, KompetensiController.updateMapelKD);
router.delete('/ki/:id', authenticate, KompetensiController.deleteMapelKI);
router.delete('/kd/:id', authenticate, KompetensiController.deleteMapelKD);

export default router;