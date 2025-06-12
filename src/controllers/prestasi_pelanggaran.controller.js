import {JWTService} from "../services/jwt.service.js";

import { prisma } from "../prisma.js";
import {getTokenPayload, printPdf} from "../helpers.js";
import path from "path";
import {fileURLToPath} from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/*
basis_lokasi_prestasi_pelanggaran:
25. Asrama
26. Sekolah
 */

export class PrestasiPelanggaranController {
    static createPrestasiPelanggaran = async (req, res, next) => {
        try {
            const {
                id_santri,
                perihal,
                judul,
                capaian,
                tanggal,
                tempat,
                deskripsi,
                resolusi,
                id_basis_lokasi
            } = JSON.parse(req.body.data);


            const file_bukti = req.files;

            let file_bukti_list = [];

            for (const file of file_bukti) {
                file_bukti_list.push(`/uploads/bukti-prpl/${perihal === 'prestasi' ? 'prestasi' : 'pelanggaran'}/${file.filename}`);
            }

            // Validasi input
            if (!id_santri || !perihal || !judul || !tempat || !deskripsi ) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Field wajib harus diisi'
                });
            }

            // Validasi enum perihal
            if (!['prestasi', 'pelanggaran'].includes(perihal)) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Perihal harus prestasi atau pelanggaran'
                });
            }

            // Buat data baru
            const newData = await prisma.data_prestasi_pelanggaran.create({
                data: {
                    id_santri,
                    perihal,
                    judul,
                    capaian: capaian || null,
                    tanggal: tanggal ? new Date(tanggal) : new Date(),
                    tempat,
                    deskripsi,
                    bukti: file_bukti_list.toString(),
                    resolusi: resolusi || null,
                    id_basis_lokasi: parseInt(id_basis_lokasi)
                }
            });

            return res.status(201).json({
                message: 'Prestasi/Pelanggaran berhasil dibuat',
                data: newData
            });
        } catch (error) {
            console.log(error);
            next(error);
        }
    };

    static getAllPrestasiPelanggaran = async (req, res, next) => {
        try {
            const { groupbyclass, class: className, type, cat } = req.query;
            const { decoded, semester, tahunAjaran } = await getTokenPayload(req);

            const ref_kelas = await prisma.ref_kelas.findFirst({
                where: {
                    kelas: className,
                }
            });

            const whereClause = { id_tahun_ajaran: tahunAjaran.id };
            if (className) {
                whereClause["id_kelas"] = parseInt(ref_kelas.id);
            }

            // Fetch rombel data with members
            const rombels = await prisma.data_rombel.findMany({
                where: whereClause,
                include: {
                    data_rombel_anggota: {
                        select: {
                            id_santri: true
                        }
                    },
                    ref_kelas: true
                }
            });

            let santriData = [];

            for (const rombel of rombels) {
                const anggotaIds = rombel.data_rombel_anggota.map(anggota => anggota.id_santri);

                // Fetch santri data for members
                const santriList = await prisma.santri.findMany({
                    where: { id: { in: anggotaIds } },
                    select: { id: true, nis: true, nama: true }
                });

                // Create a map of santri ID to santri data
                const santriMap = santriList.reduce((acc, santri) => {
                    acc[santri.id] = santri;
                    return acc;
                }, {});

                // Build prestasi/pelanggaran where clause
                const prestasiPelanggaranWhere = { id_santri: { in: anggotaIds } };

                // Filter by type (all, asrama, sekolah)
                if (type && type !== 'all') {
                    if (type === 'asrama') {
                        prestasiPelanggaranWhere.id_basis_lokasi = 25;
                    } else if (type === 'sekolah') {
                        prestasiPelanggaranWhere.id_basis_lokasi = 26;
                    }
                }

                // Filter by category (pr for prestasi, pl for pelanggaran)
                if (cat === 'pr') {
                    prestasiPelanggaranWhere.perihal = 'prestasi';
                } else if (cat === 'pl') {
                    prestasiPelanggaranWhere.perihal = 'pelanggaran';
                }

                // Fetch prestasi/pelanggaran data
                const prestasiPelanggaranList = await prisma.data_prestasi_pelanggaran.findMany({
                    where: prestasiPelanggaranWhere,
                    include: {
                        ref_master_kategori: true
                    }
                });

                // Group prestasi/pelanggaran by student
                const prestasiPelanggaranMap = prestasiPelanggaranList.reduce((acc, item) => {
                    if (!acc[item.id_santri]) {
                        acc[item.id_santri] = [];
                    }
                    acc[item.id_santri].push({
                        id: item.id,
                        perihal: item.perihal,
                        judul: item.judul,
                        capaian: item.capaian,
                        tanggal: item.tanggal,
                        tempat: item.tempat,
                        deskripsi: item.deskripsi,
                        tipe: item.ref_master_kategori ? item.ref_master_kategori.nama : null,
                        bukti: item.bukti,
                        resolusi: item.resolusi
                    });
                    return acc;
                }, {});

                // Create student list with prestasi/pelanggaran data
                const simplifiedStudents = rombel.data_rombel_anggota
                    .filter(anggota => santriMap[anggota.id_santri])
                    .map(anggota => ({
                        id: santriMap[anggota.id_santri].id,
                        nis: santriMap[anggota.id_santri].nis,
                        nama: santriMap[anggota.id_santri].nama,
                        kelas: rombel.nama,
                        prestasi_pelanggaran: prestasiPelanggaranMap[anggota.id_santri] || []
                    }));

                santriData.push({
                    class_id: rombel.id,
                    class: rombel.ref_kelas.kelas,
                    students: simplifiedStudents
                });
            }

            // Format final response
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
            next(error);
        }
    };

    static getPrestasiPelanggaranBySantri = async (req, res, next) => {
        try {
            const { id_santri } = req.params;
            const { type, cat } = req.query;
            const { semester, tahunAjaran } = await getTokenPayload(req);

            const santri = await prisma.santri.findUnique({
                where: { id: parseInt(id_santri) },
                include: {
                    data_rombel_anggota: {
                        where: {
                            data_rombel: {
                                id_tahun_ajaran: tahunAjaran.id,
                            },
                        },
                        include: {
                            data_rombel: {
                                include: {
                                    ref_kelas: true,
                                },
                            },
                        },
                    },
                },
            });

            if (!santri) {
                return res.status(404).json({ message: "Santri tidak ditemukan" });
            }

            const prestasiPelanggaranWhere = {
                id_santri: parseInt(id_santri),
            };

            // Filter berdasarkan lokasi (asrama/sekolah)
            if (type && type !== "all") {
                if (type === "asrama") {
                    prestasiPelanggaranWhere.id_basis_lokasi = 25;
                } else if (type === "sekolah") {
                    prestasiPelanggaranWhere.id_basis_lokasi = 26;
                }
            }

            // Filter berdasarkan kategori (prestasi/pelanggaran)
            if (cat === "pr") {
                prestasiPelanggaranWhere.perihal = "prestasi";
            } else if (cat === "pl") {
                prestasiPelanggaranWhere.perihal = "pelanggaran";
            }

            const prestasiPelanggaranList = await prisma.data_prestasi_pelanggaran.findMany({
                where: prestasiPelanggaranWhere,
                include: {
                    ref_master_kategori: true,
                },
            });

            // Format list jadi lebih simpel
            const formattedList = prestasiPelanggaranList.map((item) => ({
                id: item.id,
                perihal: item.perihal,
                judul: item.judul,
                capaian: item.capaian,
                tanggal: item.tanggal,
                tempat: item.tempat,
                deskripsi: item.deskripsi,
                tipe: item.ref_master_kategori?.nama || null,
                bukti: item.bukti,
                resolusi: item.resolusi,
                jenis_pelanggaran: item.jenis_pelanggaran,
            }));

            const result = {
                id: santri.id,
                nis: santri.nis,
                nama: santri.nama,
                kelas: santri.data_rombel_anggota?.[0]?.data_rombel?.ref_kelas?.kelas || "-",
                prestasi_pelanggaran: formattedList,
            };

            res.status(200).json(result);
        } catch (error) {
            console.error(error);
            next(error);
        }
    };


    static getPrestasiSantri = async (req, res, next) => {
        try {
            const { id_santri } = req.params; // Mengambil id_santri dari parameter URL
            const { type, cat } = req.query; // Mengambil filter type dan category dari query
            const { decoded, semester, tahunAjaran } = await getTokenPayload(req);

            // Validasi id_santri
            if (!id_santri) {
                return res.status(400).json({ message: "ID santri diperlukan" });
            }

            // Fetch data santri
            const santri = await prisma.santri.findUnique({
                where: { id: parseInt(id_santri) },
                select: { id: true, nis: true, nama: true }
            });

            if (!santri) {
                return res.status(404).json({ message: "Santri tidak ditemukan" });
            }

            // Build where clause untuk prestasi/pelanggaran
            const prestasiPelanggaranWhere = {
                id_santri: parseInt(id_santri),
                id_tahun_ajaran: tahunAjaran.id
            };

            // Filter berdasarkan type (all, asrama, sekolah)
            if (type && type !== 'all') {
                if (type === 'asrama') {
                    prestasiPelanggaranWhere.id_basis_lokasi = 25;
                } else if (type === 'sekolah') {
                    prestasiPelanggaranWhere.id_basis_lokasi = 26;
                }
            }

            // Filter berdasarkan category (prestasi atau pelanggaran)
            if (cat === 'pr') {
                prestasiPelanggaranWhere.perihal = 'prestasi';
            } else if (cat === 'pl') {
                prestasiPelanggaranWhere.perihal = 'pelanggaran';
            }

            // Fetch data prestasi/pelanggaran
            const prestasiPelanggaranList = await prisma.data_prestasi_pelanggaran.findMany({
                where: prestasiPelanggaranWhere,
                include: {
                    ref_master_kategori: true
                },
                orderBy: {
                    tanggal: 'desc' // Urutkan berdasarkan tanggal terbaru
                }
            });

            // Format data prestasi/pelanggaran
            const formattedPrestasiPelanggaran = prestasiPelanggaranList.map(item => ({
                id: item.id,
                perihal: item.perihal,
                judul: item.judul,
                capaian: item.capaian,
                tanggal: item.tanggal,
                tempat: item.tempat,
                deskripsi: item.deskripsi,
                tipe: item.ref_master_kategori ? item.ref_master_kategori.nama : null,
                bukti: item.bukti,
                resolusi: item.resolusi
            }));

            // Format response
            const response = {
                id: santri.id,
                nis: santri.nis,
                nama: santri.nama,
                prestasi_pelanggaran: formattedPrestasiPelanggaran
            };

            return res.status(200).json(response);
        } catch (error) {
            next(error);
        }
    };

    static getPrestasiPelanggaranById = async (req, res, next) => {
        try {
            const { id } = req.params;

            // Validasi ID
            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({
                    status: 'error',
                    message: 'ID prestasi/pelanggaran tidak valid',
                });
            }

            // Ambil data prestasi/pelanggaran berdasarkan ID
            const prestasiPelanggaran = await prisma.data_prestasi_pelanggaran.findUnique({
                where: { id: parseInt(id) },
                include: {
                    ref_master_kategori: true,
                    santri: {
                        select: { id: true, nis: true, nama: true },
                    },
                },
            });

            if (!prestasiPelanggaran) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Prestasi/Pelanggaran tidak ditemukan',
                });
            }

            // Format respons
            const formattedData = {
                id: prestasiPelanggaran.id,
                nis: prestasiPelanggaran.santri.nis,
                nama: prestasiPelanggaran.santri.nama,
                id_santri: prestasiPelanggaran.santri.id,
                perihal: prestasiPelanggaran.perihal,
                judul: prestasiPelanggaran.judul,
                capaian: prestasiPelanggaran.capaian,
                tanggal: prestasiPelanggaran.tanggal,
                tempat: prestasiPelanggaran.tempat,
                deskripsi: prestasiPelanggaran.deskripsi,
                tipe: prestasiPelanggaran.ref_master_kategori ? prestasiPelanggaran.ref_master_kategori.nama : null,
                bukti: prestasiPelanggaran.bukti,
                resolusi: prestasiPelanggaran.resolusi,
                id_basis_lokasi: prestasiPelanggaran.id_basis_lokasi,
                tipe_pelanggaran: prestasiPelanggaran.tipe_pelanggaran || null,
            };

            return res.status(200).json(formattedData);
        } catch (error) {
            console.error('Error fetching prestasi/pelanggaran:', error);
            next(error);
        }
    };

    static updatePrestasiPelanggaran = async (req, res, next) => {
        try {
            const { id } = req.params;
            const data = JSON.parse(req.body.data || '{}');
            const {
                id_santri,
                perihal,
                judul,
                capaian,
                tanggal,
                tempat,
                deskripsi,
                resolusi,
                id_basis_lokasi,
                tipe_pelanggaran,
            } = data;
            const file_bukti = req.files || [];

            // Validasi ID
            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({
                    status: 'error',
                    message: 'ID prestasi/pelanggaran tidak valid',
                });
            }

            // Cek apakah record ada
            const existingRecord = await prisma.data_prestasi_pelanggaran.findUnique({
                where: { id: parseInt(id) },
            });

            if (!existingRecord) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Prestasi/Pelanggaran tidak ditemukan',
                });
            }

            // Validasi input jika diberikan
            if (id_santri && !Number.isInteger(id_santri)) {
                return res.status(400).json({
                    status: 'error',
                    message: 'ID santri tidak valid',
                });
            }

            if (perihal && !['prestasi', 'pelanggaran'].includes(perihal)) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Perihal harus prestasi atau pelanggaran',
                });
            }

            if (perihal === 'pelanggaran' && tipe_pelanggaran && !['Sekolah', 'Asrama'].includes(tipe_pelanggaran)) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Tipe pelanggaran harus Sekolah atau Asrama',
                });
            }

            if (id_basis_lokasi && ![25, 26].includes(parseInt(id_basis_lokasi))) {
                return res.status(400).json({
                    status: 'error',
                    message: 'ID basis lokasi tidak valid (harus 25 untuk Asrama atau 26 untuk Sekolah)',
                });
            }

            // Proses file bukti jika ada
            let file_bukti_list = existingRecord.bukti ? existingRecord.bukti.split(',') : [];
            if (file_bukti.length > 0) {
                const newFiles = file_bukti.map((file) =>
                    `/uploads/bukti-prpl/${existingRecord.perihal === 'prestasi' ? 'prestasi' : 'pelanggaran'}/${file.filename}`
                );
                file_bukti_list = [...file_bukti_list, ...newFiles];
                console.log(file_bukti_list);
            }

            // Siapkan data untuk update
            const updateData = {
                id_santri: id_santri ? parseInt(id_santri) : undefined,
                perihal: perihal || undefined,
                judul: judul || undefined,
                capaian: capaian || undefined,
                tanggal: tanggal ? new Date(tanggal) : undefined,
                tempat: tempat || undefined,
                deskripsi: deskripsi || undefined,
                bukti: file_bukti_list.length > 0 ? file_bukti_list.toString() : undefined,
                resolusi: resolusi || undefined,
                id_basis_lokasi: id_basis_lokasi ? parseInt(id_basis_lokasi) : undefined,
                tipe_pelanggaran: perihal === 'pelanggaran' && tipe_pelanggaran ? tipe_pelanggaran : undefined,
            };

            // Update record
            const updatedRecord = await prisma.data_prestasi_pelanggaran.update({
                where: { id: parseInt(id) },
                data: updateData,
                include: {
                    ref_master_kategori: true,
                },
            });

            // Format respons
            const formattedData = {
                id: updatedRecord.id,
                id_santri: updatedRecord.id_santri,
                perihal: updatedRecord.perihal,
                judul: updatedRecord.judul,
                capaian: updatedRecord.capaian,
                tanggal: updatedRecord.tanggal,
                tempat: updatedRecord.tempat,
                deskripsi: updatedRecord.deskripsi,
                tipe: updatedRecord.ref_master_kategori ? updatedRecord.ref_master_kategori.nama : null,
                bukti: updatedRecord.bukti,
                resolusi: updatedRecord.resolusi,
                id_basis_lokasi: updatedRecord.id_basis_lokasi,
                tipe_pelanggaran: updatedRecord.tipe_pelanggaran || null,
            };

            return res.status(200).json({
                status: 'success',
                message: 'Prestasi/Pelanggaran berhasil diperbarui',
                data: formattedData,
            });
        } catch (error) {
            console.log(error);
            next(error);
        }
    };

    static deletePrestasiPelanggaran = async (req, res) => {
        try {
            const { id, idkur } = req.params;

            // Check if mapel exists
            const existingMapel = await prisma.ref_mapel.findFirst({
                where: {
                    id: parseInt(id),
                    id_kurikulum: parseInt(idkur)
                }
            });

            if (!existingMapel) {
                return res.status(404).json({
                    success: false,
                    message: "Subject not found"
                });
            }

            await prisma.ref_mapel.delete({
                where: { id: parseInt(id) }
            });

            res.json({
                success: true,
                message: "Subject deleted successfully"
            });
        } catch (error) {
            console.error("Error deleting mapel:", error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    };

    static printPrestasiPelanggaran = async (req, res, next) => {
        try {
            const { decoded, semester, tahunAjaran } = await getTokenPayload(req);
            const { month } = req.query; // month diharapkan dalam format angka (1-12)
            const id_tahun_ajaran = tahunAjaran.id;

            const tahunAjaranData = await prisma.ref_tahun_ajaran.findFirst({
                where: {
                    id: parseInt(id_tahun_ajaran)
                }
            });

            // Build rombel where clause
            const rombelWhereClause = { id_tahun_ajaran: parseInt(id_tahun_ajaran) };

            // Fetch rombel data with members
            const rombels = await prisma.data_rombel.findMany({
                where: rombelWhereClause,
                include: {
                    data_rombel_anggota: {
                        select: { id_santri: true },
                    },
                    ref_kelas: true,
                },
            });

            if (rombels.length === 0) {
                return res.status(200).json({ message: "Tidak ada data rombel untuk tahun ajaran ini" });
            }

            let santriData = [];

            for (const rombel of rombels) {
                const anggotaIds = rombel.data_rombel_anggota.map((anggota) => anggota.id_santri);

                // Fetch santri data
                const santriList = await prisma.santri.findMany({
                    where: { id: { in: anggotaIds } },
                    select: { id: true, nis: true, nama: true },
                });

                // Create santri map
                const santriMap = santriList.reduce((acc, santri) => {
                    acc[santri.id] = santri;
                    return acc;
                }, {});

                // Build prestasi where clause (only prestasi)
                let prestasiWhere = {
                    id_santri: { in: anggotaIds },
                    perihal: "prestasi",
                };

                // Fetch prestasi data
                const prestasiList = await prisma.data_prestasi_pelanggaran.findMany({
                    where: prestasiWhere,
                    include: {
                        ref_master_kategori: true,
                    },
                });

                // Filter prestasi by month if provided
                let filteredPrestasiList = prestasiList;
                if (month) {
                    const monthNum = parseInt(month);
                    if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
                        filteredPrestasiList = prestasiList.filter((item) => {
                            if (item.tanggal) {
                                // Asumsi tanggal disimpan dalam format Date atau string "DD-MM-YYYY"
                                const date = new Date(item.tanggal);
                                return date.getMonth() + 1 === monthNum; // getMonth() mengembalikan 0-11, jadi tambah 1
                            }
                            return false;
                        });
                    } else {
                        console.warn("Invalid month provided:", month);
                    }
                }

                // Group prestasi by student
                const prestasiMap = filteredPrestasiList.reduce((acc, item) => {
                    if (!acc[item.id_santri]) {
                        acc[item.id_santri] = [];
                    }
                    acc[item.id_santri].push({
                        perihal: item.perihal || "-",
                        judul: item.judul || "-",
                        capaian: item.capaian || "-",
                        tanggal: item.tanggal ? new Date(item.tanggal).toLocaleDateString("id-ID") : "-",
                        tempat: item.tempat || "-",
                        deskripsi: item.deskripsi || "-",
                        kategori: item.ref_master_kategori?.nama || "-",
                        bukti: item.bukti || "-",
                        resolusi: item.resolusi || "-",
                    });
                    return acc;
                }, {});

                // Create student list with prestasi data, only include students with prestasi
                const simplifiedStudents = rombel.data_rombel_anggota
                    .filter((anggota) => santriMap[anggota.id_santri] && prestasiMap[anggota.id_santri])
                    .map((anggota) => ({
                        nis: santriMap[anggota.id_santri].nis || "-",
                        nama: santriMap[anggota.id_santri].nama || "-",
                        kelas: rombel.ref_kelas?.kelas || "-",
                        prestasi: prestasiMap[anggota.id_santri] || [],
                    }));

                santriData.push({
                    class_id: rombel.id,
                    class: rombel.ref_kelas?.kelas || "-",
                    students: simplifiedStudents,
                });
            }

            const mapBulan = {
                1: "Januari",
                2: "Februari",
                3: "Maret",
                4: "April",
                5: "Mei",
                6: "Juni",
                7: "Juli",
                8: "Agustus",
                9: "September",
                10: "Oktober",
                11: "November",
                12: "Desember"
            };

            // Prepare data for PDF
            const pdfData = {
                tahun_ajaran: tahunAjaranData.nama,
                bulan: month ? "BULAN " + mapBulan[month].toUpperCase() : "",
                classes: santriData.map((rombel) => ({
                    class_id: rombel.class_id,
                    class_name: rombel.class,
                    students: rombel.students,
                })),
            };

            // Define template path and PDF settings
            const templatePath = path.join(__dirname, "../../public/pdf_template/daftar_prestasi_pelanggaran.ejs");
            const orientation = "Landscape";
            const filename = `Daftar_Prestasi_${tahunAjaranData.nama}.pdf`;

            console.log(JSON.stringify(pdfData, null, 2));

            // Generate and stream PDF
            await printPdf(res, pdfData, templatePath, orientation, filename);
        } catch (error) {
            console.error("Error generating PDF:", error);
            next(error);
        }
    };
}