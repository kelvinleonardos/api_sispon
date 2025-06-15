import { body, param } from "express-validator";
import { createValidation } from "../middleware/validate.middleware.js";

export const createBeasiswaSantriValidation = createValidation([
	body("id_jenis_beasiswa")
		.notEmpty()
		.withMessage("id_beasiswa harus diisi")
		.bail()
		.isInt({ min: 1 })
		.withMessage("id_beasiswa harus berupa bilangan bulat positif"),

	body("id_santri")
		.notEmpty()
		.withMessage("id_santri harus diisi")
		.bail()
		.isInt({ min: 1 })
		.withMessage("id_santri harus berupa bilangan bulat positif"),
    
    body("status")
		.notEmpty()
		.withMessage("status harus diisi")
		.bail()
		.isBoolean()
		.withMessage("status harus berupa boolean"),
    
    body("tanggal_mulai")
		.notEmpty()
		.withMessage("tanggal_mulai harus diisi")
		.bail()
		.isDate()
		.withMessage("tanggal_mulai harus berupa tanggal"),

    body("tanggal_selesai")
		.notEmpty()
		.withMessage("tanggal_selesai harus diisi")
		.bail()
		.isDate()
		.withMessage("tanggal_selesai harus berupa tanggal"),

    body("keterangan")
		.notEmpty()
		.withMessage("keterangan harus diisi")
		.bail()
		.isString()
		.withMessage("keterangan harus berupa string"),
    
    body("lewati_verifikasi")
		.notEmpty()
		.withMessage("lewati_verifikasi harus diisi")
		.bail()
		.isBoolean()
		.withMessage("lewati_verifikasi harus berupa boolean"),
])