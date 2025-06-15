// import { body, param } from "express-validator";
// import { ref_jenis_tagihan_frekuensi } from "@prisma/client";
// import { createValidation } from "../middleware/validate.middleware.js";
//
// // Ambil enum value untuk frekuensi
// const frekuensiTypes = Object.values(ref_jenis_tagihan_frekuensi);
//
// export const createTagihanValidation = createValidation([
// 	body("nama")
// 		.notEmpty()
// 		.withMessage("nama harus diisi")
// 		.bail()
// 		.isString()
// 		.withMessage("nama harus berupa string"),
//
// 	body("deskripsi")
// 		.optional({ nullable: true })
// 		.isString()
// 		.withMessage("deskripsi harus berupa string"),
//
// 	body("frekuensi")
// 		.isIn(frekuensiTypes)
// 		.withMessage("frekuensi tidak valid")
// 		.bail()
// 		.isString()
// 		.withMessage("frekuensi harus berupa string"),
//
// 	body("wajib")
// 		.isBoolean()
// 		.withMessage("wajib harus berupa boolean")
// 		.bail()
// 		.notEmpty()
// 		.withMessage("wajib harus diisi"),
// ])
//
// export const updateTagihanValidation = createValidation([
//
// 	param("id")
// 		.isInt({ min: 1 })
// 		.withMessage("ID harus berupa bilangan bulat positif"),
// 	body("nama").optional().isString().withMessage("nama harus berupa string"),
//
// 	body("deskripsi")
// 		.optional({ nullable: true })
// 		.isString()
// 		.withMessage("deskripsi harus berupa string"),
//
// 	body("frekuensi")
// 		.optional()
// 		.isIn(frekuensiTypes)
// 		.withMessage("frekuensi tidak valid")
// 		.bail()
// 		.isString()
// 		.withMessage("frekuensi harus berupa string"),
//
// 	body("wajib")
// 		.optional()
// 		.isBoolean()
// 		.withMessage("wajib harus berupa boolean"),
// ])
