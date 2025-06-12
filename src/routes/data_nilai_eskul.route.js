import express from 'express';
import {authenticate} from "../middleware/auth.middleware.js";
import {DataNilaiEskulController} from "../controllers/data_nilai_eskul.controller.js";
const router = express.Router();

router.get('/', authenticate, DataNilaiEskulController.getDataNilaiEskul);
router.put('/', authenticate, DataNilaiEskulController.updateDataNilaiEskul);

export default router;