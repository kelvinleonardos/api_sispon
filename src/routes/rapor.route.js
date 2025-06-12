import express from 'express';
import {authenticate} from "../middleware/auth.middleware.js";
import {RaporController} from "../controllers/rapor.controller.js";
import {upload} from "../middleware/upload.middleware.js";

const router = express.Router();

router.get('/leger', authenticate, RaporController.getLeger);
router.get('/print-santri/:id_jenis_rapor/:id_santri', RaporController.print);
router.get('/jenis', authenticate, RaporController.getJenis);
router.get('/print/:id_jenis_rapor/:id_santri', authenticate, RaporController.print);

router.get('/tanggal', authenticate, RaporController.getRaporDetail);
router.put('/tanggal', authenticate, upload.single("foto_ttd"), RaporController.setRaporDetail);

export default router;
