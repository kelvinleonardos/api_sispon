import express from 'express';
import {authenticate} from "../middleware/auth.middleware.js";
import {LakController} from "../controllers/lak.controller.js";
const router = express.Router();

router.post('/', authenticate, LakController.createLak);
router.get('/', authenticate, LakController.getAllLak);
router.put('/:id_mapel', authenticate, LakController.updateLak);

export default router;