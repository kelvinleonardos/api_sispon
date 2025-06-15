import { body, param } from "express-validator";
import { createValidation } from "../middleware/validate.middleware.js";
import { coa_kategori, coa_tipe } from "@prisma/client";
// import { object } from "joi";

const allowedTypes = Object.values(coa_tipe);
const allowedCategories = Object.values(coa_kategori);

export const createCoaValidation = createValidation([
    body("kode")
        .notEmpty()
        .withMessage("kode harus diisi")
        .bail()
        .isString()
        .withMessage("kode harus berupa string"),
    body("nama")
        .notEmpty()
        .withMessage("nama harus diisi")
        .bail()
        .isString()
        .withMessage("nama harus berupa string"),
    body("tipe")
        .isIn(allowedTypes)
        .withMessage("tipe harus tidak valid")
        .bail()
        .isString()
        .withMessage("tipe harus berupa string"),
    body("kategori")
        .optional()
        .isIn(allowedCategories)
        .withMessage("kategori tidak valid")
        .bail()
        .isString()
        .withMessage("kategori harus berupa string"),
    body("parent_id")
    .isInt()
    .withMessage("parent harus berupa integer")
    .optional({ nullable: true}),
])

export const updateCoaValidation = createValidation([
    param("id")
        .isInt({ min: 1 })
        .withMessage("ID harus berupa bilangan bulat positif"),
    body("kode")
        .optional()
        .isString()
        .withMessage("kode harus berupa string"),
    body("nama")
        .optional()
        .isString()
        .withMessage("nama harus berupa string"),
    body("tipe")
        .optional()
        .isIn(allowedTypes)
        .withMessage("tipe harus tidak valid")
        .bail()
        .isString()
        .withMessage("tipe harus berupa string"),
    body("kategori")
        .optional()
        .isIn(allowedCategories)
        .withMessage("kategori tidak valid")
        .bail()
        .isString()
        .withMessage("kategori harus berupa string"),
    body("parent_id")
        .isInt()
        .withMessage("parent harus berupa bilangan bulat positif")
        .optional({ nullable: true}),
])

// export const deleteCoaValidation = createValidation([
//     param("id")
//         .isInt({ min: 1 })
//         .withMessage("ID harus berupa bilangan bulat positif"),
// ])
