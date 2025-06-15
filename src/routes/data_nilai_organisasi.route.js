import express from 'express';
import {authenticate} from "../middleware/auth.middleware.js";
import {NilaiOrganisasiController} from "../controllers/data_nilai_organisasi.controller.js";
const router = express.Router();

router.get('/', authenticate, NilaiOrganisasiController.getAll);
router.get('/:id', authenticate, NilaiOrganisasiController.getById);
router.post('/', authenticate, NilaiOrganisasiController.create);
router.put('/', authenticate, NilaiOrganisasiController.update);
router.delete('/:id', authenticate, NilaiOrganisasiController.delete);

export default router;