import { AppError } from "../middleware/errorHandler.js";
import { prisma } from "../prisma.js";

export class CoaController {
    static getCoa = async (req, res, next) => {
        try {
            const coa = await prisma.coa.findMany({
                orderBy: [
                    { kode: "asc" },
                    { parent_id: "asc" }
                ]
            });

            return res.status(200).json({
                success: true,
                message: "coa berhasil diambil",
                data: coa
            });
        }catch (error) {
            next(new AppError(error.message, 500));
        }
    }

    static createCoa = async (req, res, next) => {
        try {
            const { kode, nama, tipe,kategori,parent_id } = req.body;
            const existingCoa = await prisma.coa.findFirst({
                where: {
                    kode
                }
            });

            if (existingCoa) {
                return next( new AppError("coa sudah ada", 400));
            }

            const newCoa = await prisma.coa.create({
                data: {
                    kode,
                    nama,
                    tipe,
                    kategori,
                    parent_id
                }
            });

            return res.status(201).json({
                success: true,
                message: "coa berhasil dibuat",
                data: newCoa
            });
        }catch (error) {
            next(new AppError(error.message, 500));
        }
    }

    static updateCoa = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { kode, nama, tipe,kategori,parent_id } = req.body;

            const existingCoa = await prisma.coa.findFirst({
                where: {
                    id: parseInt(id)
                }
            });

            if (!existingCoa) {
                return next( new AppError("coa tidak ditemukan", 404));
            }

            const updatedCoa = await prisma.coa.update({
                where: {
                    id: parseInt(id)
                },
                data: {
                    kode,
                    nama,
                    tipe,
                    kategori,
                    parent_id
                }
            });

            return res.status(200).json({
                success: true,
                message: "coa berhasil diupdate",
                data: updatedCoa
            });
        }catch (error) {
            next(new AppError(error.message, 500));
        }
    }

    static deleteCoa = async (req, res, next) => {
        try {
            const { id } = req.params;

            const existingCoa = await prisma.coa.findFirst({
                where: {
                    id: parseInt(id)
                }
            });

            if (!existingCoa) {
                return next( new AppError("coa tidak ditemukan", 404));
            }

            await prisma.coa.delete({
                where: {
                    id: parseInt(id)
                }
            });

            return res.status(200).json({
                success: true,
                message: "coa berhasil dihapus"
            });
        }catch (error) {
            next(new AppError(error.message, 500));
        }
    }









}