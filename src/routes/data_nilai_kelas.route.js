import express from 'express';
import {authenticate} from "../middleware/auth.middleware.js";
import {DataNilaiKelasController} from "../controllers/data_nilai_kelas.controller.js";
import {upload} from "../middleware/upload.middleware.js";
const router = express.Router();

router.get('/generate-excel/:id_rombel/:id_mapel', authenticate, DataNilaiKelasController.generateNilaiExcel);
router.post('/upload-batch-nilai/:id_rombel/:id_mapel', authenticate, upload.single('file'), DataNilaiKelasController.batchNilaiExcelKelas);

router.get('/:id_mapel', authenticate, DataNilaiKelasController.getALLDataNilaiKelas);
router.put('/', authenticate, DataNilaiKelasController.createDataNilaiKelas);

export default router;