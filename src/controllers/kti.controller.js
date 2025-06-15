import { prisma } from '../prisma.js';
import {JWTService} from "../services/jwt.service.js";
import {getTokenPayload} from "../helpers.js";

export class KtiController {
    static getAllKti = async (req, res, next) => {
        try {
            const { groupbyclass, class: className } = req.query;
            const { decoded, semester } = await getTokenPayload(req);

            // Validasi className jika diberikan
            const whereClause = {
                id_tahun_ajaran: semester.id_tahun_ajaran,
            };
            if (className) {
                const name = className.split(" - ")[0].trim();
                let gender = className.split(" - ")[1]?.trim() || null;
                if (gender === "null") {
                    gender = null;
                }
                const ref_kelas = await prisma.ref_kelas.findFirst({
                    where: {
                        kelas: name,
                        gender: gender,
                    },
                });
                if (!ref_kelas) {
                    return res.status(404).json({ message: "Kelas tidak ditemukan" });
                }
                whereClause.id_kelas = ref_kelas.id;
            }

            // Ambil data rombel beserta anggota-anggotanya
            const rombels = await prisma.data_rombel.findMany({
                where: whereClause,
                include: {
                    data_rombel_anggota: true,
                    ref_kelas: true,
                },
            });

            let santriData = [];

            // Proses setiap rombel
            for (const rombel of rombels) {
                const anggotaIds = rombel.data_rombel_anggota.map((anggota) => anggota.id_santri);

                // Jika rombel tidak memiliki anggota, tambahkan data kosong
                if (anggotaIds.length === 0) {
                    santriData.push({
                        class_id: rombel.id,
                        class: rombel.ref_kelas?.kelas || null,
                        total_students: 0,
                        students_without_grades: 0,
                        students: [],
                    });
                    continue;
                }

                // Ambil data santri
                const santriList = await prisma.santri.findMany({
                    where: { id: { in: anggotaIds } },
                    select: { id: true, nis: true, nama: true },
                });

                // Ambil data nilai KTI
                const ktiList = await prisma.data_nilai_kti.findMany({
                    where: { id_santri: { in: anggotaIds }, id_semester: semester.id },
                    select: { id: true, id_santri: true, judul: true, nilai: true },
                });

                // Buat map untuk KTI berdasarkan id_santri
                const ktiMap = ktiList.reduce((acc, kti) => {
                    acc[kti.id_santri] = kti;
                    return acc;
                }, {});

                // Ambil data tim untuk setiap KTI
                const simplifiedStudents = await Promise.all(
                    santriList.map(async (santri) => {
                        const kti = ktiMap[santri.id] || {};
                        let team = [];

                        // Jika KTI memiliki judul, ambil anggota tim dengan judul yang sama
                        if (kti.judul) {
                            const kti_team = await prisma.data_nilai_kti.findMany({
                                where: {
                                    judul: kti.judul,
                                    id_santri: { not: santri.id },
                                    id_semester: semester.id,
                                },
                                select: {
                                    id: true,
                                    id_santri: true,
                                    nilai: true,
                                },
                            });

                            // Ambil nama santri dan kelas untuk anggota tim
                            team = await Promise.all(
                                kti_team.map(async (member) => {
                                    const teamSantri = await prisma.santri.findUnique({
                                        where: { id: member.id_santri },
                                        include: {
                                            data_rombel_anggota: {
                                                where: { data_rombel: { id_tahun_ajaran: semester.id_tahun_ajaran } },
                                                include: {
                                                    data_rombel: {
                                                        include: {
                                                            ref_kelas: true,
                                                        },
                                                    },
                                                },
                                                take: 1,
                                            },
                                        },
                                    });

                                    return {
                                        id: member.id,
                                        santri_id: member.id_santri,
                                        nama: teamSantri ? teamSantri.nama : null,
                                        kelas: teamSantri?.data_rombel_anggota?.[0]?.data_rombel?.ref_kelas?.kelas || null,
                                        nilai: member.nilai,
                                    };
                                })
                            );
                        }

                        // Hitung nilai null
                        const isNullValue = !kti.nilai;

                        return {
                            id_santri: santri.id || null,
                            nim: santri.nis,
                            nama: santri.nama,
                            kelas: rombel.ref_kelas?.kelas || null,
                            kti_id: kti.id || null,
                            judul: kti.judul || null,
                            nilai: kti.nilai || null,
                            team: team.length > 0 ? team : null,
                            has_null_value: isNullValue,
                        };
                    })
                );

                // Hitung jumlah nilai null
                const studentsWithoutGrades = simplifiedStudents.filter((student) => student.has_null_value).length;

                // Tambahkan data rombel ke santriData
                santriData.push({
                    class_id: rombel.id,
                    class: rombel.ref_kelas?.kelas || null,
                    total_students: santriList.length,
                    students_without_grades: studentsWithoutGrades,
                    students: simplifiedStudents.map(({ has_null_value, ...rest }) => rest),
                });
            }

            // Penyusunan response akhir
            if (groupbyclass === "true") {
                const sortedData = santriData.map((rombel) => {
                    rombel.students.sort((a, b) => a.nama.localeCompare(b.nama));
                    return rombel;
                });
                return res.status(200).json(sortedData);
            } else {
                const flatList = santriData
                    .flatMap((item) => item.students)
                    .sort((a, b) => a.nama.localeCompare(b.nama));
                return res.status(200).json({
                    total_students: flatList.length,
                    total_students_without_grades: santriData.reduce((sum, rombel) => sum + rombel.students_without_grades, 0),
                    students: flatList,
                });
            }
        } catch (error) {
            console.log(error);
            next(error);
        }
    };

