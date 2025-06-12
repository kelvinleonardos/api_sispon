import { prisma } from "../prisma.js"
import {getTokenPayload} from "../helpers.js";

export class DataNilaiEskulController {

    static async getDataNilaiEskul(req, res, next) {
        try {
            const { groupbyclass, class: className } = req.query;
            const { semester, tahunAjaran } = await getTokenPayload(req);

            // Validasi className dan ambil id_kelas jika diberikan
            let ref_kelas = null;
            if (className) {
                ref_kelas = await prisma.ref_kelas.findFirst({
                    where: { kelas: className },
                });
                if (!ref_kelas) {
                    throw new Error('Kelas tidak ditemukan');
                }
            }

            // Buat where clause untuk data_rombel
            const whereClause = { id_tahun_ajaran: tahunAjaran.id };
            if (ref_kelas) {
                whereClause.id_kelas = ref_kelas.id;
            }

            const rombels = await prisma.data_rombel.findMany({
                where: whereClause,
                include: {
                    ref_kelas: true,
                    data_rombel_anggota: {
                        select: {
                            id_santri: true,
                        },
                    },
                },
            });

            let result = [];

            for (const rombel of rombels) {
                const santriIds = rombel.data_rombel_anggota.map(a => a.id_santri);

                const santriList = await prisma.santri.findMany({
                    where: {
                        id: { in: santriIds },
                    },
                    select: {
                        id: true,
                        nis: true,
                        nama: true,
                    },
                });

                const nilaiEskulList = await prisma.data_nilai_eskul.findMany({
                    where: {
                        id_santri: { in: santriIds },
                        id_semester: semester.id,
                    },
                    include: {
                        ref_mapel: true,
                    },
                });

                const nilaiMap = nilaiEskulList.reduce((acc, item) => {
                    if (!acc[item.id_santri]) acc[item.id_santri] = [];
                    acc[item.id_santri].push({
                        id: item.id,
                        nilai: item.nilai,
                        catatan: item.catatan || null,
                        mapel: item.ref_mapel?.nama || null,
                    });
                    return acc;
                }, {});

                const formattedStudents = santriList.map(santri => ({
                    id: santri.id,
                    nis: santri.nis,
                    nama: santri.nama,
                    kelas: rombel.ref_kelas.kelas,
                    nilai_eskul: nilaiMap[santri.id] || [],
                }));

                result.push({
                    class_id: rombel.id,
                    class: rombel.ref_kelas.kelas,
                    students: formattedStudents,
                });
            }

            // Format response
            if (groupbyclass === 'true') {
                const sorted = result.map(r => ({
                    ...r,
                    students: r.students.sort((a, b) => a.nama.localeCompare(b.nama)),
                }));
                return res.status(200).json(sorted);
            } else {
                const flatList = result
                    .flatMap(r => r.students)
                    .sort((a, b) => a.nama.localeCompare(b.nama));
                return res.status(200).json(flatList);
            }
        } catch (error) {
            console.error('Error fetching nilai ekskul:', error);
            next(error);
        }
    }

    static async updateDataNilaiEskul(req, res, next) {
        try {
            const { semester, decoded } = await getTokenPayload(req);
            const { id_santri, id_mapel, catatan, nilai } = req.body;

            if (
                typeof id_santri !== 'number' ||
                typeof id_mapel !== 'number' ||
                typeof nilai !== 'number'
            ) {
                throw new Error("Tiap item harus memiliki id_santri, id_mapel, dan nilai yang valid");
            }

            const existing = await prisma.data_nilai_eskul.findFirst({
                where: {
                    id_santri,
                    id_mapel,
                    id_semester: semester.id,
                },
            });

            if (existing) {
                await prisma.data_nilai_eskul.update({
                    where: { id: existing.id },
                    data: {
                        nilai,
                        catatan: catatan || null,
                        updated_by: decoded.id,
                    },
                });
            } else {
                await prisma.data_nilai_eskul.create({
                    data: {
                        id_santri,
                        id_mapel,
                        catatan: catatan || null,
                        id_semester: semester.id,
                        nilai,
                        created_by: decoded.id,
                    },
                });
            }

            return res.status(200).json({ message: "Data nilai ekskul berhasil diperbarui." });
        } catch (error) {
            console.error('Error updating nilai ekskul:', error);
            next(error);
        }
    }


}