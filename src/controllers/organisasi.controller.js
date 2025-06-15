import { prisma } from "../prisma.js";

export class OrganisasiController {
    static async getAll(req, res, next) {
        try {
            const organisasi = await prisma.ref_organisasi.findMany();
            res.status(200).json(organisasi);
        } catch (error) {
            next(error);
        }
    }

    static async getById(req, res, next) {
        try {
            const { id } = req.params;
            const organisasi = await prisma.ref_organisasi.findUnique({
                where: { id: parseInt(id) },
                include: {
                    data_anggota_organisasi: {
                        select: {
                            id: true,
                            id_santri: true,
                            id_jabatan: true,
                            tanggal_masuk: true,
                            tanggal_keluar: true,
                        },
                    },
                },
            });
            if (!organisasi) {
                res.status(404);
                throw new Error('Organisasi tidak ditemukan');
            }
            res.status(200).json(organisasi);
        } catch (error) {
            next(error);
        }
    }

    static async create(req, res, next) {
        try {
            const { nama, is_aktif } = req.body;
            const organisasi = await prisma.ref_organisasi.create({
                data: {
                    nama,
                    is_aktif: is_aktif ?? true,
                },
            });
            res.status(201).json({
                message: "Organisasi berhasil dibuat",
                data: organisasi,
            });
        } catch (error) {
            next(error);
        }
    }

    static async update(req, res, next) {
        try {
            const { id } = req.params;
            const { nama, is_aktif } = req.body;
            const organisasi = await prisma.ref_organisasi.update({
                where: { id: parseInt(id) },
                data: {
                    nama: nama ?? undefined,
                    is_aktif: is_aktif ?? undefined,
                },
            });
            res.status(200).json({
                message: "Organisasi berhasil diperbarui",
                data: organisasi,
            });
        } catch (error) {
            next(error);
        }
    }

    static async delete(req, res, next) {
        try {
            const { id } = req.params;
            await prisma.ref_organisasi.delete({
                where: { id: parseInt(id) },
            });
            res.status(200).json({ message: 'Organisasi berhasil dihapus' });
        } catch (error) {
            next(error);
        }
    }
}