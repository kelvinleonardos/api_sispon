import express from 'express';

const router = express.Router();

import {authenticate, checkPermission} from '../middleware/auth.middleware.js';
import {PrestasiPelanggaranController} from "../controllers/prestasi_pelanggaran.controller.js";
import {upload} from "../middleware/upload.middleware.js";

router.get('/print', PrestasiPelanggaranController.printPrestasiPelanggaran);
router.get('/print-by-class', PrestasiPelanggaranController.printPrestasiPelanggaran);
router.get('/print-by-santri', PrestasiPelanggaranController.printPrestasiPelanggaran);
router.get('/santri/:id_santri', PrestasiPelanggaranController.getPrestasiPelanggaranBySantri);

router.post('/', authenticate, checkPermission("CREATE-PRESTASI-PELANGGARAN"), upload.array("files", 5), PrestasiPelanggaranController.createPrestasiPelanggaran);
router.get('/', authenticate, checkPermission("VIEW-PRESTASI-PELANGGARAN"), PrestasiPelanggaranController.getAllPrestasiPelanggaran);
router.get('/:id', authenticate, checkPermission("VIEW-PRESTASI-PELANGGARAN"), PrestasiPelanggaranController.getPrestasiPelanggaranById);
router.put('/:id', authenticate, checkPermission("UPDATE-PRESTASI-PELANGGARAN"), upload.array("files", 5), PrestasiPelanggaranController.updatePrestasiPelanggaran);
router.delete('/:id', authenticate, checkPermission("DELETE-PRESTASI-PELANGGARAN"), PrestasiPelanggaranController.deletePrestasiPelanggaran);

export default router;