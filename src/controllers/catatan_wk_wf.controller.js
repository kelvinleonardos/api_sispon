import { prisma } from "../prisma.js";
import { getTokenPayload } from "../helpers.js";

export class CatatanWkWfController {

    static async getCatatanWk(req, res, next) {
        try {
            const { groupbyclass, class: className, month } = req.query;
            const { decoded, semester, tahunAjaran } = await getTokenPayload(req);

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

            // Validasi parameter month (1-12)
            let monthFilter = null;
            if (month) {
                monthFilter = parseInt(month);
                if (isNaN(monthFilter) || monthFilter < 1 || monthFilter > 12) {
                    throw new Error('Parameter bulan harus berupa angka antara 1 dan 12');
                }
            }

            // Buat where clause untuk data_rombel
            const whereClause = { id_tahun_ajaran: tahunAjaran.id };
            if (ref_kelas) {
                whereClause.id_kelas = parseInt(ref_kelas.id);
            }

            // Ambil data rombel beserta anggota dan kelas
            const rombels = await prisma.data_rombel.findMany({
                where: whereClause,
                include: {
                    data_rombel_anggota: {
                        select: {
                            id_santri: true,
                            catatan_wk_ts: true,
                            catatan_wk_as: true,
                            created_at: true,
                        },
                    },
                    ref_kelas: true,
                },
            });

            let santriData = [];

            for (const rombel of rombels) {
                const anggotaIds = rombel.data_rombel_anggota.map(anggota => anggota.id_santri);

                // Ambil data santri untuk anggota rombel
                const santriList = await prisma.santri.findMany({
                    where: { id: { in: anggotaIds } },
                    select: { id: true, nis: true, nama: true },
                });

                // Buat map santri berdasarkan ID
                const santriMap = santriList.reduce((acc, santri) => {
                    acc[santri.id] = santri;
                    return acc;
                }, {});

                // Filter catatan berdasarkan bulan jika monthFilter diberikan
                const filteredAnggota = rombel.data_rombel_anggota.filter(anggota => {
                    if (!monthFilter || !anggota.created_at) return true;
                    return anggota.created_at.getMonth() + 1 === monthFilter;
                });

                // Format data santri dengan catatan WK
                const simplifiedStudents = filteredAnggota
                    .filter(anggota => santriMap[anggota.id_santri])
                    .map(anggota => ({
                        id: santriMap[anggota.id_santri].id,
                        nis: santriMap[anggota.id_santri].nis,
                        nama: santriMap[anggota.id_santri].nama,
                        kelas: rombel.ref_kelas.kelas,
                        catatan_wali_kelas: {
                            tengah_semester: anggota.catatan_wk_ts || null,
                            akhir_semester: anggota.catatan_wk_as || null,
                        },
                    }));

                santriData.push({
                    class_id: rombel.id,
                    class: rombel.ref_kelas.kelas,
                    students: simplifiedStudents,
                });
            }

            // Format respons berdasarkan groupbyclass
            if (groupbyclass === "true") {
                const sortedData = santriData.map(rombel => {
                    rombel.students.sort((a, b) => a.nama.localeCompare(b.nama));
                    return rombel;
                });
                return res.status(200).json(sortedData);
            } else {
                const flatList = santriData
                    .flatMap(item => item.students)
                    .sort((a, b) => a.nama.localeCompare(b.nama));
                return res.status(200).json(flatList);
            }
        } catch (error) {
            console.error('Error fetching catatan wali kelas:', error);
            next(error);
        }
    }

