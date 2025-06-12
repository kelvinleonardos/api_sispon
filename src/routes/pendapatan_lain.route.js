import express from 'express'
import { PendapatanLainController } from '../controllers/pendapatan_lain.controller.js'

const router = express.Router()

router.get('/', PendapatanLainController.getAllPendapatanLain)
router.post('/', PendapatanLainController.createPendapatanLain)

export default router