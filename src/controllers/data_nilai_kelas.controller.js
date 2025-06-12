import { prisma } from "../prisma.js"
import {getTokenPayload} from "../helpers.js";

export class DataNilaiKelasController {
    static async createDataNilaiKelas(req, res, next) {
        try {
            const { id_rencana, id_santri, nilai, keterangan } = req.body;

            // Validasi input
            if (!id_rencana || !id_santri) {
                return res.status(400).json({ message: 'id_rencana dan id_santri wajib diisi' });
            }

            // Validasi apakah rencana penilaian ada
            const rencanaPenilaian = await prisma.data_rencana_penilaian.findUnique({
                where: { id: parseInt(id_rencana) },
            });

            if (!rencanaPenilaian) {
                return res.status(404).json({ message: 'Rencana penilaian tidak ditemukan' });
            }

            // Validasi apakah santri ada
            const santri = await prisma.santri.findUnique({
                where: { id: parseInt(id_santri) },
            });

            if (!santri) {
                return res.status(404).json({ message: 'Santri tidak ditemukan' });
            }

            // Cek apakah data nilai kelas sudah ada untuk id_rencana dan id_santri
            const existingNilaiKelas = await prisma.data_nilai_kelas.findFirst({
                where: {
                    id_rencana: parseInt(id_rencana),
                    id_santri: parseInt(id_santri),
                },
            });

            let nilaiKelas;

            if (existingNilaiKelas) {
                // Jika data sudah ada, update nilai dan keterangan
                nilaiKelas = await prisma.data_nilai_kelas.update({
                    where: { id: existingNilaiKelas.id },
                    data: {
                        nilai: nilai !== undefined ? nilai : existingNilaiKelas.nilai,
                        keterangan: keterangan !== undefined ? keterangan : existingNilaiKelas.keterangan,
                    },
                });

                return res.status(200).json({
                    message: 'Data nilai kelas berhasil diperbarui',
                    data: nilaiKelas,
                });
            } else {
                // Jika data belum ada, buat data baru
                nilaiKelas = await prisma.data_nilai_kelas.create({
                    data: {
                        id_rencana: parseInt(id_rencana),
                        id_santri: parseInt(id_santri),
                        nilai: nilai || null,
                        keterangan: keterangan || null,
                    },
                });

                return res.status(201).json({
                    message: 'Data nilai kelas berhasil dibuat',
                    data: nilaiKelas,
                });
            }
        } catch (e) {
            next(e);
        }
    }
}