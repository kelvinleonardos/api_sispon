import { prisma } from '../prisma.js';
import { getTokenPayload } from "../helpers.js";
import {flatten} from "express/lib/utils.js";

export class KomponenController {
    static async getAllKomponen(req, res, next) {
        try {
            const komponen = await prisma.ref_komponen_nilai.findMany({
                orderBy: {
                    nama: 'asc',
                },
                include: {
                    ref_master_kategori: true // Menambahkan relasi untuk mendapatkan data status
                }
            });

            const flattenedKomponen = komponen.map((item) => {
                const { ref_master_kategori, ...rest } = item;
                return {
                    ...rest,
                    status: ref_master_kategori ? ref_master_kategori.nama : null,
                };
            });

            res.status(200).json(flattenedKomponen);
        } catch (error) {
            next(error);
        }
    }

    static async getKomponenStatus(req, res, next) {
        try {
            const komponen = await prisma.ref_master_kategori.findMany({
                where: {
                    tipe: 'status_komponen',
                },
                orderBy: {
                    nama: 'asc',
                },
            });

            res.status(200).json(komponen);
        } catch (error) {
            next(error);
        }
    }

    static async getKomponenById(req, res, next) {
        try {
            const { id } = req.params;

            const komponen = await prisma.ref_komponen_nilai.findFirst({
                where: {
                    id: parseInt(id),
                },
                include: {
                    ref_master_kategori: true // Menambahkan relasi untuk mendapatkan data status
                }
            });

            if (!komponen) {
                return res.status(404).json({
                    message: 'Komponen tidak ditemukan',
                });
            }

            const { ref_master_kategori, ...rest } = komponen;
            const flattenedKomponen = {
                ...rest,
                status: ref_master_kategori ? ref_master_kategori.nama : null,
            };

            res.status(200).json(flattenedKomponen);
        } catch (error) {
            next(error);
        }
    }

    static async createKomponen(req, res, next) {
        try {
            const { nama, keterangan, id_status } = req.body;

            // 1. Input validation
            if (!nama) {
                return res.status(400).json({
                    message: 'Nama wajib diisi',
                });
            }

            if (typeof nama !== 'string' || nama.length > 50) {
                return res.status(400).json({
                    message: 'Nama harus berupa string dengan panjang maksimum 50 karakter',
                });
            }

            if (keterangan !== undefined && typeof keterangan !== 'string') {
                return res.status(400).json({
                    message: 'Keterangan harus berupa string jika diisi',
                });
            }

            if (id_status !== undefined && (typeof id_status !== 'number' || isNaN(id_status))) {
                return res.status(400).json({
                    message: 'ID Status harus berupa angka jika diisi',
                });
            }

            // 2. Check for duplicate nama
            const duplicateKomponen = await prisma.ref_komponen_nilai.findFirst({
                where: {
                    nama,
                },
            });

            if (duplicateKomponen) {
                return res.status(400).json({
                    message: 'Komponen dengan nama yang sama sudah ada',
                });
            }

            // 3. Validate id_status exists if provided
            if (id_status !== undefined) {
                const statusExists = await prisma.ref_master_kategori.findUnique({
                    where: { id: id_status },
                });

                if (!statusExists) {
                    return res.status(400).json({
                        message: 'ID Status tidak valid',
                    });
                }
            }

            // 4. Create komponen
            const newKomponen = await prisma.ref_komponen_nilai.create({
                data: {
                    nama,
                    keterangan: keterangan !== undefined ? keterangan : null,
                    id_status: id_status !== undefined ? id_status : null,
                },
            });

            // 5. Success response
            res.status(201).json({
                message: 'Komponen berhasil ditambahkan',
                data: newKomponen,
            });
        } catch (error) {
            next(error);
        }
    }

    static async updateKomponen(req, res, next) {
        try {
            const { id } = req.params;
            const { nama, keterangan, id_status } = req.body;

            // 1. Input validation
            const parsedId = parseInt(id);
            if (isNaN(parsedId)) {
                return res.status(400).json({
                    message: 'ID komponen tidak valid',
                });
            }

            if (nama !== undefined) {
                if (typeof nama !== 'string' || nama.length > 50) {
                    return res.status(400).json({
                        message: 'Nama harus berupa string dengan panjang maksimum 50 karakter',
                    });
                }
            }

            if (keterangan !== undefined && typeof keterangan !== 'string') {
                return res.status(400).json({
                    message: 'Keterangan harus berupa string jika diisi',
                });
            }

            if (id_status !== undefined && (typeof id_status !== 'number' || isNaN(id_status))) {
                return res.status(400).json({
                    message: 'ID Status harus berupa angka jika diisi',
                });
            }

            // 2. Check if komponen exists
            const existingKomponen = await prisma.ref_komponen_nilai.findUnique({
                where: { id: parsedId },
            });

            if (!existingKomponen) {
                return res.status(404).json({
                    message: 'Komponen tidak ditemukan',
                });
            }

            // 3. Check for duplicate nama
            if (nama !== undefined) {
                const duplicateKomponen = await prisma.ref_komponen_nilai.findFirst({
                    where: {
                        nama,
                        NOT: { id: parsedId },
                    },
                });

                if (duplicateKomponen) {
                    return res.status(400).json({
                        message: 'Komponen dengan nama yang sama sudah ada',
                    });
                }
            }

            // 4. Validate id_status exists if provided
            if (id_status !== undefined) {
                const statusExists = await prisma.ref_master_kategori.findUnique({
                    where: { id: id_status },
                });

                if (!statusExists) {
                    return res.status(400).json({
                        message: 'ID Status tidak valid',
                    });
                }
            }

            // 5. Prepare update data
            const updateData = {
                nama: nama !== undefined ? nama : existingKomponen.nama,
                keterangan: keterangan !== undefined ? keterangan : existingKomponen.keterangan,
                id_status: id_status !== undefined ? id_status : existingKomponen.id_status,
            };

            // 6. Update komponen
            const updatedKomponen = await prisma.ref_komponen_nilai.update({
                where: { id: parsedId },
                data: updateData,
            });

            // 7. Success response
            res.status(200).json({
                message: 'Komponen berhasil diperbarui',
                data: updatedKomponen,
            });
        } catch (error) {
            next(error);
        }
    }

    static async deleteKomponen(req, res, next) {
        try {
            const { id } = req.params;

            // 1. Input validation
            const parsedId = parseInt(id);
            if (isNaN(parsedId)) {
                return res.status(400).json({
                    message: 'ID komponen tidak valid',
                });
            }

            // 2. Check if komponen exists
            const existingKomponen = await prisma.ref_komponen_nilai.findUnique({
                where: { id: parsedId },
            });

            if (!existingKomponen) {
                return res.status(404).json({
                    message: 'Komponen tidak ditemukan',
                });
            }

            // 3. Check if komponen is referenced in data_rencana_penilaian
            const relatedPenilaian = await prisma.data_rencana_penilaian.findFirst({
                where: { ref_komponen_nilai_id: parsedId },
            });

            if (relatedPenilaian) {
                return res.status(400).json({
                    message: 'Komponen tidak dapat dihapus karena masih digunakan dalam rencana penilaian',
                });
            }

            // 4. Delete komponen
            await prisma.ref_komponen_nilai.delete({
                where: { id: parsedId },
            });

            // 5. Success response
            res.status(200).json({
                message: 'Komponen berhasil dihapus',
            });
        } catch (error) {
            next(error);
        }
    }
}