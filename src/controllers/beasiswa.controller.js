import { AppError } from "../middleware/errorHandler.js";
import { prisma } from "../prisma.js";

export class BeasiswaController {
    static getJenisBeasiswa = async (req, res, next) => {
        try {
            const jenis_beasiswa = await prisma.ref_jenis_beasiswa.findMany();

            return res.status(200).json({
                success: true,
                message: "jenis beasiswa berhasil diambil",
                data: jenis_beasiswa
            });
        }catch (error) {
            next(new AppError(error.message, 500));
        }
    }

    static createJenisBeasiswa = async (req, res, next) => {
        try{
            const {nama, deskripsi, status, nominal, persentase} = req.body;

            if (!nama || typeof nama!=='string') {
                return next(new AppError("nama harus diisi", 400));
            }

            if (!status || typeof status!=='boolean') {
                return next(new AppError("status harus diisi", 400));
            }

            if ((!nominal && !persentase) || (nominal && persentase)) {
                return next(new AppError("harus mengisi salah satu antara nominal atau persentase", 400));
            }

            if (nominal && typeof nominal !== 'number') {
                return next(new AppError("nominal harus berupa angka", 400));
            }

            if (persentase && typeof persentase !== 'number') {
                return next(new AppError("persentase harus berupa angka", 400));
            }

            const jenis_beasiswa = await prisma.ref_jenis_beasiswa.create({
                data: {
                    nama,
                    deskripsi,
                    status,
                    nominal: parseFloat(nominal),
                    persentase: parseFloat(persentase)
                }
            })
            return res.status(200).json({
                success: true,
                message: "jenis beasiswa berhasil ditambahkan",
                data: jenis_beasiswa
            })
        }catch (error) {
            next(new AppError(error.message, 500));
        }
    }

    static updateJenisBeasiswa = async (req, res, next) => {
        try{
            const {nama, deskripsi, status, nominal, persentase} = req.body;
            const {id} = req.params;

            if (!id || typeof id!=='string') {
                return next(new AppError("id harus diisi", 400));
            }
            if (!nama || typeof nama!=='string') {
                return next(new AppError("nama harus diisi", 400));
            }

            if (!status || typeof status!=='boolean') {
                return next(new AppError("status harus diisi", 400));
            }

            if ((!nominal && !persentase) || (nominal && persentase)) {
                return next(new AppError("harus mengisi salah satu antara nominal atau persentase", 400));
            }

            if (nominal && typeof nominal !== 'number') {
                return next(new AppError("nominal harus berupa angka", 400));
            }

            if (persentase && typeof persentase !== 'number') {
                return next(new AppError("persentase harus berupa angka", 400));
            }

            const jenis_beasiswa = await prisma.ref_jenis_beasiswa.update({
                where: {
                    id: parseInt(id)
                },
                data: {
                    nama,
                    deskripsi,
                    status,
                    nominal: parseFloat(nominal),
                    persentase: parseFloat(persentase)
                }
            })
            return res.status(200).json({
                success: true,
                message: "jenis beasiswa berhasil diupdate",
                data: jenis_beasiswa
            })
        }catch (error) {
            next(new AppError(error.message, 500));
        }
    }

    static deleteJenisBeasiswa = async (req, res, next) => {
        try{
            const {id} = req.params;

            if (!id || typeof id!=='string') {
                return next(new AppError("id harus diisi", 400));
            }

            await prisma.ref_jenis_beasiswa.delete({
                where: {
                    id: parseInt(id)
                }
            })
            return res.status(200).json({
                success: true,
                message: "jenis beasiswa berhasil dihapus"
            })
        } catch (error) {
            next(new AppError(error.message, 500));
        }
    }
}