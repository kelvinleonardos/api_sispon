import { prisma } from "../prisma.js";
import {getTokenPayload} from "../helpers.js";

export class AnggotaOrganisasiController {
    static async getAll(req, res, next) {
        try {
            const { groupbyclass, class: className } = req.query;
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
                let organisasiMap = {};

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

                    const organisasiList = await prisma.data_anggota_organisasi.findMany({
                        where: ekskulWhereClause,
                        include: {
                            organisasi: true
                        },
                    });

                    // Create a map of santri ID to their extracurriculars
                    organisasiMap = organisasiList.reduce((acc, organisasi) => {
                        console.log(organisasi)
                        if (!acc[organisasi.id_santri]) {
                            acc[organisasi.id_santri] = [];
                        }
                        acc[organisasi.id_santri].push({
                            id_anggota: organisasi.id,
                            id_organisasi: organisasi.organisasi.id,
                            nama: organisasi.organisasi.nama,
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
                        organisasi: organisasiMap[anggota.id_santri] || [],
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
    }

    static async getById(req, res, next) {
        try {
            const { id_santri } = req.params;
            const santriId = parseInt(id_santri);

            // Fetch santri data first
            const santriData = await prisma.santri.findUnique({
                where: { id: santriId },
            });

            if (!santriData) {
                res.status(404);
                throw new Error('Data santri tidak ditemukan');
            }

            // Fetch membership data
            const anggotaList = await prisma.data_anggota_organisasi.findMany({
                where: { id_santri: santriId },
                include: {
                    organisasi: true,
                    ref_master_kategori: true
                },
            });

            // Map organizations, or return empty array if no memberships
            const organisasiList = anggotaList.map(anggota => ({
                id_organisasi: anggota.organisasi.id,
                id_anggota: anggota.id,
                nama_organisasi: anggota.organisasi.nama,
                tanggal_masuk: anggota.tanggal_masuk,
                tanggal_keluar: anggota.tanggal_keluar,
                jabatan: anggota.ref_master_kategori ? anggota.ref_master_kategori.nama : null,
                keterangan: anggota.keterangan,
            }));

            const response = {
                id_santri: santriData.id,
                nis: santriData.nis,
                nama_santri: santriData.nama,
                organisasi: organisasiList,
            };

            res.status(200).json(response);
        } catch (error) {
            next(error);
        }
    }

    static async create(req, res, next) {
        try {
            const { id_organisasi, id_santri, id_jabatan, tanggal_masuk, tanggal_keluar, keterangan } = req.body;
            const anggota = await prisma.data_anggota_organisasi.create({
                data: {
                    id_organisasi,
                    id_santri,
                    id_jabatan: id_jabatan ?? null,
                    tanggal_masuk: tanggal_masuk ? new Date(tanggal_masuk) : null,
                    tanggal_keluar: tanggal_keluar ? new Date(tanggal_keluar) : null,
                    keterangan: keterangan ?? null,
                }
            });
            res.status(201).json({
                message: 'Anggota organisasi berhasil dibuat',
                data: anggota,
            });
        } catch (error) {
            next(error);
        }
    }

    static async update(req, res, next) {
        try {
            const { id } = req.params;
            const { id_organisasi, id_santri, id_jabatan, tanggal_masuk, tanggal_keluar, keterangan } = req.body;
            const anggota = await prisma.data_anggota_organisasi.update({
                where: { id: parseInt(id) },
                data: {
                    id_organisasi: id_organisasi ?? undefined,
                    id_santri: id_santri ?? undefined,
                    id_jabatan: id_jabatan ?? undefined,
                    tanggal_masuk: tanggal_masuk ? new Date(tanggal_masuk) : undefined,
                    tanggal_keluar: tanggal_keluar ? new Date(tanggal_keluar) : undefined,
                    keterangan: keterangan ?? undefined,
                },
                include: {
                    organisasi: true,
                    santri: true,
                    ref_master_kategori: true,
                },
            });
            res.status(200).json({
                message: 'Anggota organisasi berhasil diperbarui',
                data: anggota
            });
        } catch (error) {
            next(error);
        }
    }

    static async delete(req, res, next) {
        try {
            const { id } = req.params;
            await prisma.data_anggota_organisasi.delete({
                where: { id: parseInt(id) },
            });
            res.status(200).json({ message: 'Anggota organisasi berhasil dihapus' });
        } catch (error) {
            next(error);
        }
    }
}