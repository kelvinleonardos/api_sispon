import express from 'express';
import { authenticate } from "../middleware/auth.middleware.js";
import { OrganisasiController } from "../controllers/organisasi.controller.js";

const router = express.Router();

router.get('/', authenticate, OrganisasiController.getAll);
router.get('/:id', authenticate, OrganisasiController.getById);
router.post('/', authenticate, OrganisasiController.create);
router.put('/:id', authenticate, OrganisasiController.update);
router.delete('/:id', authenticate, OrganisasiController.delete);

export default router;