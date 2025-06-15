import { body, param } from "express-validator";
import { createValidation } from "../middleware/validate.middleware.js";
import { data_pendapatan_lain_metode_pembayaran } from "@prisma/client";

export const createPendapatanLain = createValidation([
    body("id_jenis")
        .exists()
        .withMessage("ID Jenis harus diisi")
        .bail()
        .isInt({ min: 0 })
        .withMessage("ID Jenis harus berupa bilangan bulat positif")
        .toInt(), // Sanitize: Convert to integer
    body("id_status")
        .exists()
        .withMessage("ID Status harus diisi")
        .bail()
        .isInt({ min: 0 })
        .withMessage("ID Status harus berupa bilangan bulat positif")
        .toInt(), // Sanitize: Convert to integer
    body("tanggal")
        .exists()
        .withMessage("Tanggal harus diisi")
        .bail()
        .isDate()
        .withMessage("Tanggal harus berupa tanggal")
        .toDate(), // Sanitize: Convert to Date
    body("nominal")
        .exists()
        .withMessage("Nominal harus diisi")
        .bail()
        .isInt({ min: 1 })
        .withMessage("Nominal harus berupa bilangan bulat positif")
        .toInt(), // Sanitize: Convert to integer
    body("keterangan")
        .exists()
        .withMessage("Keterangan harus diisi")
        .bail()
        .isString()
        .withMessage("Keterangan harus berupa string")
        .trim()
        .escape(), // Sanitize: Trim and escape input
    body("metode_pembayaran")
        .exists()
        .withMessage("Metode Pembayaran harus diisi")
        .bail()
        .isIn(Object.values(data_pendapatan_lain_metode_pembayaran))
        .withMessage("Metode Pembayaran harus berupa enum")
        .trim()
        .escape(), // Sanitize: Trim and escape input
    body("nomor_referensi")
        .exists()
        .withMessage("Nomor Referensi harus diisi")
        .bail()
        .isString()
        .withMessage("Nomor Referensi harus berupa string")
        .trim()
        .escape(), // Sanitize: Trim and escape input
    // body("nama_pengirim"),
]);
