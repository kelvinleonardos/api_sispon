import { prisma } from "../prisma.js";
import { getTokenPayload } from "../helpers.js";

export class IzinSantriController {

    static async getTipeIzin(req, res, next) {
        try {
            // Ambil semua tipe izin dari database
            const tipeIzin = await prisma.ref_master_kategori.findMany({
                where: {
                    tipe: 'status_izin_santri',
                },
                orderBy: {
                    nama: 'asc',
                },
            });

            // Format respons
            return res.status(200).json(tipeIzin);
        } catch (error) {
            console.error('Error fetching tipe izin:', error);
            next(error);
        }
    }

    static async getIzinSantri(req, res, next) {
        try {
            const { groupbyclass, class: className, month } = req.query;
            const { decoded, semester, tahunAjaran } = await getTokenPayload(req);

            // Validasi className dan ambil id_kelas jika diberikan
            let ref_kelas = null;
            if (className) {
                const name = className.split(" - ")[0].trim();
                let gender = className.split(" - ")[1]?.trim() || null;
                if (gender === "null") {
                    gender = null;
                }
                // Konversi string "null" ke null
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
                        },
                    },
                    ref_kelas: true,
                },
            });

            // Fungsi untuk format tanggal ke "tanggal bulan tahun"
            const formatTanggal = (date) => {
                if (!date) return null;
                const day = date.getDate();
                const monthNames = [
                    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
                ];
                const month = monthNames[date.getMonth()];
                const year = date.getFullYear();
                return `${day} ${month} ${year}`;
            };

            // Fungsi untuk menghitung durasi (selisih hari, inklusif)
            const hitungDurasi = (startDate, endDate) => {
                if (!startDate || !endDate) return null;
                const start = new Date(startDate);
                const end = new Date(endDate);
                const diffTime = Math.abs(end - start);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inklusif
                return diffDays;
            };

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

                // Buat where clause untuk data_izin_santri
                const izinWhereClause = {
                    id_santri: { in: anggotaIds },
                    id_semester: semester.id,
                };

                const tahun = semester.urutan === 1 ? tahunAjaran.tahun_mulai : tahunAjaran.tahun_selesai;

                // Tambahkan filter bulan jika month diberikan
                if (monthFilter) {
                    izinWhereClause.OR = [
                        {
                            tgl_mulai: {
                                gte: new Date(`${tahun}-${monthFilter.toString().padStart(2, '0')}-01`),
                                lte: new Date(`${tahun}-${monthFilter.toString().padStart(2, '0')}-31`),
                            },
                        },
                        {
                            tgl_selesai: {
                                gte: new Date(`${tahun}-${monthFilter.toString().padStart(2, '0')}-01`),
                                lte: new Date(`${tahun}-${monthFilter.toString().padStart(2, '0')}-31`),
                            },
                        },
                    ];
                }

                // Ambil data izin santri
                const izinList = await prisma.data_izin_santri.findMany({
                    where: izinWhereClause,
                    include: {
                        ref_master_kategori: {
                            select: {
                                nama: true,
                            },
                        },
                    },
                });

                // Kelompokkan data izin berdasarkan santri
                const izinMap = izinList.reduce((acc, item) => {
                    if (!acc[item.id_santri]) {
                        acc[item.id_santri] = [];
                    }
                    acc[item.id_santri].push({
                        id: item.id,
                        id_status: item.id_status,
                        tujuan: item.tujuan || null,
                        tgl_mulai: item.tgl_mulai || null,
                        tgl_selesai: item.tgl_selesai || null,
                        durasi: hitungDurasi(item.tgl_mulai, item.tgl_selesai),
                        catatan: item.catatan || null,
                        status: item.ref_master_kategori ? item.ref_master_kategori.nama : null,
                    });
                    return acc;
                }, {});

                // Buat daftar santri dengan data izin
                const simplifiedStudents = rombel.data_rombel_anggota
                    .filter(anggota => santriMap[anggota.id_santri])
                    .map(anggota => ({
                        id: santriMap[anggota.id_santri].id,
                        nis: santriMap[anggota.id_santri].nis,
                        nama: santriMap[anggota.id_santri].nama,
                        kelas: rombel.ref_kelas.kelas,
                        izin: izinMap[anggota.id_santri] || [],
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
            console.error('Error fetching izin santri:', error);
            next(error);
        }
    }

    static async getIzinSantriById(req, res, next) {
        try {
            const { id } = req.params;
            const { month } = req.query;
            const { decoded, semester, tahunAjaran } = await getTokenPayload(req);

            // Validasi ID santri
            const santriId = parseInt(id);
            if (isNaN(santriId)) {
                throw new Error('ID santri tidak valid');
            }

            // Ambil data santri
            const santri = await prisma.santri.findUnique({
                where: { id: santriId },
                select: { id: true, nis: true, nama: true },
            });

            if (!santri) {
                throw new Error('Santri tidak ditemukan');
            }

            // Ambil data rombel untuk mendapatkan kelas
            const rombel = await prisma.data_rombel.findFirst({
                where: {
                    id_tahun_ajaran: tahunAjaran.id,
                    data_rombel_anggota: {
                        some: { id_santri: santriId },
                    },
                },
                include: {
                    ref_kelas: {
                        select: { kelas: true },
                    },
                },
            });

            // Validasi parameter month (1-12)
            let monthFilter = null;
            if (month) {
                monthFilter = parseInt(month);
                if (isNaN(monthFilter) || monthFilter < 1 || monthFilter > 12) {
                    throw new Error('Parameter bulan harus berupa angka antara 1 dan 12');
                }
            }

            // Buat where clause untuk data_izin_santri
            const izinWhereClause = {
                id_santri: santriId,
                id_semester: semester.id,
            };

            const tahun = semester.urutan === 1 ? tahunAjaran.tahun_mulai : tahunAjaran.tahun_selesai;

            // Tambahkan filter bulan jika month diberikan
            if (monthFilter) {
                izinWhereClause.OR = [
                    {
                        tgl_mulai: {
                            gte: new Date(`${tahun}-${monthFilter.toString().padStart(2, '0')}-01`),
                            lte: new Date(`${tahun}-${monthFilter.toString().padStart(2, '0')}-31`),
                        },
                    },
                    {
                        tgl_selesai: {
                            gte: new Date(`${tahun}-${monthFilter.toString().padStart(2, '0')}-01`),
                            lte: new Date(`${tahun}-${monthFilter.toString().padStart(2, '0')}-31`),
                        },
                    },
                ];
            }

            // Ambil data izin santri
            const izinList = await prisma.data_izin_santri.findMany({
                where: izinWhereClause,
                include: {
                    ref_master_kategori: {
                        select: {
                            nama: true,
                        },
                    },
                },
            });

            // Fungsi untuk format tanggal ke "tanggal bulan tahun"
            const formatTanggal = (date) => {
                if (!date) return null;
                const day = date.getDate();
                const monthNames = [
                    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
                ];
                const month = monthNames[date.getMonth()];
                const year = date.getFullYear();
                return `${day} ${month} ${year}`;
            };

            // Fungsi untuk menghitung durasi (selisih hari, inklusif)
            const hitungDurasi = (startDate, endDate) => {
                if (!startDate || !endDate) return null;
                const start = new Date(startDate);
                const end = new Date(endDate);
                const diffTime = Math.abs(end - start);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inklusif
                return diffDays;
            };

            // Format data izin
            const izinData = izinList.map(item => ({
                id: item.id,
                tujuan: item.tujuan || null,
                tgl_mulai: item.tgl_mulai ? formatTanggal(new Date(item.tgl_mulai)) : null,
                tgl_selesai: item.tgl_selesai ? formatTanggal(new Date(item.tgl_selesai)) : null,
                durasi: hitungDurasi(item.tgl_mulai, item.tgl_selesai),
                catatan: item.catatan || null,
                status: item.ref_master_kategori ? item.ref_master_kategori.nama : null,
            }));

            // Format respons
            const response = {
                id: santri.id,
                nis: santri.nis,
                nama: santri.nama,
                kelas: rombel ? rombel.ref_kelas.kelas : null,
                izin: izinData,
            };

            return res.status(200).json(response);
        } catch (error) {
            console.error('Error fetching izin santri by ID:', error);
            next(error);
        }
    }

    static async createIzinSantri(req, res, next) {
        try {
            const { id_santri, tujuan, tgl_mulai, tgl_selesai, catatan, id_status } = req.body;
            const { decoded, semester, tahunAjaran } = await getTokenPayload(req);

            console.log(req.body);

            // Validasi input
            if (!id_santri || !tujuan || !tgl_mulai || !tgl_selesai || !id_status) {
                return res.status(403).json({
                    message: 'Semua field harus diisi',
                });
            }

            // Validasi ID santri
            const santriId = parseInt(id_santri);
            if (isNaN(santriId)) {
                return res.status(403).json({
                    message: 'ID santri tidak valid',
                });
            }

            // Cek apakah santri ada
            const santri = await prisma.santri.findUnique({
                where: { id: santriId },
            });
            if (!santri) {
                return res.status(403).json({
                    message: 'Santri tidak ditemukan',
                });
            }

            // Validasi ID kategori
            const kategori = await prisma.ref_master_kategori.findUnique({
                where: { id: parseInt(id_status) },
            });
            if (!kategori) {
                return res.status(403).json({
                    message: 'Kategori status tidak ditemukan',
                });
            }

            // Fungsi untuk parsing tanggal dari format DD-MM-YYYY
            const parseTanggal = (tanggal) => {
                if (!tanggal) return null;
                const [day, month, year] = tanggal.split('-').map(Number);
                if (!day || !month || !year || isNaN(day) || isNaN(month) || isNaN(year)) {
                    throw new Error('Format tanggal tidak valid, gunakan DD-MM-YYYY');
                }
                return new Date(year, month - 1, day); // month - 1 karena Date menggunakan 0-11 untuk bulan
            };

            // Validasi dan parsing tanggal
            const startDate = parseTanggal(tgl_mulai);
            const endDate = parseTanggal(tgl_selesai);
            if (!startDate || !endDate || isNaN(startDate) || isNaN(endDate)) {
                return res.status(403).json({
                    message: 'Format tanggal tidak valid, gunakan DD-MM-YYYY',
                });
            }
            if (startDate > endDate) {
                return res.status(403).json({
                    message: 'Tanggal mulai tidak boleh setelah tanggal selesai',
                });
            }

            // Buat data izin baru
            const newIzin = await prisma.data_izin_santri.create({
                data: {
                    id_santri: santriId,
                    id_semester: semester.id,
                    tujuan,
                    tgl_mulai: startDate,
                    tgl_selesai: endDate,
                    catatan: catatan || null,
                    id_status: parseInt(id_status),
                },
                include: {
                    ref_master_kategori: {
                        select: { nama: true },
                    },
                },
            });

            // Fungsi untuk format tanggal ke "tanggal bulan tahun" (untuk output)
            const formatTanggal = (date) => {
                if (!date) return null;
                const day = date.getDate();
                const monthNames = [
                    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
                ];
                const month = monthNames[date.getMonth()];
                const year = date.getFullYear();
                return `${day} ${month} ${year}`;
            };

            // Fungsi untuk menghitung durasi (selisih hari, inklusif)
            const hitungDurasi = (startDate, endDate) => {
                if (!startDate || !endDate) return null;
                const start = new Date(startDate);
                const end = new Date(endDate);
                const diffTime = Math.abs(end - start);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inklusif
                return diffDays;
            };

            // Format respons
            const response = {
                id: newIzin.id,
                id_santri: newIzin.id_santri,
                tujuan: newIzin.tujuan,
                tgl_mulai: newIzin.tgl_mulai ? formatTanggal(new Date(newIzin.tgl_mulai)) : null,
                tgl_selesai: newIzin.tgl_selesai ? formatTanggal(new Date(newIzin.tgl_selesai)) : null,
                durasi: hitungDurasi(newIzin.tgl_mulai, newIzin.tgl_selesai),
                catatan: newIzin.catatan || null,
                status: newIzin.ref_master_kategori ? newIzin.ref_master_kategori.nama : null,
            };

            return res.status(201).json({
                message: 'Izin santri berhasil dibuat',
                data: response,
            });
        } catch (error) {
            console.error('Error creating izin santri:', error);
            next(error);
        }
    }

    static async updateIzinSantri(req, res, next) {
        try {
            const { id } = req.params;
            const { tujuan, tgl_mulai, tgl_selesai, catatan, id_status } = req.body;
            const { decoded, semester } = await getTokenPayload(req);

            // Validasi ID izin
            const izinId = parseInt(id);
            if (isNaN(izinId)) {
                return res.status(403).json({
                    message: 'ID izin tidak valid',
                });
            }

            // Cek apakah izin ada
            const izin = await prisma.data_izin_santri.findUnique({
                where: { id: izinId },
            });
            if (!izin) {
                return res.status(403).json({
                    message: 'Izin tidak ditemukan',
                });
            }

            // Validasi ID kategori jika diberikan
            if (id_status) {
                const kategori = await prisma.ref_master_kategori.findUnique({
                    where: { id: parseInt(id_status) },
                });
                if (!kategori) {
                    return res.status(403).json({
                        message: 'Kategori status tidak ditemukan',
                    });
                }
            }

            // Fungsi untuk parsing tanggal dari format DD-MM-YYYY
            const parseTanggal = (tanggal) => {
                if (!tanggal) return null;
                const [day, month, year] = tanggal.split('-').map(Number);
                if (!day || !month || !year || isNaN(day) || isNaN(month) || isNaN(year)) {
                    throw new Error('Format tanggal tidak valid, gunakan DD-MM-YYYY');
                }
                return new Date(year, month - 1, day); // month - 1 karena Date menggunakan 0-11 untuk bulan
            };

            // Validasi dan parsing tanggal jika diberikan
            let startDate, endDate;
            if (tgl_mulai) {
                startDate = parseTanggal(tgl_mulai);
                if (!startDate || isNaN(startDate)) {
                    return res.status(403).json({
                        message: 'Format tanggal mulai tidak valid, gunakan DD-MM-YYYY',
                    });
                }
            }
            if (tgl_selesai) {
                endDate = parseTanggal(tgl_selesai);
                if (!endDate || isNaN(endDate)) {
                    return res.status(403).json({
                        message: 'Format tanggal selesai tidak valid, gunakan DD-MM-YYYY',
                    });
                }
            }
            if (startDate && endDate && startDate > endDate) {
                return res.status(403).json({
                    message: 'Tanggal mulai tidak boleh setelah tanggal selesai',
                });
            }

            // Update data izin
            const updatedIzin = await prisma.data_izin_santri.update({
                where: { id: izinId },
                data: {
                    tujuan: tujuan || izin.tujuan,
                    tgl_mulai: startDate || izin.tgl_mulai,
                    tgl_selesai: endDate || izin.tgl_selesai,
                    catatan: catatan !== undefined ? catatan : izin.catatan,
                    id_status: id_status ? parseInt(id_status) : izin.id_status,
                    id_semester: semester.id,
                },
                include: {
                    ref_master_kategori: {
                        select: { nama: true },
                    },
                },
            });

            // Fungsi untuk format tanggal ke "tanggal bulan tahun" (untuk output)
            const formatTanggal = (date) => {
                if (!date) return null;
                const day = date.getDate();
                const monthNames = [
                    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
                ];
                const month = monthNames[date.getMonth()];
                const year = date.getFullYear();
                return `${day} ${month} ${year}`;
            };

            // Fungsi untuk menghitung durasi (selisih hari, inklusif)
            const hitungDurasi = (startDate, endDate) => {
                if (!startDate || !endDate) return null;
                const start = new Date(startDate);
                const end = new Date(endDate);
                const diffTime = Math.abs(end - start);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inklusif
                return diffDays;
            };

            // Format respons
            const response = {
                id: updatedIzin.id,
                id_santri: updatedIzin.id_santri,
                tujuan: updatedIzin.tujuan,
                tgl_mulai: updatedIzin.tgl_mulai ? formatTanggal(new Date(updatedIzin.tgl_mulai)) : null,
                tgl_selesai: updatedIzin.tgl_selesai ? formatTanggal(new Date(updatedIzin.tgl_selesai)) : null,
                durasi: hitungDurasi(updatedIzin.tgl_mulai, updatedIzin.tgl_selesai),
                catatan: updatedIzin.catatan || null,
                status: updatedIzin.ref_master_kategori ? updatedIzin.ref_master_kategori.nama : null,
            };

            return res.status(200).json({
                message: "Izin santri berhasil diperbarui",
                data: response,
            });
        } catch (error) {
            console.error('Error updating izin santri:', error);
            next(error);
        }
    }

    static async deleteIzinSantri(req, res, next) {
        try {
            const { id } = req.params;

            // Validasi ID izin
            const izinId = parseInt(id);
            if (isNaN(izinId)) {
                return res.status(403).json({
                    message: 'ID izin tidak valid',
                });
            }

            // Cek apakah izin ada
            const izin = await prisma.data_izin_santri.findUnique({
                where: { id: izinId },
            });
            if (!izin) {
                return res.status(403).json({
                    message: 'Izin tidak ditemukan',
                });
            }

            // Hapus data izin
            await prisma.data_izin_santri.delete({
                where: { id: izinId },
            });

            return res.status(200).json({ message: 'Izin berhasil dihapus' });
        } catch (error) {
            console.error('Error deleting izin santri:', error);
            next(error);
        }
    }
}