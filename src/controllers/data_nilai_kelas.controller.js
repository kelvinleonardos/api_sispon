import { prisma } from "../prisma.js"
import {getTokenPayload} from "../helpers.js";
import {extractExcelData, writeExcelFileNilaiKelas, writeExcelFilewithSubheader2} from "../services/export.service.js";

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

    static async getALLDataNilaiKelas(req, res, next) {
        try {
            const { decoded, semester, tahunAjaran } = await getTokenPayload(req);
            const { id_mapel } = req.params;
            const { class: className, bulan, pekan } = req.query;

            // Validate bulan (month)
            let bulanFilter = null;
            if (bulan) {
                if (isNaN(parseInt(bulan)) || parseInt(bulan) < 1 || parseInt(bulan) > 12) {
                    return res.status(400).json({ message: 'Bulan harus berupa angka antara 1 dan 12' });
                }
                bulanFilter = parseInt(bulan);
            }

            // Validate pekan (week)
            let pekanFilter = null;
            if (pekan) {
                if (isNaN(parseInt(pekan)) || parseInt(pekan) < 1) {
                    return res.status(400).json({ message: 'Pekan harus berupa angka positif' });
                }
                pekanFilter = parseInt(pekan);
            }

            // Ambil ref_kelas jika className diberikan
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
            const rombelWhereClause = {
                id_tahun_ajaran: tahunAjaran.id,
            };
            if (ref_kelas) {
                rombelWhereClause.id_kelas = ref_kelas.id;
            }

            // Ambil semua rombel yang sesuai
            const rombels = await prisma.data_rombel.findMany({
                where: rombelWhereClause,
                include: {
                    ref_kelas: {
                        include: {
                            ref_tingkat: true,
                        },
                    },
                    data_rombel_anggota: {
                        include: {
                            santri: true,
                        },
                    },
                    data_kelas: {
                        where: {
                            AND: [
                                { id_semester: parseInt(semester.id) },
                                { id_mapel: parseInt(id_mapel) },
                            ],
                        },
                        include: {
                            ref_mapel: {
                                include: {
                                    guru_pegawai: true,
                                    data_kkm_detail: true,
                                    data_kompetensi_inti: {
                                        include: {
                                            data_kompetensi_dasar: true,
                                            ref_tingkat: true,
                                        },
                                    },
                                },
                            },
                            data_rencana_penilaian: {
                                where: {
                                    AND: [
                                        bulanFilter ? { bulan: bulanFilter } : {},
                                        pekanFilter ? { pekan: pekanFilter } : {},
                                    ],
                                },
                                include: {
                                    ref_komponen_nilai: true,
                                    data_kompetensi_dasar: {
                                        include: {
                                            data_kompetensi_inti: {
                                                include: {
                                                    ref_tingkat: true,
                                                },
                                            },
                                        },
                                    },
                                    data_nilai_kelas: {
                                        include: {
                                            santri: true,
                                        },
                                    },
                                },
                                orderBy: {
                                    urutan: "asc",
                                },
                            },
                        },
                    },
                },
            });

            if (!rombels.length) {
                return res.status(404).json({ message: 'Tidak ada rombel yang ditemukan' });
            }

            // Format data untuk setiap rombel
            const result = rombels.map(rombel => {
                const mapelDetails = rombel.data_kelas.reduce((acc, kelas) => {
                    const mapelId = kelas.ref_mapel.id;
                    const jenisNilai = kelas.ref_mapel.jenis_nilai;
                    const kelasId = kelas.id;
                    const mapelNama = kelas.ref_mapel.nama;
                    const guruNama = kelas.ref_mapel.guru_pegawai?.nama_gp || '-';
                    const tingkatId = rombel.ref_kelas?.ref_tingkat?.id;

                    let kkm = 'N/A';
                    if (kelas.ref_mapel.data_kkm_detail && kelas.ref_mapel.data_kkm_detail.length > 0) {
                        const kkmDetail = kelas.ref_mapel.data_kkm_detail.find(
                            detail => detail.tingkat_id === tingkatId && detail.mapel_id === mapelId
                        );
                        kkm = kkmDetail?.kkm || 'N/A';
                    }

                    let mapelEntry = acc.find(entry => entry.id_mapel === mapelId);
                    if (!mapelEntry) {
                        mapelEntry = {
                            id_kelas: kelasId,
                            id_mapel: mapelId,
                            jenis_nilai: jenisNilai,
                            nama_guru: guruNama,
                            kkm: kkm,
                            mata_pelajaran: mapelNama,
                            is_locked: kelas.is_locked || false,
                            rencana_penilaian_nilai: [],
                            data_nilai: [],
                        };
                        acc.push(mapelEntry);
                    }

                    const mapBulan = {
                        1: 'Januari', 2: 'Februari', 3: 'Maret', 4: 'April', 5: 'Mei', 6: 'Juni',
                        7: 'Juli', 8: 'Agustus', 9: 'September', 10: 'Oktober', 11: 'November', 12: 'Desember',
                    };

                    kelas.data_rencana_penilaian.forEach(penilaian => {
                        const ki = penilaian.data_kompetensi_dasar?.data_kompetensi_inti;
                        mapelEntry.rencana_penilaian_nilai.push({
                            id: penilaian.id,
                            nama: penilaian.nama,
                            waktu: `${mapBulan[penilaian.bulan]}, Pekan ${penilaian.pekan}, Hari ${penilaian.hari}`,
                            kode_ki: ki?.kode_ki || '-',
                            deskripsi_ki: ki?.deskripsi || '-',
                            bulan: ki?.bulan,
                            pekan: ki?.pekan,
                            hari: ki?.hari,
                            kode_kd: penilaian.data_kompetensi_dasar?.kode_kd || '-',
                            deskripsi_kd: penilaian.data_kompetensi_dasar?.deskripsi || '-',
                            id_komponen: penilaian.id_komponen,
                            bobot: `${penilaian.bobot}%`,
                        });
                    });

                    const siswaNilaiMap = new Map();
                    rombel.data_rombel_anggota.forEach(anggota => {
                        const siswaId = anggota.santri.id;
                        const siswaNama = anggota.santri.nama || '-';
                        const siswaNis = anggota.santri.nis || '-';
                        siswaNilaiMap.set(siswaId, {
                            nis: siswaNis,
                            id_santri: siswaId,
                            kelas: rombel.ref_kelas.kelas,
                            nama: siswaNama,
                            nilai: new Map(),
                        });
                    });

                    kelas.data_rencana_penilaian.forEach(penilaian => {
                        siswaNilaiMap.forEach(siswa => {
                            const nilaiSiswa = penilaian.data_nilai_kelas.find(nilai => nilai.id_santri === siswa.id_santri);
                            siswa.nilai.set(penilaian.id, {
                                id_rencana_penilaian: penilaian.id,
                                nama_rencana: penilaian.nama,
                                nilai: nilaiSiswa ? nilaiSiswa.nilai || null : null,
                            });
                        });
                    });

                    mapelEntry.data_nilai = Array.from(siswaNilaiMap.values()).map(siswa => ({
                        nis: siswa.nis,
                        id_santri: siswa.id_santri,
                        nama: siswa.nama,
                        kelas: siswa.kelas,
                        nilai: Array.from(siswa.nilai.values()),
                    }));

                    return acc;
                }, []);

                return {
                    id_rombel: rombel.id,
                    kelas: rombel.ref_kelas.kelas,
                    mapel: mapelDetails[0] || null,
                };
            });

            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    }

    static async generateNilaiExcel(req, res, next) {
        try {
            const { decoded, semester, tahunAjaran } = await getTokenPayload(req);
            const { id_rombel, id_mapel } = req.params;
            const { bulan, pekan } = req.query;

            // Validate bulan (month)
            let bulanFilter = null;
            if (bulan) {
                if (isNaN(parseInt(bulan)) || parseInt(bulan) < 1 || parseInt(bulan) > 12) {
                    return res.status(400).json({ message: 'Bulan harus berupa angka antara 1 dan 12' });
                }
                bulanFilter = parseInt(bulan);
            }

            // Validate pekan (week)
            let pekanFilter = null;
            if (pekan) {
                if (isNaN(parseInt(pekan)) || parseInt(pekan) < 1) {
                    return res.status(400).json({ message: 'Pekan harus berupa angka positif' });
                }
                pekanFilter = parseInt(pekan);
            }

            const rombel = await prisma.data_rombel.findUnique({
                where: { id: parseInt(id_rombel) },
                include: {
                    ref_kelas: {
                        include: {
                            ref_tingkat: true
                        },
                    },
                    data_rombel_anggota: {
                        include: {
                            santri: true,
                        },
                    },
                    data_kelas: {
                        where: {
                            AND: [
                                { id_semester: parseInt(semester.id) },
                                { id_mapel: parseInt(id_mapel) },
                            ],
                        },
                        include: {
                            ref_mapel: {
                                include: {
                                    guru_pegawai: true,
                                    data_kkm_detail: true,
                                    data_kompetensi_inti: {
                                        include: {
                                            data_kompetensi_dasar: true,
                                            ref_tingkat: true
                                        }
                                    }
                                },
                            },
                            data_rencana_penilaian: {
                                where: {
                                    AND: [
                                        bulanFilter ? { bulan: bulanFilter } : {},
                                        pekanFilter ? { pekan: pekanFilter } : {},
                                    ],
                                },
                                include: {
                                    ref_komponen_nilai: true,
                                    data_kompetensi_dasar: {
                                        include: {
                                            data_kompetensi_inti: {
                                                include: {
                                                    ref_tingkat: true
                                                }
                                            }
                                        }
                                    },
                                    data_nilai_kelas: {
                                        include: {
                                            santri: true,
                                        },
                                    },
                                },
                                orderBy: {
                                    urutan: "asc",
                                },
                            },
                        },
                    },
                },
            });

            if (!rombel) {
                return res.status(404).json({ message: 'Rombel tidak ditemukan' });
            }

            // Format data guru mapel, rencana penilaian, dan nilai siswa
            const mapelDetails = rombel.data_kelas.reduce((acc, kelas) => {
                const mapelId = kelas.ref_mapel.id;
                const jenisNilai = kelas.ref_mapel.jenis_nilai;
                const kelasId = kelas.id;
                const mapelNama = kelas.ref_mapel.nama;
                const guruNama = kelas.ref_mapel.guru_pegawai?.nama_gp || '-';
                const tingkatId = rombel.ref_kelas?.ref_tingkat?.id;

                let kkm = 'N/A';
                if (kelas.ref_mapel.data_kkm_detail && kelas.ref_mapel.data_kkm_detail.length > 0) {
                    const kkmDetail = kelas.ref_mapel.data_kkm_detail.find(
                        detail => detail.tingkat_id === tingkatId && detail.mapel_id === mapelId
                    );
                    kkm = kkmDetail?.kkm || 'N/A';
                }

                let mapelEntry = acc.find(entry => entry.id_mapel === mapelId);
                if (!mapelEntry) {
                    mapelEntry = {
                        id_kelas: kelasId,
                        id_mapel: mapelId,
                        jenis_nilai: jenisNilai,
                        nama_guru: guruNama,
                        kkm: kkm,
                        mata_pelajaran: mapelNama,
                        is_locked: kelas.is_locked || false,
                        rencana_penilaian_nilai: [],
                        data_nilai: [],
                    };
                    acc.push(mapelEntry);
                }

                const mapBulan = {
                    1: 'Januari', 2: 'Februari', 3: 'Maret', 4: 'April', 5: 'Mei', 6: 'Juni',
                    7: 'Juli', 8: 'Agustus', 9: 'September', 10: 'Oktober', 11: 'November', 12: 'Desember'
                };

                kelas.data_rencana_penilaian.forEach(penilaian => {
                    const ki = penilaian.data_kompetensi_dasar?.data_kompetensi_inti;
                    mapelEntry.rencana_penilaian_nilai.push({
                        id: penilaian.id,
                        nama: penilaian.nama,
                        waktu: `${mapBulan[penilaian.bulan]}, Pekan ${penilaian.pekan}, Hari ${penilaian.hari}`,
                        kode_ki: ki?.kode_ki || '-',
                        deskripsi_ki: ki?.deskripsi || '-',
                        bulan: ki?.bulan,
                        pekan: ki?.pekan,
                        hari: ki?.hari,
                        kode_kd: penilaian.data_kompetensi_dasar?.kode_kd || '-',
                        deskripsi_kd: penilaian.data_kompetensi_dasar?.deskripsi || '-',
                        id_komponen: penilaian.id_komponen,
                        bobot: `${penilaian.bobot}%`,
                    });
                });

                const siswaNilaiMap = new Map();
                rombel.data_rombel_anggota.forEach(anggota => {
                    const siswaId = anggota.santri.id;
                    const siswaNama = anggota.santri.nama || '-';
                    const siswaNis = anggota.santri.nis || '-';
                    siswaNilaiMap.set(siswaId, {
                        nis: siswaNis,
                        id_santri: siswaId,
                        nama: siswaNama,
                        nilai: new Map()
                    });
                });

                kelas.data_rencana_penilaian.forEach(penilaian => {
                    siswaNilaiMap.forEach(siswa => {
                        const nilaiSiswa = penilaian.data_nilai_kelas.find(nilai => nilai.id_santri === siswa.id_santri);
                        siswa.nilai.set(penilaian.id, {
                            id_rencana_penilaian: penilaian.id,
                            nama_rencana: penilaian.nama,
                            nilai: nilaiSiswa ? nilaiSiswa.nilai || null : null
                        });
                    });
                });

                mapelEntry.data_nilai = Array.from(siswaNilaiMap.values()).map(siswa => ({
                    nis: siswa.nis,
                    id_santri: siswa.id_santri,
                    nama: siswa.nama,
                    nilai: Array.from(siswa.nilai.values())
                }));

                return acc;
            }, []);

            const mapelData = mapelDetails[0];
            const header = {
                "Penilaian": {
                    items: mapelData.rencana_penilaian_nilai.map(penilaian => ({
                        id: penilaian.id,
                        nama: penilaian.nama,
                        bobot: penilaian.bobot,
                        kode: `#${penilaian.id}`,
                    }))
                }
            };
            console.log(header);

            const data = mapelData.data_nilai.map(santri => {
                const rowData = {
                    nis: santri.nis,
                    nama: `${santri.nama} - #${santri.id_santri}`,
                };
                santri.nilai.forEach(nilai => {
                    rowData[nilai.nama_rencana] = nilai.nilai || "";
                });
                return rowData;
            });

            const fileName = `Nilai_${mapelData.mata_pelajaran}_${semester.id}`;

            // Panggil fungsi writeExcelFilewithSubheader2
            await writeExcelFileNilaiKelas(res, header, data, fileName);

        } catch (error) {
            next(error);
        }
    }

    static async batchNilaiExcelKelas(req, res, next) {
        try {
            const { id_rombel, id_mapel } = req.params;

            // Validasi parameter
            if (!id_rombel || !id_mapel) {
                return res.status(400).json({ message: 'id_rombel dan id_mapel wajib diisi' });
            }

            // Pastikan file Excel diunggah
            if (!req.file) {
                return res.status(400).json({ message: 'File Excel wajib diunggah' });
            }

            // Ekstrak data dari file Excel
            const extractedData = await extractExcelData(req);

            if (!extractedData.length) {
                return res.status(400).json({ message: 'Tidak ada data valid dalam file Excel' });
            }

            const results = {
                successful: [],
                errors: [],
                totalProcessed: extractedData.length,
            };

            // Ambil informasi mapel termasuk jenis_nilai
            const mapel = await prisma.ref_mapel.findUnique({
                where: { id: parseInt(id_mapel) },
            });

            if (!mapel) {
                return res.status(404).json({ message: 'Mata pelajaran tidak ditemukan' });
            }

            const jenisNilai = mapel.jenis_nilai;

            // Ambil daftar rencana penilaian berdasarkan id_rombel dan id_mapel
            const rombel = await prisma.data_rombel.findUnique({
                where: { id: parseInt(id_rombel) },
                include: {
                    ref_kelas: true,
                    data_kelas: {
                        where: {
                            id_mapel: parseInt(id_mapel),
                        },
                        include: {
                            data_rencana_penilaian: true,
                        },
                    },
                },
            });

            if (!rombel) {
                return res.status(404).json({ message: 'Rombel tidak ditemukan' });
            }

            const rencanaPenilaianList = rombel.data_kelas.flatMap(kelas => kelas.data_rencana_penilaian);
            const rencanaMap = new Map();
            rencanaPenilaianList.forEach(rencana => {
                rencanaMap.set(rencana.id.toString(), rencana);
            });

            // Proses setiap baris data dari Excel
            for (const [index, row] of extractedData.entries()) {
                const rowNumber = index + 2; // Baris dimulai dari 2 (1 untuk header)
                const { nis, nama, ...nilaiData } = row;
                let rowHasError = false;

                // Validasi NIS
                if (!nis) {
                    results.errors.push({
                        row: rowNumber,
                        error: `Baris dengan nama ${nama || 'tidak diketahui'}: NIS wajib diisi`,
                    });
                    continue;
                }

                // Ekstrak id_santri dari nama (format: "Nama - #id_santri")
                const idSantriMatch = nama.match(/#(\d+)$/);
                const id_santri = idSantriMatch ? parseInt(idSantriMatch[1]) : null;

                if (!id_santri) {
                    results.errors.push({
                        row: rowNumber,
                        error: `Baris dengan nama ${nama || 'tidak diketahui'}: Format nama tidak valid, harus berisi '#id_santri' (misalnya, 'Nama - #1')`,
                    });
                    continue;
                }

                // Cari santri berdasarkan id_santri
                const santri = await prisma.santri.findUnique({
                    where: { id: id_santri },
                });

                if (!santri) {
                    results.errors.push({
                        row: rowNumber,
                        error: `Baris dengan NIS ${nis} dan id_santri ${id_santri}: Santri tidak ditemukan`,
                    });
                    continue;
                }

                // Validasi bahwa santri termasuk dalam rombel yang sesuai
                const rombelAnggota = await prisma.data_rombel_anggota.findFirst({
                    where: {
                        id_santri: santri.id,
                        id_rombel: parseInt(id_rombel),
                    },
                });

                if (!rombelAnggota) {
                    results.errors.push({
                        row: rowNumber,
                        error: `Baris dengan NIS ${nis} dan id_santri ${id_santri}: Santri tidak terdaftar di rombel ${id_rombel}`,
                    });
                    continue;
                }

                // Proses setiap kolom nilai (rencana penilaian)
                for (const [namaRencana, nilai] of Object.entries(nilaiData)) {
                    console.log(`Memproses NIS: ${nis}, Nama: ${nama}, Rencana: ${namaRencana}, Nilai: ${nilai}`);
                    // Ekstrak id_rencana dari nama
                    const idRencanaMatch = namaRencana.match(/#(\d+)$/);
                    const id_rencana = idRencanaMatch ? parseInt(idRencanaMatch[1]) : null;

                    if (!id_rencana) {
                        results.errors.push({
                            row: rowNumber,
                            error: `Baris dengan NIS ${nis}: Format nama rencana "${namaRencana}" tidak valid, harus berisi '#id' (misalnya, '#15')`,
                        });
                        rowHasError = true;
                        continue;
                    }

                    // Cari rencana penilaian berdasarkan id
                    const rencanaPenilaian = rencanaMap.get(id_rencana.toString());
                    if (!rencanaPenilaian) {
                        results.errors.push({
                            row: rowNumber,
                            error: `Baris dengan NIS ${nis}: Rencana penilaian dengan id ${id_rencana} tidak ditemukan untuk rombel ${id_rombel} dan mapel ${id_mapel}`,
                        });
                        rowHasError = true;
                        continue;
                    }

                    // Validasi nilai berdasarkan jenis_nilai
                    if (nilai !== '' && nilai !== null) {
                        if (jenisNilai === 'Angka') {
                            if (isNaN(parseFloat(nilai))) {
                                results.errors.push({
                                    row: rowNumber,
                                    error: `Baris dengan NIS ${nis}: Nilai untuk "${namaRencana}" harus berupa angka karena jenis nilai adalah Angka`,
                                });
                                rowHasError = true;
                                continue;
                            }
                        } else if (jenisNilai === 'Huruf') {
                            const validHuruf = /^[A-Z]$/;
                            if (!validHuruf.test(nilai.toString().toUpperCase())) {
                                results.errors.push({
                                    row: rowNumber,
                                    error: `Baris dengan NIS ${nis}: Nilai untuk "${namaRencana}" harus berupa huruf kapital (A-Z) karena jenis nilai adalah Huruf`,
                                });
                                rowHasError = true;
                                continue;
                            }
                        }
                    }

                    // Cek apakah data nilai kelas sudah ada
                    const existingNilaiKelas = await prisma.data_nilai_kelas.findFirst({
                        where: {
                            id_rencana: rencanaPenilaian.id,
                            id_santri: santri.id,
                        },
                    });

                    const keterangan = null; // Sesuaikan jika keterangan ada di Excel

                    try {
                        let nilaiKelas;
                        if (existingNilaiKelas) {
                            // Update jika sudah ada
                            nilaiKelas = await prisma.data_nilai_kelas.update({
                                where: { id: existingNilaiKelas.id },
                                data: {
                                    nilai: nilai !== '' && nilai !== null
                                        ? (jenisNilai === 'Huruf' ? nilai.toString().toUpperCase() : nilai.toString())
                                        : existingNilaiKelas.nilai,
                                    keterangan: keterangan !== undefined ? keterangan : existingNilaiKelas.keterangan,
                                },
                            });
                        } else {
                            // Buat baru jika belum ada
                            nilaiKelas = await prisma.data_nilai_kelas.create({
                                data: {
                                    id_rencana: rencanaPenilaian.id,
                                    id_santri: santri.id,
                                    nilai: nilai !== '' && nilai !== null
                                        ? (jenisNilai === 'Huruf' ? nilai.toString().toUpperCase() : nilai.toString())
                                        : null,
                                    keterangan: keterangan || null,
                                },
                            });
                        }
                    } catch (e) {
                        results.errors.push({
                            row: rowNumber,
                            error: `Baris dengan NIS ${nis}: Gagal memproses "${namaRencana}" - ${e.message}`,
                        });
                        rowHasError = true;
                    }
                }

                // Tambahkan ke successful jika tidak ada error untuk baris ini
                if (!rowHasError) {
                    results.successful.push({
                        row: rowNumber,
                        id: santri.id,
                        nama: santri.nama,
                    });
                }
            }

            // Kirim respons dengan hasil dan error
            return res.status(201).json({
                message: 'Proses import selesai',
                totalProcessed: results.totalProcessed,
                successfulCount: results.successful.length,
                errorCount: results.errors.length,
                successful: results.successful,
                errors: results.errors,
            });
        } catch (e) {
            next(e);
        }
    }


}