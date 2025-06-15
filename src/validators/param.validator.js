import { body, param } from "express-validator";
import { createValidation } from "../middleware/validate.middleware.js";
export const paramValidation = createValidation(

    [
    param('id')
        .isInt({ min: 1 })
        .withMessage('ID must be a positive integer')
        .toInt(),
    
    param('slug')
        .optional()
        .isSlug()
        .withMessage('Slug must be valid (lowercase, no spaces)')
]
    
)