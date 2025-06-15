import { prisma } from "../prisma.js";
import {JWTService} from "../services/jwt.service.js";
import {getTokenPayload} from "../helpers.js";

/*
Master Kategori Ekskul:
1. Akademik
2. Non Akademik
 */

export class EkskulSantriController {
    static createEkskulSantri = async (req, res) => {
        try {
            const { id_santri, id_mapel, tgl_masuk, tgl_keluar, id_kepesertaan, keterangan } = req.body;

            // Buat data ekskul santri baru
            const newEkskulSantri = await prisma.data_eskul.create({
                data: {
                    id_santri: parseInt(id_santri),
                    id_mapel: parseInt(id_mapel),
                    tgl_masuk: tgl_masuk ? new Date(tgl_masuk) : null,
                    tgl_keluar: tgl_keluar ? new Date(tgl_keluar) : null,
                    id_kepesertaan: parseInt(id_kepesertaan),
                    keterangan: keterangan || null,
                },
            });

            // Respon sukses
            return res.status(201).json({
                message: 'Berhasil membuat ekskul santri',
                data: newEkskulSantri,
            });
        } catch (error) {
            console.error('Error creating ekskul santri:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Terjadi kesalahan pada server',
            });
        }
    };

    static getAllEkskulSantri = async (req, res, next) => {
        try {
            const { groupbyclass, class: className, cat } = req.query;
            const { decoded, semester, tahunAjaran } = await getTokenPayload(req);

            // Build where clause for rombel query
            const whereClause = { id_tahun_ajaran: tahunAjaran.id };
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

            // Fetch rombel data with members
            const rombels = await prisma.data_rombel.findMany({
                where: whereClause,
                include: {
                    data_rombel_anggota: {
                        select: {
                            id_santri: true,
                        },
                    },
                    ref_kelas:true
                },
                orderBy: [
                    { ref_kelas: { id_tingkat: 'asc' } },
                    { ref_kelas: { urutan: 'asc' } }
                ],
            });

            if (!rombels.length) {
                return res.status(200).json([]);
            }

            // Fetch extracurricular categories
            const ekskulCategories = await prisma.ref_master_kategori.findMany({
                where: { tipe: "ekskul" },
                select: { id: true },
            });

            const ekskul_master_ids = ekskulCategories.map((category) => category.id);

            if (ekskul_master_ids.length === 0) {
                return res.status(200).json([]);
            }

            let santriData = [];

            for (const rombel of rombels) {
                const anggotaIds = rombel.data_rombel_anggota.map((anggota) => anggota.id_santri);

                // Initialize student list and ekskul map
                let santriList = [];
                let santriMap = {};
                let ekskulMap = {};

                if (anggotaIds.length > 0) {
                    // Fetch santri data for members
                    santriList = await prisma.santri.findMany({
                        where: { id: { in: anggotaIds } },
                        select: { id: true, nis: true, nama: true },
                    });

                    // Create a map of santri ID to santri data
                    santriMap = santriList.reduce((acc, santri) => {
                        acc[santri.id] = santri;
                        return acc;
                    }, {});

                    // Build where clause for ekskul query
                    const ekskulWhereClause = {
                        id_santri: { in: anggotaIds },
                    };

                    if (cat) {
                        if (isNaN(parseInt(cat))) {
                            return res.status(400).json({ message: "Kategori harus berupa angka" });
                        }
                        ekskulWhereClause.ref_mapel = {
                            id_master_kategori_ref_mapel: parseInt(cat),
                        };
                    }

                    // Fetch extracurricular data
                    const ekskulList = await prisma.data_eskul.findMany({
                        where: ekskulWhereClause,
                        include: {
                            ref_mapel: {
                                select: {
                                    id: true,
                                    nama: true,
                                },
                            },
                        },
                    });

                    // Create a map of santri ID to their extracurriculars
                    ekskulMap = ekskulList.reduce((acc, ekskul) => {
                        if (!acc[ekskul.id_santri]) {
                            acc[ekskul.id_santri] = [];
                        }
                        acc[ekskul.id_santri].push({
                            id: ekskul.ref_mapel.id,
                            nama: ekskul.ref_mapel.nama,
                        });
                        return acc;
                    }, {});
                }

                // Create student list with extracurricular data
                const simplifiedStudents = rombel.data_rombel_anggota
                    .filter((anggota) => santriMap[anggota.id_santri])
                    .map((anggota) => ({
                        id: santriMap[anggota.id_santri].id,
                        nis: santriMap[anggota.id_santri].nis,
                        nama: santriMap[anggota.id_santri].nama,
                        kelas: rombel.nama,
                        ekskul: ekskulMap[anggota.id_santri] || [],
                    }));

                // Add rombel to santriData, even if it has no students
                santriData.push({
                    class_id: rombel.id,
                    class: rombel.ref_kelas.kelas,
                    students: simplifiedStudents,
                });
            }

            // Format final response
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
                return res.status(200).json(flatList);
            }
        } catch (error) {
            console.error("Error in getAllEkskulSantri:", error);
            next(error);
        }
    };

    static getJabatan = async (req, res, next) => {
        try {
            const jabatanList = await prisma.ref_master_kategori.findMany({
                where: {
                    tipe: "kepesertaan_ekskul",
                },
                select: {
                    id: true,
                    nama: true,
                },
            });

            if (!jabatanList || jabatanList.length === 0) {
                return res.status(404).json({ message: "Jabatan tidak ditemukan" });
            }

            return res.status(200).json(jabatanList);
        } catch (error) {
            console.error("Error fetching jabatan:", error);
            next(error);
        }
    }

    static getEkskulSantriById = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { decoded, semester, tahunAjaran } = await getTokenPayload(req);

            // Get the student data
            const santri = await prisma.santri.findUnique({
                where: { id: parseInt(id) },
                select: { id: true, nis: true, nama: true }
            });

            if (!santri) {
                return res.status(404).json({ message: "Student not found" });
            }

            // Get the student's class membership
            const rombelAnggota = await prisma.data_rombel_anggota.findFirst({
                where: {
                    id_santri: parseInt(id),
                    data_rombel: {
                        id_tahun_ajaran: tahunAjaran.id
                    }
                },
                include: {
                    data_rombel: {
                        include: {
                            ref_kelas: true
                        }
                    }
                }
            });

            if (!rombelAnggota) {
                return res.status(200).json({
                    id: santri.id,
                    nis: santri.nis,
                    nama: santri.nama,
                    kelas: null,
                    ekskul: []
                });
            }

            // Get the student's extracurricular activities
            const ekskulList = await prisma.data_eskul.findMany({
                where: {
                    id_santri: parseInt(id),
                },
                include: {
                    ref_mapel: {
                        include: {
                            ref_master_kategori_ref_mapel: true
                        }
                    },
                    ref_master_kategori: true
                }
            });

            const master_kateogori_eksul = await prisma.ref_master_kategori.findMany({
                where: {
                    tipe: "ekskul",
                },
                select: {
                    id: true,
                },
            });

            // Get extracurricular names
            const mapelIds = ekskulList.map(ekskul => ekskul.id_mapel);
            const mapelList = await prisma.ref_mapel.findMany({
                where: {
                    id: { in: mapelIds },
                    id_master_kategori_ref_mapel: {
                        in: master_kateogori_eksul.map(cat => cat.id)
                    }
                },
                select: {
                    id: true,
                    nama: true
                }
            });

            // Map extracurricular IDs to names
            const mapelMap = mapelList.reduce((acc, mapel) => {
                acc[mapel.id] = mapel.nama;
                return acc;
            }, {});

            console.log(ekskulList);

            // Format extracurricular data
            const ekskulData = ekskulList.map(ekskul => ({
                id_ekskul: ekskul.id_mapel,
                id_ekskul_santri: ekskul.id,
                nama: mapelMap[ekskul.id_mapel] || "Unknown",
                tgl_masuk: ekskul.tgl_masuk,
                tgl_keluar: ekskul.tgl_keluar,
                tipe: ekskul.ref_mapel.ref_master_kategori_ref_mapel.nama,
                id_kepesertaan: ekskul.id_kepesertaan,
                jabatan: ekskul.ref_master_kategori ? ekskul.ref_master_kategori.nama : null,
                keterangan: ekskul.keterangan || null
            }));

            // Return the formatted response
            return res.status(200).json({
                id: santri.id,
                nis: santri.nis,
                nama: santri.nama,
                kelas: rombelAnggota.data_rombel.ref_kelas.kelas,
                ekskul: ekskulData
            });

        } catch (error) {
            console.error(error);
            next(error);
        }
    };

    static updateEkskulSantri = async (req, res, next) => {
        try {
            const { id_ekskul_santri } = req.params;
            const data = req.body;

            console.log(data);

            // Cek apakah record ekskul santri ada
            const existingEkskul = await prisma.data_eskul.findUnique({
                where: { id: parseInt(id_ekskul_santri) },
            });

            if (!existingEkskul) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Data ekskul santri tidak ditemukan',
                });
            }

            // Update data ekskul santri
            const updatedEkskulSantri = await prisma.data_eskul.update({
                where: { id: parseInt(id_ekskul_santri) },
                data: data,
            });

            // Respon sukses
            return res.status(200).json({
                message: 'Berhasil memperbarui ekskul santri',
                data: updatedEkskulSantri,
            });
        } catch (error) {
            console.error('Error updating ekskul santri:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Terjadi kesalahan pada server',
            });
        }
    };

    static deleteEkskulSantri = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { id_mapel } = req.body;

            const id_mapel_list = Array.isArray(id_mapel) ? id_mapel : [id_mapel];

            if (id_mapel_list.length === 0) {
                return res.status(400).json({
                    message: "id_mapel list cannot be empty"
                });
            }

            // Jalankan penghapusan dalam satu transaksi
            await prisma.$transaction(
                id_mapel_list.map((mapelId) =>
                    prisma.data_eskul.deleteMany({
                        where: {
                            id_santri: parseInt(id),
                            id_mapel: parseInt(mapelId)
                        }
                    })
                )
            );

            res.status(200).json({
                message: "Mapel berhasil dihapus"
            });
        } catch (error) {
            next(error);
        }
    };

}