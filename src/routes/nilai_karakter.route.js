import express from 'express';

const router = express.Router();

import { NilaiKarakterController } from '../controllers/nilai_karakter.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { upload } from '../middleware/upload.middleware.js';


router.use(authenticate);
router.get('/', NilaiKarakterController.getAllNilaiKarakter);
router.get('/rangking', NilaiKarakterController.getRangkingNilaiKarakter);
router.get('/download-template', NilaiKarakterController.generateExcelTemplate);
router.get('/modal', NilaiKarakterController.getModalData);
router.post('/upload',upload.single('file'), NilaiKarakterController.uploadExcelFile);
router.post('/edit', NilaiKarakterController.editNilaiKarakter)

export default router;