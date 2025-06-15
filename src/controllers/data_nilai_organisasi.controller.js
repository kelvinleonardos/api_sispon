import { prisma } from "../prisma.js";
import {getTokenPayload} from "../helpers.js";

export class NilaiOrganisasiController {
    static async getAll(req, res, next) {
        try {
            const { groupbyclass, class: className } = req.query;
            const { semester, tahunAjaran } = await getTokenPayload(req);

            // Validasi className dan ambil id_kelas jika diberikan
            let ref_kelas = null;
            if (className) {
                const name = className.split(" - ")[0].trim();
                let gender = className.split(" - ")[1]?.trim() || null;
                if (gender === "null") {
                    gender = null;
                }
                ref_kelas = await prisma.ref_kelas.findFirst({
                    where: {
                        kelas: name,
                        gender: gender,
                    },
                });
                if (!ref_kelas) {
                    return res.status(404).json({ message: "Kelas tidak ditemukan" });
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

                const nilaiOrganisasiList = await prisma.data_nilai_organisasi.findMany({
                    where: {
                        id_semester: semester.id,
                        data_anggota_organisasi: {
                            id_santri: { in: santriIds },
                        },
                    },
                    include: {
                        data_anggota_organisasi: {
                            include: {
                                organisasi: true
                            }
                        }
                    },
                });

                const nilaiMap = nilaiOrganisasiList.reduce((acc, item) => {
                    if (!acc[item.data_anggota_organisasi.id_santri]) acc[item.data_anggota_organisasi.id_santri] = [];
                    acc[item.data_anggota_organisasi.id_santri].push({
                        id_nilai: item.id,
                        id_anggota: item.data_anggota_organisasi.id,
                        nilai: item.nilai,
                        organisasi: item.data_anggota_organisasi.organisasi?.nama || null,
                    });
                    return acc;
                }, {});

                const formattedStudents = santriList.map(santri => ({
                    id_santri: santri.id,
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

    static async getById(req, res, next) {
        try {
            const { id } = req.params;
            const nilaiOrganisasi = await prisma.data_nilai_organisasi.findUnique({
                where: { id: parseInt(id) },
                include: {
                    data_anggota_organisasi: true,
                    ref_semester: true,
                },
            });
            if (!nilaiOrganisasi) {
                res.status(404);
                throw new Error('Nilai organisasi tidak ditemukan');
            }
            res.status(200).json(nilaiOrganisasi);
        } catch (error) {
            next(error);
        }
    }

    static async create(req, res, next) {
        try {
            const { id_anggota, id_semester, nilai } = req.body;
            const nilaiOrganisasi = await prisma.data_nilai_organisasi.create({
                data: {
                    id_anggota,
                    id_semester: id_semester ?? null,
                    nilai: nilai ?? null,
                },
                include: {
                    data_anggota_organisasi: true,
                    ref_semester: true,
                },
            });
            res.status(201).json(nilaiOrganisasi);
        } catch (error) {
            next(error);
        }
    }

    static async update(req, res, next) {
        try {
            const { semester } = await getTokenPayload(req);
            const { id_anggota, nilai } = req.body;

            // Validate input
            if (!id_anggota || nilai === undefined) {
                return res.status(400).json({
                    status: 'error',
                    message: 'id_anggota dan nilai harus diisi',
                });
            }

            // Check if a record exists for the given id_anggota, semester, and tahunAjaran
            const existingRecord = await prisma.data_nilai_organisasi.findFirst({
                where: {
                    id_anggota: parseInt(id_anggota),
                    id_semester: semester.id
                },
            });

            let nilaiOrganisasi;

            if (existingRecord) {
                // Update existing record
                nilaiOrganisasi = await prisma.data_nilai_organisasi.update({
                    where: { id: existingRecord.id },
                    data: {
                        nilai: nilai,
                    },
                });
            } else {
                // Create new record
                nilaiOrganisasi = await prisma.data_nilai_organisasi.create({
                    data: {
                        id_anggota: parseInt(id_anggota),
                        id_semester: semester.id,
                        nilai: nilai,
                    },
                });
            }

            res.status(200).json({
                message: existingRecord ? 'Nilai organisasi berhasil diperbarui' : 'Nilai organisasi berhasil dibuat',
                data: nilaiOrganisasi,
            });
        } catch (error) {
            next(error);
        }
    }

    static async delete(req, res, next) {
        try {
            const { id } = req.params;
            await prisma.data_nilai_organisasi.delete({
                where: { id: parseInt(id) },
            });
            res.status(200).json({ message: 'Nilai organisasi berhasil dihapus' });
        } catch (error) {
            next(error);
        }
    }
}