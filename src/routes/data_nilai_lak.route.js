import express from 'express';
import {authenticate} from "../middleware/auth.middleware.js";
import {DataNilaiLakController} from "../controllers/data_nilai_lak.controller.js";

const router = express.Router();

router.get('/', authenticate, DataNilaiLakController.getDataNilaiLak);
router.get('/:id', authenticate, DataNilaiLakController.getDataNilaiLakByRombel);
router.put('/', authenticate, DataNilaiLakController.updateDataNilaiLak);

export default router;