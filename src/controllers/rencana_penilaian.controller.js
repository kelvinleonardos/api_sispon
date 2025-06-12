import { prisma } from "../prisma.js";

export class RencanaPenilaianController {
    static async createRencanaPenilaian(req, res, next) {
        try {
            const { id_kelas, id_komponen, nama, bobot, nilai_maksimum, keterangan, bulan, hari, id_kd, pekan } = req.body;

            // Validate required fields
            if (!id_kelas || !id_komponen || !nama || !bulan || !hari || !id_kd) {
                return res.status(400).json({ message: 'id_kelas, id_komponen, nama, bulan, hari, dan id_kd wajib diisi' });
            }

            // Validate numeric fields
            if (isNaN(parseInt(id_kelas)) || isNaN(parseInt(id_komponen)) || isNaN(parseInt(bulan)) || isNaN(parseInt(id_kd))) {
                return res.status(400).json({ message: 'id_kelas, id_komponen, bulan, dan id_kd harus berupa angka' });
            }

            // Validate hari enum (assuming hari_enum is defined in Prisma, e.g., 'Senin', 'Selasa', etc.)
            const validHariValues = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
            if (!validHariValues.includes(hari)) {
                return res.status(400).json({ message: 'Hari tidak valid' });
            }

            // Determine the next urutan value for the given id_kelas
            const maxUrutan = await prisma.data_rencana_penilaian.aggregate({
                where: {
                    id_kelas: parseInt(id_kelas),
                },
                _max: {
                    urutan: true,
                },
            });

            const newUrutan = (maxUrutan._max.urutan || 0) + 1;

            // Create the new rencana penilaian within a transaction
            const rc_pn = await prisma.$transaction(async (tx) => {
                const createdRencana = await tx.data_rencana_penilaian.create({
                    data: {
                        id_kelas: parseInt(id_kelas),
                        id_komponen: parseInt(id_komponen),
                        nama,
                        bobot: bobot || 0,
                        nilai_maksimum: nilai_maksimum || 100.00,
                        keterangan,
                        bulan: parseInt(bulan),
                        hari,
                        id_kd: parseInt(id_kd),
                        pekan: pekan ? parseInt(pekan) : null,
                        urutan: newUrutan,
                    },
                });

                return createdRencana;
            });

            res.status(201).json({
                message: `Berhasil menambahkan data rencana penilaian`,
                data: rc_pn,
            });
        } catch (error) {
            next(error);
        }
    }

    static async updateRencanaPenilaian(req, res, next) {
        try {
            const { id } = req.params; // ID of the rencana penilaian to update
            const { id_komponen, nama, bobot, nilai_maksimum, keterangan, bulan, hari, id_kd, pekan, urutan } = req.body;

            // Validate ID
            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({ message: 'ID rencana penilaian tidak valid' });
            }

            // Fetch the existing record to get id_kelas
            const existingRencana = await prisma.data_rencana_penilaian.findUnique({
                where: { id: parseInt(id) },
            });

            if (!existingRencana) {
                return res.status(404).json({ message: 'Rencana penilaian tidak ditemukan' });
            }

            // Validate and prepare update data
            const updateData = {};
            if (id_komponen !== undefined) updateData.id_komponen = parseInt(id_komponen);
            if (nama !== undefined) updateData.nama = nama;
            if (bobot !== undefined) updateData.bobot = parseInt(bobot) || 0;
            if (nilai_maksimum !== undefined) updateData.nilai_maksimum = parseFloat(nilai_maksimum) || 100.00;
            if (keterangan !== undefined) updateData.keterangan = keterangan;
            if (bulan !== undefined) {
                if (isNaN(parseInt(bulan))) {
                    return res.status(400).json({ message: 'Bulan harus berupa angka' });
                }
                updateData.bulan = parseInt(bulan);
            }
            if (hari !== undefined) {
                const validHariValues = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
                if (!validHariValues.includes(hari)) {
                    return res.status(400).json({ message: 'Hari tidak valid' });
                }
                updateData.hari = hari;
            }
            if (id_kd !== undefined) {
                if (isNaN(parseInt(id_kd))) {
                    return res.status(400).json({ message: 'id_kd harus berupa angka' });
                }
                updateData.id_kd = parseInt(id_kd);
            }
            if (pekan !== undefined) updateData.pekan = pekan ? parseInt(pekan) : null;
            if (urutan !== undefined) {
                if (isNaN(parseInt(urutan))) {
                    return res.status(400).json({ message: 'urutan harus berupa angka' });
                }
                // Check if the new urutan conflicts with existing records in the same id_kelas
                const conflictingUrutan = await prisma.data_rencana_penilaian.findFirst({
                    where: {
                        id_kelas: existingRencana.id_kelas,
                        urutan: parseInt(urutan),
                        id: { not: parseInt(id) }, // Exclude the current record
                    },
                });

                if (conflictingUrutan) {
                    return res.status(400).json({ message: 'Urutan sudah digunakan oleh rencana penilaian lain dalam kelas yang sama' });
                }
                updateData.urutan = parseInt(urutan);
            }

            // Update the record within a transaction
            const updatedRencana = await prisma.$transaction(async (tx) => {
                const result = await tx.data_rencana_penilaian.update({
                    where: { id: parseInt(id) },
                    data: updateData,
                });

                return result;
            });

            res.status(200).json({
                message: `Berhasil memperbarui data rencana penilaian`,
                data: updatedRencana,
            });
        } catch (error) {
            next(error);
        }
    }

    static async deleteRencanaPenilaian(req, res, next) {
        try {
            const { id_rencana } = req.params;

            // Validasi apakah rencana penilaian ada
            const rencanaPenilaian = await prisma.data_rencana_penilaian.findUnique({
                where: { id: parseInt(id_rencana) },
            });

            if (!rencanaPenilaian) {
                return res.status(404).json({ message: 'Rencana penilaian tidak ditemukan' });
            }

            // Hapus rencana penilaian
            await prisma.data_rencana_penilaian.delete({
                where: { id: parseInt(id_rencana) },
            });

            res.status(200).json({ message: 'Rencana penilaian berhasil dihapus' });
        } catch (e) {
            next(e);
        }
    }

}