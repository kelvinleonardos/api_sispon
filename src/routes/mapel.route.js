import express from 'express';
import {authenticate} from "../middleware/auth.middleware.js";
import {MapelController} from "../controllers/mapel.controller.js";
const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

router.get('/tipe', MapelController.getMapelTipe);
router.get('/all-detail', authenticate, MapelController.getAllDetailMapel);
router.get('/mapel-detail/:id_mapel', authenticate, MapelController.getDetailMapelById);
router.put('/update-detail/:id_mapel', authenticate, MapelController.updateDetailMapel);

router.get('/', authenticate, MapelController.getAllMapel);
router.post('/', authenticate, MapelController.createMapel);
router.delete('/:id', authenticate, MapelController.deleteMapel);

export default router;