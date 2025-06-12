import express from 'express';
import {CatatanWkWfController} from "../controllers/catatan_wk_wf.controller.js";
import {authenticate} from "../middleware/auth.middleware.js";
const router = express.Router();

router.get('/wk', authenticate, CatatanWkWfController.getCatatanWk);
router.get('/wf', authenticate, CatatanWkWfController.getCatatanWf);
router.put('/wk/:id_santri', authenticate, CatatanWkWfController.updateCatatanWk);
router.put('/wf/:id_santri', authenticate, CatatanWkWfController.updateCatatanWf);

export default router;