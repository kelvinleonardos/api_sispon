import { body, param } from "express-validator";
import { createValidation } from "../middleware/validate.middleware.js";

export const createKategoriKarakterValidation = createValidation([
	body("nama")
		.notEmpty()
		.withMessage("Nama wajib diisi")
		.isString()
		.withMessage("Nama harus berupa teks")
		.trim()
		.isLength({ min: 2, max: 100 })
		.withMessage("Nama harus memiliki panjang antara 2 hingga 100 karakter")
		.matches(/^[a-zA-Z0-9\s\-_]+$/)
		.withMessage(
			"Nama hanya boleh berisi huruf, angka, spasi, tanda hubung, dan garis bawah"
		),

	// body("deskripsi")
	// 	.notEmpty()
	// 	.withMessage("Deskripsi wajib diisi")
	// 	.isString()
	// 	.withMessage("Deskripsi harus berupa teks")
	// 	.trim()
	// 	.isLength({ min: 0, max: 500 })
	// 	.withMessage("Deskripsi maksimal 500 karakter"),
]);

export const updateKategoriKarakterValidation = createValidation([
	param("id")
		.isInt({ min: 1 })
		.withMessage("ID harus berupa bilangan bulat positif"),

	body("nama")
		.optional()
		.isString()
		.withMessage("Nama harus berupa teks")
		.trim()
		.isLength({ min: 2, max: 100 })
		.withMessage("Nama harus memiliki panjang antara 2 hingga 100 karakter")
		.matches(/^[a-zA-Z0-9\s\-_]+$/)
		.withMessage(
			"Nama hanya boleh berisi huruf, angka, spasi, tanda hubung, dan garis bawah"
		),

	body("deskripsi")
		.optional()
		.isString()
		.withMessage("Deskripsi harus berupa teks")
		.trim()
		.isLength({ min: 1, max: 500 })
		.withMessage("Deskripsi maksimal 500 karakter"),
]);

export const deleteKategoriKarakterValidation = createValidation([
	param("id")
		.isInt({ min: 1 })
		.withMessage("ID harus berupa bilangan bulat positif"),
]);

// Validator untuk Kriteria Karakter
export const createKriteriaKarakterValidation = createValidation([
	body("kategori")
		.notEmpty()
		.withMessage("Kategori wajib diisi")
		.isInt({ min: 1 })
		.withMessage("Kategori harus berupa bilangan bulat positif"),

	body("nama")
		.notEmpty()
		.withMessage("Nama wajib diisi")
		.isString()
		.withMessage("Nama harus berupa teks")
		.trim()
		.isLength({ min: 2, max: 100 })
		.withMessage("Nama harus memiliki panjang antara 2 hingga 100 karakter"),

	body("deskripsi")
		.notEmpty()
		.withMessage("Deskripsi wajib diisi")
		.isString()
		.withMessage("Deskripsi harus berupa teks")
		.trim()
		.isLength({ min: 1, max: 500 })
		.withMessage("Deskripsi harus memiliki panjang antara 1 hingga 500 karakter"),

	body("basis")
		.notEmpty()
		.withMessage("Basis wajib diisi")
		.isInt({ min: 1 })
		.withMessage("Basis harus berupa bilangan bulat positif"),
]);

export const updateKriteriaKarakterValidation = createValidation([
	param("id").isInt({ min: 1 }).withMessage("ID harus berupa bilangan bulat positif"),

	body("kategori")
		.optional()
		.isInt({ min: 1 })
		.withMessage("Kategori harus berupa bilangan bulat positif"),

	body("nama")
		.optional()
		.isString()
		.withMessage("Nama harus berupa teks")
		.trim()
		.isLength({ min: 2, max: 100 })
		.withMessage("Nama harus memiliki panjang antara 2 hingga 100 karakter"),

	body("deskripsi")
		.optional()
		.isString()
		.withMessage("Deskripsi harus berupa teks")
		.trim()
		.isLength({ min: 1, max: 500 })
		.withMessage("Deskripsi harus memiliki panjang antara 1 hingga 500 karakter"),

	body("basis")
		.optional()
		.isInt({ min: 1 })
		.withMessage("Basis harus berupa bilangan bulat positif"),
]);

export const deleteKriteriaKarakterValidation = createValidation([
	param("id").isInt({ min: 1 }).withMessage("ID harus berupa bilangan bulat positif"),
]);