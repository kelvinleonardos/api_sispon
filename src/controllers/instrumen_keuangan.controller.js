import { AppError } from "../middleware/errorHandler.js";
import { prisma } from "../prisma.js";

const TYPES = {
    PEMASUKAN: 31,
    PENGELUARAN: 32,
};

export class InstrumenKeuanganController {
    static async getInstrumenKeuangan(req, res, next) {
        try {
            // Simulate fetching data from a database or service
            const instrumenKeuangan =
                await prisma.ref_instrumen_keuangan.findMany({
                    include: {
                        ref_tipe: true,
                        coa: true,
                    },
                    orderBy: {
                        nama: "asc",
                    },
                });
            const mappedData = instrumenKeuangan.map((item) => ({
                id: item.id,
                nama: item.nama,
                tipe: item.ref_tipe ? item.ref_tipe.nama : null,
                coa: item.coa ? item.coa.kode : null,
            }));
            res.status(200).json(mappedData);
        } catch (error) {
            next(new AppError("Failed to fetch instrumen keuangan", 500));
        }
    }

    static async getInstrumenKeuanganById(req, res, next) {
        try {
            const { id } = req.params;
            const instrumenKeuangan =
                await prisma.ref_instrumen_keuangan.findUnique({
                    where: { id: parseInt(id) },
                    include: {
                        ref_tipe: true,
                        coa: true,
                    },
                });
            if (!instrumenKeuangan) {
                return next(new AppError("Instrumen keuangan not found", 404));
            }

            const mappedData = {
                id: instrumenKeuangan.id,
                nama: instrumenKeuangan.nama,
                tipe: instrumenKeuangan.ref_tipe
                    ? instrumenKeuangan.ref_tipe.nama
                    : null,
                coa: instrumenKeuangan.coa ? instrumenKeuangan.coa.kode : null,
            };
            res.status(200).json(mappedData);
        } catch (error) {
            next(new AppError("Failed to fetch instrumen keuangan by ID", 500));
        }
    }

    static async createInstrumenKeuangan(req, res, next) {
        try {
            const { nama, type, coa } = req.body;

            // Validate input
            if (!nama || !type) {
                return next(new AppError("Nama and type are required", 400));
            }

            const normalizedType = type.toUpperCase();

            if (!Object.keys(TYPES).includes(normalizedType)) {
                return next(
                    new AppError(
                        `Tipe must be one of: ${Object.keys(TYPES).join(
                            ", "
                        )}`,
                        400
                    )
                );
            }

            // Check if COA exists
            const coaRecord = await prisma.coa.findUnique({
                where: { kode: coa },
            });
            if (!coaRecord) {
                return next(new AppError("COA not found", 404));
            }

            // Create new instrumen keuangan
            const newInstrumenKeuangan =
                await prisma.ref_instrumen_keuangan.create({
                    data: {
                        nama,
                        tipe: TYPES[normalizedType] || normalizedType,
                        coa_id: coaRecord ? coaRecord.id : null,
                    },
                });

            res.status(201).json({
                message: "Instrumen keuangan created successfully",
                data: newInstrumenKeuangan,
            });
        } catch (error) {
            next(new AppError("Failed to create instrumen keuangan", 500));
        }
    }

    static async updateInstrumenKeuangan(req, res, next) {
        try {
            const { id } = req.params;
            const { nama, type, coa } = req.body;

            // Validate input
            if (!nama || !type) {
                return next(new AppError("Nama and Type are required", 400));
            }

            // example of valid type
            // const validType = ["PEMASUKAN", "PENGELUARAN"];
            const normalizedType = type.toUpperCase();

            if (!Object.keys(TYPES).includes(normalizedType)) {
                return next(
                    new AppError(
                        `Type must be one of: ${Object.keys(TYPES).join(
                            ", "
                        )}`,
                        400
                    )
                );
            }

            // Check if COA exists
            const coaRecord = await prisma.coa.findUnique({
                where: { kode: coa },
            });
            if (!coaRecord) {
                return next(new AppError("COA not found", 404));
            }

            // Update instrumen keuangan
            const updatedInstrumenKeuangan =
                await prisma.ref_instrumen_keuangan.update({
                    where: { id: parseInt(id) },
                    data: {
                        nama,
                        tipe: TYPES[normalizedType] || normalizedType,
                        coa_id: coaRecord ? coaRecord.id : null,
                    },
                });

            res.status(200).json({
                message: "Instrumen keuangan updated successfully",
                data: updatedInstrumenKeuangan,
            });
        } catch (error) {
            next(new AppError("Failed to update instrumen keuangan", 500));
        }
    }

    static async deleteInstrumenKeuangan(req, res, next) {
        try {
            const { id } = req.params;

            // Check if instrumen keuangan exists
            const instrumenKeuangan =
                await prisma.ref_instrumen_keuangan.findUnique({
                    where: { id: parseInt(id) },
                });
            if (!instrumenKeuangan) {
                return next(new AppError("Instrumen keuangan not found", 404));
            }

            // Delete instrumen keuangan
            await prisma.ref_instrumen_keuangan.delete({
                where: { id: parseInt(id) },
            });

            res.status(200).json({
                message: "Instrumen keuangan deleted successfully",
            });
        } catch (error) {
            next(new AppError("Failed to delete instrumen keuangan", 500));
        }
    }
}