import { prisma } from "../prisma.js";

/*
Master Kategori Ref Ekskul:
1. 35 LAK
 */

export class LakController {
    static createLak = async (req, res, next) => {
        try {
            const { nama, status } = req.body;

            // Validasi input
            if (!nama || status) {
                return res.status(400).json({ message: "Nama dan id_status wajib diisi" });
            }

            // Generate kode otomatis (LAK001, LAK002, dst)
            let kode = '';
            let counter = 1;
            while (true) {
                kode = `LAK${counter.toString().padStart(3, '0')}`; // Format LAK001, LAK002, dst
                const existingKode = await prisma.ref_mapel.findFirst({
                    where: { kode }
                });
                if (!existingKode) {
                    break; // Kode unik ditemukan
                }
                counter++; // Coba kode berikutnya
            }

            // Buat data mapel
            const mapelData = {
                kode,
                nama,
                id_master_kategori_ref_mapel: 35,
                is_aktif: status, // Pastikan id_status adalah integer
                jenis_nilai: "Angka"
            };

            // Simpan ke database
            const mapel = await prisma.ref_mapel.create({
                data: mapelData
            });

            res.status(201).json({
                message: "Mapel berhasil dibuat",
                data: mapel
            });
        } catch (error) {
            next(error);
        }
    };

    static getAllLak = async (req, res, next) => {
        try {
            const lakCategories = await prisma.ref_master_kategori.findMany({
                where: {
                    tipe: "lak",
                },
                select: {
                    id: true,
                },
            });

            const lak_master_ids = lakCategories.map((category) => category.id);

            let whereClause = {
                id_master_kategori_ref_mapel: {
                    in: lak_master_ids,
                },
            };

            const mapels = await prisma.ref_mapel.findMany({
                where: whereClause,
                orderBy: { id: "asc" },
                include: {
                    ref_master_kategori_ref_mapel: true
                }
            });

            const flattenedMapels = mapels.map((mapel) => {
                const { ref_master_kategori_ref_mapel, ...rest } = mapel;
                return {
                    ...rest,
                    tipe: ref_master_kategori_ref_mapel.nama,
                };
            });

            res.status(200).json(flattenedMapels);
        } catch (error) {
            console.error(error); // Log error untuk debugging
            next(error);
        }
    };

    static getLakById = async (req, res, next) => {
        try {
            const { id } = req.params;
            const mapel = await prisma.ref_mapel.findUnique({
                where: { id: parseInt(id) }
            });

            if (!mapel) {
                return res.status(404).json({ message: "Mapel tidak ditemukan" });
            }

            res.status(200).json(mapel);
        } catch (error) {
            next(error);
        }
    };

    static getLakTipe = async (req, res, next) => {
        try {
            const kategori = await prisma.ref_master_kategori.findMany({
                where: {
                    tipe: "ekskul"
                },
                orderBy: {
                    nama: "asc"
                }
            });
            res.status(200).json(kategori);
        } catch (error) {
            next(error);
        }
    }

    static updateLak = async (req, res, next) => {
        try {
            const { id_mapel } = req.params;
            const { nama, status } = req.body;

            // Cek apakah mapel ada
            const existingMapel = await prisma.ref_mapel.findUnique({
                where: { id: parseInt(id_mapel) },
            });

            if (!existingMapel) {
                return res.status(404).json({ message: "Mapel tidak ditemukan" });
            }


            // Siapkan data untuk update
            const updateData = {
                nama,
                is_aktif: status,
                id_master_kategori_ref_mapel: 35, // Pastikan tetap LAK
                jenis_nilai: "Angka"
            };

            // Update mapel
            const updatedMapel = await prisma.ref_mapel.update({
                where: { id: parseInt(id_mapel) },
                data: updateData,
            });

            res.status(200).json({
                message: "Mapel berhasil diperbarui",
                data: updatedMapel,
            });
        } catch (error) {
            if (error.name === "PrismaClientValidationError") {
                return res.status(400).json({ message: "Data input tidak valid", error: error.message });
            }
            next(error);
        }
    };

    static deleteLak = async (req, res, next) => {
        try {
            const { id } = req.params;

            // Cek apakah mapel ada
            const mapel = await prisma.ref_mapel.findUnique({
                where: { id: parseInt(id) }
            });
            if (!mapel) {
                return res.status(404).json({ message: "Mapel tidak ditemukan" });
            }

            await prisma.ref_mapel.delete({
                where: { id: parseInt(id) }
            });

            res.status(200).json({
                message: "Mapel berhasil dihapus"
            });
        } catch (error) {
            next(error);
        }
    };
}