    static async getCatatanWf(req, res, next) {
        try {
            const { groupbyclass, class: className, month } = req.query;
            const { decoded, semester, tahunAjaran } = await getTokenPayload(req);

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

            // Validasi parameter month (1-12)
            let monthFilter = null;
            if (month) {
                monthFilter = parseInt(month);
                if (isNaN(monthFilter) || monthFilter < 1 || monthFilter > 12) {
                    throw new Error('Parameter bulan harus berupa angka antara 1 dan 12');
                }
            }

            // Buat where clause untuk data_rombel
            const whereClause = { id_tahun_ajaran: tahunAjaran.id };
            if (ref_kelas) {
                whereClause.id_kelas = parseInt(ref_kelas.id);
            }

            // Ambil data rombel beserta anggota dan kelas
            const rombels = await prisma.data_rombel.findMany({
                where: whereClause,
                include: {
                    data_rombel_anggota: {
                        select: {
                            id_santri: true,
                            catatan_wf_ts: true,
                            catatan_wf_as: true,
                            created_at: true,
                        },
                    },
                    ref_kelas: true,
                },
            });

            let santriData = [];

            for (const rombel of rombels) {
                const anggotaIds = rombel.data_rombel_anggota.map(anggota => anggota.id_santri);

                // Ambil data santri untuk anggota rombel
                const santriList = await prisma.santri.findMany({
                    where: { id: { in: anggotaIds } },
                    select: { id: true, nis: true, nama: true },
                });

                // Buat map santri berdasarkan ID
                const santriMap = santriList.reduce((acc, santri) => {
                    acc[santri.id] = santri;
                    return acc;
                }, {});

                // Filter catatan berdasarkan bulan jika monthFilter diberikan
                const filteredAnggota = rombel.data_rombel_anggota.filter(anggota => {
                    if (!monthFilter || !anggota.created_at) return true;
                    return anggota.created_at.getMonth() + 1 === monthFilter;
                });

                // Format data santri dengan catatan WK
                const simplifiedStudents = filteredAnggota
                    .filter(anggota => santriMap[anggota.id_santri])
                    .map(anggota => ({
                        id: santriMap[anggota.id_santri].id,
                        nis: santriMap[anggota.id_santri].nis,
                        nama: santriMap[anggota.id_santri].nama,
                        kelas: rombel.ref_kelas.kelas,
                        catatan_wali_fiah: {
                            tengah_semester: anggota.catatan_wf_ts || null,
                            akhir_semester: anggota.catatan_wf_as || null,
                        },
                    }));

                santriData.push({
                    class_id: rombel.id,
                    class: rombel.ref_kelas.kelas,
                    students: simplifiedStudents,
                });
            }

            // Format respons berdasarkan groupbyclass
            if (groupbyclass === "true") {
                const sortedData = santriData.map(rombel => {
                    rombel.students.sort((a, b) => a.nama.localeCompare(b.nama));
                    return rombel;
                });
                return res.status(200).json(sortedData);
            } else {
                const flatList = santriData
                    .flatMap(item => item.students)
                    .sort((a, b) => a.nama.localeCompare(b.nama));
                return res.status(200).json(flatList);
            }
        } catch (error) {
            console.error('Error fetching catatan wali kelas:', error);
            next(error);
        }
    }

    static async updateCatatanWk(req, res, next) {
        try {
            const { id_santri } = req.params;
            const { catatan_wk_ts, catatan_wk_as } = req.body;
            const { tahunAjaran } = await getTokenPayload(req);

            // Validasi input
            if (!catatan_wk_ts && !catatan_wk_as) {
                return res.status(400).json({ message: 'Catatan WK harus diisi' });
            }

            // Validasi ID
            const santriId = parseInt(id_santri);
            const tahunAjaranId = parseInt(tahunAjaran.id);
            if (isNaN(santriId)) throw new Error('ID santri tidak valid');
            if (isNaN(tahunAjaranId)) throw new Error('ID tahun ajaran tidak valid');

            // Cek keberadaan data rombel anggota dengan relasi ke data_rombel
            const existingData = await prisma.data_rombel_anggota.findFirst({
                where: {
                    id_santri: santriId,
                    data_rombel: { id_tahun_ajaran: tahunAjaranId },
                },
            });
            if (!existingData) throw new Error('Data rombel anggota tidak ditemukan');

            // Update data
            const updatedData = await prisma.data_rombel_anggota.update({
                where: { id: existingData.id },
                data: { catatan_wk_ts, catatan_wk_as },
                select: {
                    id_santri: true,
                    id_rombel: true,
                    catatan_wk_ts: true,
                    catatan_wk_as: true,
                    catatan_wf_ts: true,
                    catatan_wf_as: true,
                },
            });

            res.status(200).json({ message: 'Catatan Wali Kelas berhasil diperbarui', data: updatedData });
        } catch (error) {
            console.error(`Error updating catatan WK untuk santri ID ${req.params.id_santri}:`, error);
            next(error);
        }
    }

    static async updateCatatanWf(req, res, next) {
        try {
            const { id_santri } = req.params;
            const { catatan_wf_ts, catatan_wf_as } = req.body;
            const { tahunAjaran } = await getTokenPayload(req);

            // Validasi input
            if (!catatan_wf_ts && !catatan_wf_as) {
                return res.status(400).json({ message: 'Catatan WF harus diisi' });
            }

            // Validasi ID
            const santriId = parseInt(id_santri);
            const tahunAjaranId = parseInt(tahunAjaran.id);
            if (isNaN(santriId)) throw new Error('ID santri tidak valid');
            if (isNaN(tahunAjaranId)) throw new Error('ID tahun ajaran tidak valid');

            // Cek keberadaan data rombel anggota dengan relasi ke data_rombel
            const existingData = await prisma.data_rombel_anggota.findFirst({
                where: {
                    id_santri: santriId,
                    data_rombel: { id_tahun_ajaran: tahunAjaranId },
                },
            });
            if (!existingData) throw new Error('Data rombel anggota tidak ditemukan');

            // Update data
            const updatedData = await prisma.data_rombel_anggota.update({
                where: { id: existingData.id },
                data: { catatan_wf_ts, catatan_wf_as },
                select: {
                    id_santri: true,
                    id_rombel: true,
                    catatan_wk_ts: true,
                    catatan_wk_as: true,
                    catatan_wf_ts: true,
                    catatan_wf_as: true,
                },
            });

            res.status(200).json({ message: 'Catatan Wali Fiah berhasil diperbarui', data: updatedData });
        } catch (error) {
            console.error(`Error updating catatan WF untuk santri ID ${req.params.id_santri}:`, error);
            next(error);
        }
    }
}