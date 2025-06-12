import express from 'express';
import {authenticate} from "../middleware/auth.middleware.js";
import {JenjangComtroller} from "../controllers/jenjang.comtroller.js";
const router = express.Router();

router.get('/', authenticate, JenjangComtroller.getAllJenjang);

export default router;