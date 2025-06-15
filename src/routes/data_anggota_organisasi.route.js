import express from 'express';
import {authenticate} from "../middleware/auth.middleware.js";
import {AnggotaOrganisasiController} from "../controllers/data_anggota_organisasi.controller.js";
const router = express.Router();

router.get('/', authenticate, AnggotaOrganisasiController.getAll);
router.get('/:id_santri', authenticate, AnggotaOrganisasiController.getById);
router.post('/', authenticate, AnggotaOrganisasiController.create);
router.put('/:id', authenticate, AnggotaOrganisasiController.update);
router.delete('/:id', authenticate, AnggotaOrganisasiController.delete);

export default router;