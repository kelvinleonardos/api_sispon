import express from 'express';
import {authenticate} from "../middleware/auth.middleware.js";
import {KkmDetailController} from "../controllers/kkm.controller.js";
const router = express.Router();

router.get('/', authenticate, KkmDetailController.getAllKkmDetail);
router.get('/:id', authenticate, KkmDetailController.getKkmDetailById);
router.post('/', authenticate, KkmDetailController.createKkmDetail);
router.put('/:id', authenticate, KkmDetailController.updateKkmDetail);
router.delete('/:id', authenticate, KkmDetailController.deleteKkmDetail);

export default router;