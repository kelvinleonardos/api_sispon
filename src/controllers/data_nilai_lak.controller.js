import { prisma } from "../prisma.js";
import {getTokenPayload} from "../helpers.js";

export class DataNilaiLakController {
    static getDataNilaiLak = async (req, res, next) => {
        try {
            const { groupbyclass, class: className } = req.query;
            const { semester, tahunAjaran } = await getTokenPayload(req);

            // Validate className and get id_kelas if provided
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

            // Create where clause for data_rombel
            const whereClause = { id_tahun_ajaran: tahunAjaran.id };
            if (ref_kelas) {
                whereClause.id_kelas = ref_kelas.id;
            }

            const kat = await prisma.ref_master_kategori.findMany({
                where: {
                    tipe: "lak",
                }
            });

            const lakIds = kat.map(k => k.id);

            // Fetch all subjects (ref_mapel)
            const subjects = await prisma.ref_mapel.findMany({
                where: {
                    id_master_kategori_ref_mapel: {
                        in: lakIds,
                    }
                },
                orderBy: {
                    id: 'asc', // Ensure consistent ordering
                },
            });

            if (!subjects.length) {
                throw new Error('Tidak ada mata pelajaran ditemukan');
            }

            // Fetch rombels and their members
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

            if (!rombels.length) {
                throw new Error('Tidak ada rombel ditemukan');
            }

            let result = [];

            for (const rombel of rombels) {
                const santriIds = rombel.data_rombel_anggota.map(a => a.id_santri);

                // Fetch student list
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

                // Fetch grades for students in this semester
                const gradesList = await prisma.data_nilai_lak.findMany({
                    where: {
                        id_semester: semester.id,
                        id_santri: { in: santriIds },
                    },
                    include: {
                        ref_mapel: {
                            select: {
                                id: true,
                                nama: true,
                            },
                        },
                    },
                });

                // Create a map of grades per student and subject
                const gradesMap = gradesList.reduce((acc, item) => {
                    if (!acc[item.id_santri]) acc[item.id_santri] = {};
                    acc[item.id_santri][item.id_lak] = {
                        id_mapel: item.id_lak,
                        nama_mapel: item.ref_mapel.nama,
                        nilai: item.nilai,
                    };
                    return acc;
                }, {});

                // Format student data
                const formattedStudents = santriList.map(santri => {
                    const grades = subjects.map(subject => ({
                        id_mapel: subject.id,
                        nama_mapel: subject.nama,
                        nilai: gradesMap[santri.id]?.[subject.id]?.nilai || null,
                    }));

                    return {
                        id_santri: santri.id,
                        nis: santri.nis,
                        nama: santri.nama,
                        kelas: rombel.ref_kelas.kelas,
                        grades,
                    };
                });

                result.push({
                    class_id: rombel.id,
                    class: rombel.ref_kelas.kelas,
                    headers: subjects.map(s => ({
                        id: s.id,
                        nama: s.nama,
                    })),
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
                return res.status(200).json({
                    headers: subjects.map(s => ({
                        id: s.id,
                        nama: s.nama,
                    })),
                    students: flatList,
                });
            }
        } catch (error) {
            console.error('Error fetching rekap nilai:', error);
            next(error);
        }
    };

    static getDataNilaiLakByRombel = async (req, res, next) => {
        try {
            const { id } = req.params; // Get rombel ID from URL parameter
            const { semester, tahunAjaran } = await getTokenPayload(req);

            // Validate rombel ID
            const rombel = await prisma.data_rombel.findUnique({
                where: {
                    id: parseInt(id),
                    id_tahun_ajaran: tahunAjaran.id,
                },
                include: {
                    ref_kelas: true,
                    data_rombel_anggota: {
                        select: {
                            id_santri: true,
                        },
                    },
                },
            });

            if (!rombel) {
                return res.status(404).json({ message: "Rombel tidak ditemukan" });
            }

            const kat = await prisma.ref_master_kategori.findMany({
                where: {
                    tipe: "lak",
                }
            });

            const lakIds = kat.map(k => k.id);

            // Fetch all subjects (ref_mapel)
            const subjects = await prisma.ref_mapel.findMany({
                where: {
                    id_master_kategori_ref_mapel: {
                        in: lakIds,
                    }
                },
                orderBy: {
                    id: 'asc', // Ensure consistent ordering
                },
            });

            if (!subjects.length) {
                throw new Error('Tidak ada mata pelajaran ditemukan');
            }

            const santriIds = rombel.data_rombel_anggota.map(a => a.id_santri);

            // Fetch student list
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

            // Fetch grades for students in this semester
            const gradesList = await prisma.data_nilai_lak.findMany({
                where: {
                    id_semester: semester.id,
                    id_santri: { in: santriIds },
                },
                include: {
                    ref_mapel: {
                        select: {
                            id: true,
                            nama: true,
                        },
                    },
                },
            });

            // Create a map of grades per student and subject
            const gradesMap = gradesList.reduce((acc, item) => {
                if (!acc[item.id_santri]) acc[item.id_santri] = {};
                acc[item.id_santri][item.id_lak] = {
                    id_mapel: item.id_lak,
                    nama_mapel: item.ref_mapel.nama,
                    nilai: item.nilai,
                };
                return acc;
            }, {});

            // Format student data
            const formattedStudents = santriList.map(santri => {
                const grades = subjects.map(subject => ({
                    id_mapel: subject.id,
                    nama_mapel: subject.nama,
                    nilai: gradesMap[santri.id]?.[subject.id]?.nilai || null,
                }));

                return {
                    id_santri: santri.id,
                    nis: santri.nis,
                    nama: santri.nama,
                    kelas: rombel.ref_kelas.kelas,
                    grades,
                };
            }).sort((a, b) => a.nama.localeCompare(b.nama)); // Sort students alphabetically

            // Format response
            const result = {
                class_id: rombel.id,
                class: rombel.ref_kelas.kelas,
                headers: subjects.map(s => ({
                    id: s.id,
                    nama: s.nama,
                })),
                students: formattedStudents,
            };

            return res.status(200).json(result);
        } catch (error) {
            console.error('Error fetching rekap nilai by rombel:', error);
            next(error);
        }
    };

    static async updateDataNilaiLak(req, res, next) {
        try {
            const { semester, decoded, tahunAjaran } = await getTokenPayload(req);
            const { id_santri, id_lak, nilai } = req.body;

            // Validate input types
            if (
                typeof id_santri !== 'number' ||
                typeof id_lak !== 'number' ||
                typeof nilai !== 'number'
            ) {
                throw new Error("id_santri, id_lak, dan nilai harus bertipe number");
            }

            // Validate santri exists
            const santri = await prisma.santri.findUnique({
                where: { id: id_santri },
                select: { id: true },
            });
            if (!santri) {
                throw new Error("Santri tidak ditemukan");
            }

            // Validate subject (ref_mapel) exists
            const mapel = await prisma.ref_mapel.findUnique({
                where: { id: id_lak },
                select: { id: true },
            });
            if (!mapel) {
                throw new Error("Mata pelajaran tidak ditemukan");
            }

            // Validate semester from token payload
            if (!semester || !semester.id) {
                throw new Error("Semester tidak valid di token");
            }

            // Validate semester belongs to the current tahunAjaran
            const semesterRecord = await prisma.ref_semester.findUnique({
                where: { id: semester.id },
                select: { id: true, id_tahun_ajaran: true },
            });
            if (!semesterRecord) {
                throw new Error("Semester tidak ditemukan");
            }
            if (semesterRecord.id_tahun_ajaran !== tahunAjaran.id) {
                throw new Error("Semester tidak sesuai dengan tahun ajaran");
            }

            // Check if grade record exists
            const existing = await prisma.data_nilai_lak.findFirst({
                where: {
                    id_santri,
                    id_lak,
                    id_semester: semester.id,
                },
            });

            if (existing) {
                // Update existing record
                await prisma.data_nilai_lak.update({
                    where: { id: existing.id },
                    data: {
                        nilai,
                    },
                });
            } else {
                // Create new record
                await prisma.data_nilai_lak.create({
                    data: {
                        id_santri,
                        id_lak,
                        id_semester: semester.id,
                        nilai,
                    },
                });
            }

            return res.status(200).json({ message: "Data nilai lak berhasil diperbarui." });
        } catch (error) {
            console.error('Error updating nilai lak:', error);
            next(error);
        }
    }
}