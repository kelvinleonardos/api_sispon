import express from 'express';
import {authenticate} from "../middleware/auth.middleware.js";
import {DataNilaiKelasController} from "../controllers/data_nilai_kelas.controller.js";
const router = express.Router();

router.put('/', authenticate, DataNilaiKelasController.createDataNilaiKelas);

export default router;