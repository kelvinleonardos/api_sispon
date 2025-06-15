// middleware/validate.js
import { validationResult } from "express-validator";
import { AppError } from "./errorHandler.js";

// Fungsi pembungkus untuk menggabungkan skema dengan validationResult
export const createValidation = (schema) => {
	return [
		...schema, // Sebarkan skema validasi
		(req, res, next) => {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return next(new AppError(errors.array()[0].msg, 400));
			}
			next();
		},
	];
};