    static getKtiById = async (req, res, next) => {
        try {
            const { id } = req.params;

            // Ambil data KTI berdasarkan ID
            const kti = await prisma.data_nilai_kti.findUnique({
                where: { id: parseInt(id) }
            });

            if (!kti) return res.status(404).json({ message: "KTI data not found" });

            // Ambil data santri yang diklik
            const santri_clicked = await prisma.santri.findUnique({
                where: { id: parseInt(kti.id_santri) },
                select: { id: true, nama: true },
            });

            // Ambil semua KTI dengan judul yang sama
            const kti_team = await prisma.data_nilai_kti.findMany({
                where: {
                    judul: kti.judul,
                    id: { not: parseInt(id) } // Kecualikan KTI yang sedang dilihat
                },
                select: {
                    id: true,
                    id_santri: true,
                    nilai: true
                }
            });

            // Ambil data santri untuk setiap anggota tim
            const santri_team = await Promise.all(
                kti_team.map(async (member) => {
                    const santri = await prisma.santri.findUnique({
                        where: { id: parseInt(member.id_santri) },
                        select: { id: true, nama: true }
                    });
                    return {
                        id: member.id,
                        santri_id: member.id_santri,
                        nama: santri.nama,
                        nilai: member.nilai
                    };
                })
            );

            // Susun response data
            const data = {
                santri: {
                    id: santri_clicked.id,
                    nama: santri_clicked.nama
                },
                kti: {
                    id: kti.id,
                    judul: kti.judul,
                    nilai: kti.nilai
                },
                team: santri_team
            };

            res.status(200).json(data);
        } catch (error) {
            next(error);
        }
    };

    // Batch create KTI data for multiple students
    static batchCreateKti = async (req, res, next) => {
        try {
            // Destructure input dari req.body
            const { id_santri, id_semester, nilai, judul } = req.body;

            // Validasi input
            if (!id_santri || !id_semester || !nilai || !judul) {
                return res.status(400).json({
                    message: "Missing required fields: id_santri, id_semester, nilai, judul"
                });
            }

            // Konversi id_santri menjadi array jika bukan array
            const id_santri_list = Array.isArray(id_santri) ? id_santri : [id_santri];

            // Validasi bahwa id_santri_list tidak kosong
            if (id_santri_list.length === 0) {
                return res.status(400).json({
                    message: "id_santri list cannot be empty"
                });
            }

            // Buat array data untuk transaksi batch
            const ktiData = await prisma.$transaction(
                id_santri_list.map(id_santri => {
                    return prisma.data_nilai_kti.create({
                        data: {
                            id_santri: parseInt(id_santri), // Pastikan id_santri adalah integer
                            id_semester: parseInt(id_semester), // Pastikan integer
                            nilai: parseInt(nilai), // Konversi nilai ke integer sesuai schema
                            judul
                        }
                    });
                })
            );

            // Kirim respons sukses
            res.status(201).json({
                message: "KTI data creation successful",
                data: ktiData
            });
        } catch (error) {
            next(error);
        }
    };

    // Update KTI data by ID
    static updateKti = async (req, res, next) => {
        try {
            // Ambil token dari header Authorization
            const { decoded, semester } = await getTokenPayload(req);

            // Ambil input dari req.body
            const { id_santri, nilai, judul } = req.body;

            // Validasi input
            if (!id_santri) {
                return res.status(400).json({ message: "id_santri is required" });
            }

            // Konversi id_santri menjadi array jika bukan array
            const id_santri_list = Array.isArray(id_santri) ? id_santri : [id_santri];

            // Validasi bahwa id_santri_list tidak kosong
            if (id_santri_list.length === 0) {
                return res.status(400).json({ message: "id_santri list cannot be empty" });
            }

            // Siapkan data untuk update atau create
            const updateData = {};
            const createData = {
                id_semester: semester.id
            };
            if (judul) {
                updateData.judul = judul;
                createData.judul = judul;
            }
            if (nilai) {
                updateData.nilai = parseInt(nilai); // Konversi ke integer sesuai schema
                createData.nilai = parseInt(nilai);
            }

            // Proses setiap santri secara berurutan
            const updatedData = [];
            for (const santriId of id_santri_list) {
                // Cari entri KTI yang ada
                createData.id_santri = parseInt(santriId);
                const existingKti = await prisma.data_nilai_kti.findFirst({
                    where: {
                        id_santri: parseInt(santriId),
                        id_semester: semester.id
                    }
                });

                let kti;
                if (existingKti) {
                    // Jika entri ada, update hanya field yang dikirim
                    if (Object.keys(updateData).length > 0) {
                        kti = await prisma.data_nilai_kti.update({
                            where: { id: existingKti.id },
                            data: updateData
                        });
                    } else {
                        kti = existingKti; // Tidak ada perubahan, kembalikan data asli
                    }
                } else {
                    // Jika entri tidak ada, buat baru
                    kti = await prisma.data_nilai_kti.create({
                        data: createData
                    });
                }
                updatedData.push(kti);
            }

            // Kirim respons sukses
            res.status(200).json({
                message: "Data KTI Berhasil diperbarui",
                data: updatedData
            });
        } catch (error) {
            console.error("Error processing KTI:", error);
            next(error);
        }
    };

    // Delete KTI data by ID
    static deleteKti = async (req, res, next) => {
        try {
            const { id } = req.params;
            await prisma.data_nilai_kti.delete({
                where: { id: parseInt(id) }
            });
            res.status(200).json({ message: "KTI data deleted successfully" });
        } catch (error) {
            next(error);
        }
    };
}