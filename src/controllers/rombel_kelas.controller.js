import { prisma } from '../prisma.js';
import { getTokenPayload } from "../helpers.js";

export class RombelKelasController {
    static async createRombelKelas(req, res, next) {
        try {
            const { rombel, mapel_list } = req.body;
            const { decoded, semester } = await getTokenPayload(req);

            // Validate input
            if (!rombel || isNaN(parseInt(rombel)) || !mapel_list || !Array.isArray(mapel_list) || mapel_list.length === 0) {
                return res.status(400).json({ message: 'rombel harus berupa ID yang valid dan mapel_list harus berupa array yang tidak kosong' });
            }

            // Verify rombel exists and belongs to the current tahun_ajaran
            const rombelData = await prisma.data_rombel.findFirst({
                where: {
                    id: parseInt(rombel),
                    id_tahun_ajaran: parseInt(semester.id_tahun_ajaran),
                },
            });

            if (!rombelData) {
                return res.status(404).json({ message: 'Rombel tidak ditemukan atau tidak sesuai dengan tahun ajaran' });
            }

            // Check for existing mapel in the current semester for the given rombel
            const existingMapelIds = await prisma.data_kelas.findMany({
                where: {
                    id_semester: parseInt(semester.id),
                    id_rombel: parseInt(rombel),
                    id_mapel: {
                        in: mapel_list.map(id => parseInt(id)),
                    },
                },
                select: {
                    id_mapel: true,
                },
            }).then(results => results.map(r => r.id_mapel));

            // Filter out mapel that already exist
            const newMapelIds = mapel_list
                .map(id => parseInt(id))
                .filter(id => !existingMapelIds.includes(id));

            if (newMapelIds.length === 0) {
                return res.status(400).json({ message: 'Semua mapel yang diberikan sudah terdaftar untuk rombel ini' });
            }

            // Verify that all mapel IDs exist in ref_mapel
            const validMapel = await prisma.ref_mapel.findMany({
                where: {
                    id: {
                        in: newMapelIds,
                    },
                },
                select: {
                    id: true,
                    nama: true,
                },
            });

            if (validMapel.length !== newMapelIds.length) {
                return res.status(400).json({ message: 'Beberapa ID mapel tidak valid' });
            }

            // Create new data_kelas entries within a transaction
            const newKelas = await prisma.$transaction(async (tx) => {
                const createdKelas = [];
                for (const mapelId of newMapelIds) {
                    const mapel = validMapel.find(m => m.id === mapelId);
                    const kelas = await tx.data_kelas.create({
                        data: {
                            id_semester: parseInt(semester.id),
                            id_mapel: mapelId,
                            id_rombel: parseInt(rombel),
                            kode_kelas: `KLS-${rombel}-${mapelId}-${semester.id}`,
                            is_locked: false,
                            tahfidz_jadwal: null,
                            tahfidz_target_juz: null,
                            id_master_kategori_status_data_kelas: 21,
                            id_master_kategori_tipe_data_kelas: null,
                        },
                    });
                    createdKelas.push(kelas);
                }
                return createdKelas;
            });

            return res.status(201).json({
                message: 'Data kelas berhasil dibuat',
                data: newKelas,
            });
        } catch (error) {
            next(error);
        }
    }

    static async getRombelDetail(req, res, next) {
        try {
            const { decoded, semester, tahunAjaran } = await getTokenPayload(req);
            const { id } = req.params;
            const { tipe, komponen, bulan, pekan, mapel } = req.query;

            // Validate tipe (category ID)
            let kategori = null;
            if (tipe) {
                if (isNaN(parseInt(tipe))) {
                    return res.status(400).json({ message: 'ID tipe kategori tidak valid' });
                }
                kategori = await prisma.ref_master_kategori.findFirst({
                    where: {
                        id: parseInt(tipe),
                        tipe: 'mapel',
                    },
                });
                if (!kategori) {
                    return res.status(404).json({ message: 'Kategori dengan ID tersebut tidak ditemukan' });
                }
            }

            // Validate komponen (component ID)
            let komponenId = null;
            if (komponen) {
                if (isNaN(parseInt(komponen))) {
                    return res.status(400).json({ message: 'ID komponen tidak valid' });
                }
                const komponenData = await prisma.ref_komponen_nilai.findUnique({
                    where: {
                        id: parseInt(komponen),
                    },
                });
                if (!komponenData) {
                    return res.status(404).json({ message: 'Komponen dengan ID tersebut tidak ditemukan' });
                }
                komponenId = parseInt(komponen);
            }

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

            // Validate mapel (subject ID)
            let mapelFilter = null;
            if (mapel) {
                if (isNaN(parseInt(mapel))) {
                    return res.status(400).json({ message: 'ID mapel tidak valid' });
                }
                const mapelData = await prisma.ref_mapel.findUnique({
                    where: {
                        id: parseInt(mapel),
                    },
                });
                if (!mapelData) {
                    return res.status(404).json({ message: 'Mapel dengan ID tersebut tidak ditemukan' });
                }
                mapelFilter = parseInt(mapel);
            }

            const rombel = await prisma.data_rombel.findUnique({
                where: { id: parseInt(id) },
                include: {
                    ref_kelas: {
                        include: {
                            ref_tingkat: {
                                include: {
                                    ref_kurikulum: true,
                                },
                            },
                        },
                    },
                    guru_pegawai: true,
                    data_rombel_anggota: {
                        include: {
                            santri: true,
                        },
                    },
                    data_kelas: {
                        where: {
                            AND: [
                                tipe ? { ref_mapel: { id_master_kategori_ref_mapel: parseInt(tipe) } } : {},
                                { id_semester: parseInt(semester.id) },
                                mapelFilter ? { id_mapel: mapelFilter } : {},
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
                                        komponenId ? { id_komponen: komponenId } : {},
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

            const all_rencana = await prisma.data_rombel.findUnique({
                where: { id: parseInt(id) },
                include: {
                    data_kelas: {
                        where: {
                            AND: [
                                tipe ? { ref_mapel: { id_master_kategori_ref_mapel: parseInt(tipe) } } : {},
                                { id_semester: parseInt(semester.id) },
                                mapelFilter ? { id_mapel: mapelFilter } : {},
                            ],
                        },
                        include: {
                            data_rencana_penilaian: {
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
                                },
                                orderBy: {
                                    urutan: "asc",
                                },
                            },
                        },
                    },
                },
            });

            // Hitung jumlah siswa
            const jumlahSiswa = rombel.data_rombel_anggota.length;

            // Hitung jumlah mapel unik berdasarkan id_mapel
            const uniqueMapel = [...new Set(rombel.data_kelas.map(kelas => kelas.id_mapel))];
            const jumlahMapel = uniqueMapel.length;

            // Hitung jumlah guru unik berdasarkan id_pengajar di ref_mapel
            const uniqueGuru = [...new Set(rombel.data_kelas
                .map(kelas => kelas.ref_mapel.id_pengajar)
                .filter(id => id !== null))];
            const jumlahGuru = uniqueGuru.length;

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
                        mata_pelajaran: `${mapelNama} (KKM ${kkm})`,
                        is_locked: kelas.is_locked || false,
                        rencana_penilaian: all_rencana.data_kelas,
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
                    siswaNilaiMap.set(siswaId, {
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
                    nis:siswa.nis,
                    nama: siswa.nama,
                    nilai: Array.from(siswa.nilai.values())
                }));

                return acc;
            }, []);

            const formattedRombel = {
                kelas: rombel.ref_kelas?.kelas || '-',
                wali_kelas: rombel.guru_pegawai?.nama_gp || '-',
                kurikulum: rombel.ref_kelas?.ref_tingkat?.ref_kurikulum?.nama || '-',
                jumlah_siswa: jumlahSiswa,
                jumlah_guru: jumlahGuru,
                jumlah_mapel: jumlahMapel,
                mapel_details: mapelDetails,
            };

            console.log(formattedRombel);

            res.status(200).json(formattedRombel);
        } catch (e) {
            next(e);
        }
    }

    static async getRombelDetailInfo(req, res, next) {
        try {
            const { id } = req.params;

            const rombel = await prisma.data_rombel.findUnique({
                where: { id: parseInt(id) },
                include: {
                    ref_kelas: {
                        include: {
                            ref_tingkat: {
                                include: {
                                    ref_kurikulum: true,
                                },
                            },
                        },
                    },
                    guru_pegawai: true,
                    data_rombel_anggota: {
                        include: {
                            santri: true,
                        },
                    },
                    data_kelas: {
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
                        },
                    },
                },
            });
            if (!rombel) {
                return res.status(404).json({ message: 'Rombel tidak ditemukan' });
            }

            // Hitung jumlah siswa
            const jumlahSiswa = rombel.data_rombel_anggota.length;

            // Hitung jumlah mapel unik berdasarkan id_mapel
            const uniqueMapel = [...new Set(rombel.data_kelas.map(kelas => kelas.id_mapel))];
            const jumlahMapel = uniqueMapel.length;

            // Hitung jumlah guru unik berdasarkan id_pengajar di ref_mapel
            const uniqueGuru = [...new Set(rombel.data_kelas
                .map(kelas => kelas.ref_mapel.id_pengajar)
                .filter(id => id !== null))];
            const jumlahGuru = uniqueGuru.length;

            const formattedRombel = {
                kelas: rombel.ref_kelas?.kelas || '-',
                wali_kelas: rombel.guru_pegawai?.nama_gp || '-',
                kurikulum: rombel.ref_kelas?.ref_tingkat?.ref_kurikulum?.nama || '-',
                jumlah_siswa: jumlahSiswa,
                jumlah_guru: jumlahGuru,
                jumlah_mapel: jumlahMapel
            };

            res.status(200).json(formattedRombel);

        } catch (error) {
            next(error);
        }
    }

    static async getRombelDetailKelas(req, res, next) {
        try {
            const { decoded, semester, tahunAjaran } = await getTokenPayload(req);
            const { id } = req.params;
            const { tipe, komponen, } = req.query;

            // Validate tipe (category ID)
            let kategori = null;
            if (tipe) {
                if (isNaN(parseInt(tipe))) {
                    return res.status(400).json({ message: 'ID tipe kategori tidak valid' });
                }
                kategori = await prisma.ref_master_kategori.findFirst({
                    where: {
                        id: parseInt(tipe),
                        tipe: 'mapel',
                    },
                });
                if (!kategori) {
                    return res.status(404).json({ message: 'Kategori dengan ID tersebut tidak ditemukan' });
                }
            }

            // Validate komponen (component ID)
            let komponenId = null;
            if (komponen) {
                if (isNaN(parseInt(komponen))) {
                    return res.status(400).json({ message: 'ID komponen tidak valid' });
                }
                const komponenData = await prisma.ref_komponen_nilai.findUnique({
                    where: {
                        id: parseInt(komponen),
                    },
                });
                if (!komponenData) {
                    return res.status(404).json({ message: 'Komponen dengan ID tersebut tidak ditemukan' });
                }
                komponenId = parseInt(komponen);
            }

            const rombel = await prisma.data_rombel.findUnique({
                where: { id: parseInt(id) },
                include: {
                    ref_kelas: {
                        include: {
                            ref_tingkat: {
                                include: {
                                    ref_kurikulum: true,
                                },
                            },
                        },
                    },
                    guru_pegawai: true,
                    data_rombel_anggota: {
                        include: {
                            santri: true,
                        },
                    },
                    data_kelas: {
                        where: {
                            AND: [
                                tipe ? { ref_mapel: { id_master_kategori_ref_mapel: parseInt(tipe) } } : {},
                                { id_semester: parseInt(semester.id) },
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
                                    id_komponen: komponenId ? komponenId : undefined,
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
                        mata_pelajaran: `${mapelNama} (KKM ${kkm})`,
                        is_locked: kelas.is_locked || false,
                        rencana_penilaian: [],
                    };
                    acc.push(mapelEntry);
                }

                const mapBulan = {
                    1: 'Januari', 2: 'Februari', 3: 'Maret', 4: 'April', 5: 'Mei', 6: 'Juni',
                    7: 'Juli', 8: 'Agustus', 9: 'September', 10: 'Oktober', 11: 'November', 12: 'Desember'
                };

                kelas.data_rencana_penilaian.forEach(penilaian => {
                    const ki = penilaian.data_kompetensi_dasar?.data_kompetensi_inti;
                    mapelEntry.rencana_penilaian.push({
                        id: penilaian.id,
                        nama: penilaian.nama,
                        waktu: `${mapBulan[penilaian.bulan]}, Pekan ${penilaian.pekan}, Hari ${penilaian.hari}`,
                        kode_ki: ki?.kode_ki || '-',
                        deskripsi_ki: ki?.deskripsi || '-',
                        kode_kd: penilaian.data_kompetensi_dasar?.kode_kd || '-',
                        deskripsi_kd: penilaian.data_kompetensi_dasar?.deskripsi || '-',
                        id_komponen: penilaian.id_komponen,
                        bobot: `${penilaian.bobot}%`,
                    });
                });

                return acc;
            }, []);

            res.status(200).json(mapelDetails);
        } catch (error) {
            next(error);
        }
    }

    static async getRombelDetailSiswa(req, res, next) {
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

            res.status(200).json(mapelDetails[0]);
        } catch (error) {
            next(error);
        }
    }

    static async getKelasDetailByRencana(req, res, next) {
        try {
            const { decoded, semester, tahunAjaran } = await getTokenPayload(req);
            const { id, id_rencana } = req.params;

            const kelas = await prisma.data_kelas.findUnique({
                where: { id: parseInt(id) },
                include: {
                    data_rencana_penilaian: {
                        where: {
                            id: parseInt(id_rencana),
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
                        },
                        orderBy: {
                            urutan: "asc",
                        },
                    },
                },
            });

            if (!kelas) {
                return res.status(404).json({ message: 'Kelas tidak ditemukan' });
            }

            const mapBulan = {
                1: 'Januari', 2: 'Februari', 3: 'Maret', 4: 'April', 5: 'Mei', 6: 'Juni',
                7: 'Juli', 8: 'Agustus', 9: 'September', 10: 'Oktober', 11: 'November', 12: 'Desember',
            };

            const rencanaPenilaian = kelas.data_rencana_penilaian.map(penilaian => {
                const ki = penilaian.data_kompetensi_dasar?.data_kompetensi_inti;
                return {
                    id: penilaian.id,
                    nama: penilaian.nama,
                    id_komponen: penilaian.id_komponen,
                    nama_komponen: penilaian.ref_komponen_nilai?.nama || '-',
                    bulan: penilaian.bulan,
                    pekan: penilaian.pekan,
                    hari: penilaian.hari,
                    id_kd: penilaian.data_kompetensi_dasar?.id || null,
                    kode_kd: penilaian.data_kompetensi_dasar?.kode_kd || '-',
                    deskripsi_kd: penilaian.data_kompetensi_dasar?.deskripsi || '-',
                    bobot: penilaian.bobot,
                };
            });

            res.status(200).json(rencanaPenilaian[0]);
        } catch (e) {
            next(e);
        }
    }

    static async deleteRencanaPenilaian(req, res, next) {
        try {
            const { id_rencana } = req.params;

            // Validasi apakah rencana penilaian ada
            const rencanaPenilaian = await prisma.data_rencana_penilaian.findUnique({
                where: { id: parseInt(id_rencana) },
            });

            if (!rencanaPenilaian) {
                return res.status(404).json({ message: 'Rencana penilaian tidak ditemukan' });
            }

            // Hapus rencana penilaian
            await prisma.data_rencana_penilaian.delete({
                where: { id: parseInt(id_rencana) },
            });

            res.status(200).json({ message: 'Rencana penilaian berhasil dihapus' });
        } catch (e) {
            next(e);
        }
    }

    static async getKelasDetail(req, res, next) {
        try {
            const { decoded, semester, tahunAjaran } = await getTokenPayload(req);
            const { id } = req.params;
            const { tipe, komponen } = req.query;

            let kategori = null;
            if (tipe) {
                if (isNaN(parseInt(tipe))) {
                    return res.status(400).json({ message: 'ID tipe kategori tidak valid' });
                }
                kategori = await prisma.ref_master_kategori.findFirst({
                    where: {
                        id: parseInt(tipe),
                        tipe: 'mapel',
                    },
                });
                if (!kategori) {
                    return res.status(404).json({ message: 'Kategori dengan ID tersebut tidak ditemukan' });
                }
            }

            let komponenId = null;
            if (komponen) {
                if (isNaN(parseInt(komponen))) {
                    return res.status(400).json({ message: 'ID komponen tidak valid' });
                }
                const komponenData = await prisma.ref_komponen_nilai.findUnique({
                    where: {
                        id: parseInt(komponen),
                    },
                });
                if (!komponenData) {
                    return res.status(404).json({ message: 'Komponen dengan ID tersebut tidak ditemukan' });
                }
                komponenId = parseInt(komponen);
            }

            const kelas = await prisma.data_kelas.findUnique({
                where: { id: parseInt(id) },
                include: {
                    data_rombel: {
                        include: {
                            ref_kelas: {
                                include: {
                                    ref_tingkat: true
                                },
                            },
                        }
                    },
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
                        where: komponenId ? { id_komponen: komponenId } : {},
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
                            }
                        },
                        orderBy: {
                            urutan: "asc"
                        }
                    },
                },
            });

            if (!kelas) {
                return res.status(404).json({ message: 'Kelas tidak ditemukan' });
            }

            const tingkatId = kelas.ref_mapel?.data_kkm_detail[0]?.tingkat_id || null;
            let kkm = 'N/A';
            if (kelas.ref_mapel.data_kkm_detail && kelas.ref_mapel.data_kkm_detail.length > 0) {
                const kkmDetail = kelas.ref_mapel.data_kkm_detail.find(
                    detail => detail.tingkat_id === tingkatId && detail.mapel_id === kelas.id_mapel
                );
                kkm = kkmDetail?.kkm || 'N/A';
            }

            const mapBulan = {
                1: 'Januari', 2: 'Februari', 3: 'Maret', 4: 'April', 5: 'Mei', 6: 'Juni',
                7: 'Juli', 8: 'Agustus', 9: 'September', 10: 'Oktober', 11: 'November', 12: 'Desember',
            };

            const rencanaPenilaian = kelas.data_rencana_penilaian.map(penilaian => {
                const ki = penilaian.data_kompetensi_dasar?.data_kompetensi_inti;
                return {
                    id: penilaian.id,
                    nama: penilaian.nama,
                    waktu: `${mapBulan[penilaian.bulan]}, Pekan ${penilaian.pekan}, Hari ${penilaian.hari}`,
                    kode_ki: ki?.kode_ki || '-',
                    deskripsi_ki: ki?.deskripsi || '-',
                    kode_kd: penilaian.data_kompetensi_dasar?.kode_kd || '-',
                    deskripsi_kd: penilaian.data_kompetensi_dasar?.deskripsi || '-',
                    bobot: penilaian.bobot,
                };
            });

            const formattedKelas = {
                id_tingkat: kelas.data_rombel.ref_kelas.ref_tingkat.id,
                id_mapel: kelas.ref_mapel.id,
                nama_guru: kelas.ref_mapel.guru_pegawai?.nama_gp || '-',
                mata_pelajaran: kelas.ref_mapel.nama,
                kkm: kkm,
                rencana_penilaian: rencanaPenilaian,
            };

            res.status(200).json(formattedKelas);
        } catch (e) {
            next(e);
        }
    }

    static async getAllRombelKelas(req, res, next) {
        try {
            const { decoded, semester, tahunAjaran, user } = await getTokenPayload(req);
            const { tipe, class: className } = req.query;

            // Validasi kode_pegawai
            if (!user.kode_pegawai || isNaN(parseInt(user.kode_pegawai))) {
                throw new Error('Kode pegawai tidak valid');
            }

            // Validasi tipe jika diberikan
            let kategori = null;
            if (tipe) {
                if (isNaN(parseInt(tipe))) {
                    throw new Error('ID tipe kategori tidak valid');
                }
                kategori = await prisma.ref_master_kategori.findFirst({
                    where: {
                        id: parseInt(tipe),
                        tipe: 'mapel',
                    },
                });
                if (!kategori) {
                    throw new Error('Kategori dengan ID tersebut tidak ditemukan');
                }
            }

            // Cari data guru
            const guru = await prisma.guru_pegawai.findFirst({
                where: {
                    id: parseInt(user.kode_pegawai),
                },
            });
            if (!guru) {
                throw new Error('Data guru tidak ditemukan');
            }

            // Buat where clause untuk data_rombel
            const rombelWhereClause = {
                id_tahun_ajaran: semester.id_tahun_ajaran,
            };

            // Tambahkan filter classid ke rombelWhereClause jika ada
            if (className) {
                const name = className.split(" - ")[0].trim();
                let gender = className.split(" - ")[1]?.trim() || null;
                if (gender === "null") {
                    gender = null;
                }
                const refKelas = await prisma.ref_kelas.findFirst({
                    where: {
                        kelas: name,
                        gender: gender,
                    },
                });
                if (!refKelas) {
                    return res.status(404).json({ message: "Kelas tidak ditemukan" });
                }
                rombelWhereClause.id_kelas = parseInt(refKelas.id);

                // Validasi apakah rombel ada
                const rombelExists = await prisma.data_rombel.findFirst({
                    where: { id_kelas: parseInt(refKelas.id) },
                });
                if (!rombelExists) {
                    throw new Error('Rombel dengan ID tersebut tidak ditemukan');
                }
            }

            // Buat where clause untuk data_kelas
            const dataKelasWhereClause = {
                id_semester: semester.id,
                ref_mapel: {},
            };

            // Filter berdasarkan role pengguna
            if (user.role_id === 19) {
                rombelWhereClause.id_wali_kelas = guru.id;
            } else if (user.role_id === 21) {
                dataKelasWhereClause.ref_mapel.id_pengajar = guru.id;
            }

            // Filter berdasarkan kategori mapel jika ada
            if (kategori) {
                dataKelasWhereClause.ref_mapel.id_master_kategori_ref_mapel = parseInt(tipe);
            }

            // Query data rombel
            const rombel = await prisma.data_rombel.findMany({
                where: rombelWhereClause,
                include: {
                    ref_kelas: true,
                    guru_pegawai: true,
                    data_kelas: {
                        where: dataKelasWhereClause,
                        include: {
                            ref_mapel: {
                                include: {
                                    guru_pegawai: {
                                        select: {
                                            id: true,
                                            nama_gp: true,
                                        },
                                    },
                                    data_kompetensi_inti: {
                                        include: {
                                            data_kompetensi_dasar: true,
                                            ref_tingkat: true,
                                        },
                                    },
                                },
                            },
                            data_rencana_penilaian: {
                                include: {
                                    ref_komponen_nilai: true,
                                    data_kompetensi_dasar: {
                                        include: {
                                            data_kompetensi_inti: true,
                                        },
                                    },
                                },
                                orderBy: {
                                    urutan: 'asc',
                                },
                            },
                        },
                    },
                },
            });

            // Mapping hasil query
            const mappedRombel = rombel.map((rombels) => {
                const { nama, ref_kelas, guru_pegawai, data_kelas, ...rest } = rombels;
                const wali_kelas = guru_pegawai ? guru_pegawai.nama_gp : '-';
                const list_mapel = data_kelas.map((kelas) => ({
                    id_kelas: kelas.id,
                    id_mapel: kelas.ref_mapel.id,
                    id_guru: kelas.ref_mapel.guru_pegawai?.id || null,
                    nama: kelas.ref_mapel.nama,
                    guru: kelas.ref_mapel.guru_pegawai?.nama_gp || '-',
                    daftar_penilaian: kelas.data_rencana_penilaian.map((penilaian) => ({
                        id_komponen: penilaian.ref_komponen_nilai.id,
                        id_rencana: penilaian.id,
                        nama: penilaian.ref_komponen_nilai.nama,
                        kode_ki: penilaian.data_kompetensi_dasar?.data_kompetensi_inti?.kode_ki || '-',
                        kode_kd: penilaian.data_kompetensi_dasar?.kode_kd || '-',
                    })),
                }));

                const status = {
                    is_locked: data_kelas.length > 0 && data_kelas.every((kelas) => kelas.is_locked === true),
                    tujuan_pembelajaran: list_mapel.length > 0 && list_mapel.every((mapel) =>
                        mapel.id_kelas &&
                        data_kelas.find((k) => k.id === mapel.id_kelas)?.ref_mapel.data_kompetensi_inti.length > 0
                    ),
                    guru_mapel: list_mapel.length > 0 && list_mapel.every((mapel) => mapel.id_guru !== null),
                    penilaian: list_mapel.length > 0 && list_mapel.every((mapel) =>
                        mapel.id_kelas &&
                        data_kelas.find((k) => k.id === mapel.id_kelas)?.data_rencana_penilaian.length > 0
                    ),
                };

                return {
                    ...rest,
                    kelas: ref_kelas ? ref_kelas.kelas : '-',
                    wali_kelas,
                    list_mapel,
                    status,
                };
            });

            res.status(200).json(mappedRombel);
        } catch (error) {
            console.error('Error fetching rombel kelas:', error);
            next(error);
        }
    }

    static async copyConfig(req, res, next) {
        try {
            const { decoded, semester, tahunAjaran } = await getTokenPayload(req);
            const { id_rombels_list } = req.body;

            // Validasi input
            if (!id_rombels_list || !Array.isArray(id_rombels_list) || id_rombels_list.length === 0) {
                return res.status(400).json({ message: 'Silakan lakukan sinkronsasi kelas terlebih dahulu' });
            }

            // Cari tahun ajaran sebelumnya
            const thn_sblm = await prisma.ref_tahun_ajaran.findFirst({
                where: {
                    tahun_mulai: parseInt(tahunAjaran.tahun_mulai) - 1,
                },
            });

            if (!thn_sblm) {
                return res.status(404).json({ message: 'Tahun ajaran sebelumnya tidak ditemukan' });
            }

            // Cari semester yang sama dari tahun sebelumnya
            const smt_sblm = await prisma.ref_semester.findFirst({
                where: {
                    id_tahun_ajaran: parseInt(thn_sblm.id),
                    urutan: parseInt(semester.urutan),
                },
            });

            if (!smt_sblm) {
                return res.status(404).json({ message: 'Semester yang sama dari tahun sebelumnya tidak ditemukan' });
            }

            // Ambil data rombel saat ini untuk mendapatkan nama rombel
            const rombelsCurrent = await prisma.data_rombel.findMany({
                where: {
                    id: { in: id_rombels_list.map((id) => parseInt(id)) },
                    id_tahun_ajaran: parseInt(semester.id_tahun_ajaran),
                },
                include: {
                    ref_kelas: true
                }
            });

            if (rombelsCurrent.length === 0) {
                return res.status(404).json({ message: 'Rombel tidak ditemukan di tahun ajaran saat ini' });
            }

            // Cari rombel di tahun sebelumnya yang memiliki nama yang sama
            const rombelsPrevious = await prisma.data_rombel.findMany({
                where: {
                    id_tahun_ajaran: parseInt(thn_sblm.id),
                    id_kelas: { in: rombelsCurrent.map((r) => r.id_kelas) },
                },
                include: {
                    ref_kelas: true
                }
            });

            if (rombelsPrevious.length === 0) {
                return res.status(404).json({ message: 'Rombel dengan nama yang sama tidak ditemukan di tahun sebelumnya' });
            }

            // Ambil data kelas dari semester sebelumnya untuk rombel yang cocok
            const data_kelas_previous = await prisma.data_kelas.findMany({
                where: {
                    id_semester: parseInt(smt_sblm.id),
                    id_rombel: {
                        in: rombelsPrevious.map((r) => r.id),
                    },
                },
                include: {
                    data_rencana_penilaian: {
                        include: {
                            data_kompetensi_dasar: true
                        }
                    },
                },
            });

            if (data_kelas_previous.length === 0) {
                return res.status(404).json({ message: 'Tidak ada data kelas yang ditemukan untuk rombel yang dipilih di tahun sebelumnya' });
            }

            // Ambil id_mapel yang sudah ada di semester saat ini untuk rombel yang dipilih
            const existingMapelIds = await prisma.data_kelas.findMany({
                where: {
                    id_semester: parseInt(semester.id),
                    id_rombel: {
                        in: id_rombels_list.map((id) => parseInt(id)),
                    },
                },
                select: {
                    id_mapel: true,
                },
            }).then((results) => results.map((r) => r.id_mapel));

            // Filter data kelas untuk hanya menyalin mapel yang belum ada
            const data_kelas_to_copy = data_kelas_previous.filter((kelas) => !existingMapelIds.includes(kelas.id_mapel));

            if (data_kelas_to_copy.length === 0) {
                return res.status(200).json({ message: 'Tidak ada data kelas baru untuk disalin karena semua mapel sudah ada' });
            }

            // Salin data kelas dan rencana penilaian dalam transaksi
            const new_data_kelas = await prisma.$transaction(async (tx) => {
                const createdKelas = [];
                for (const kelas of data_kelas_to_copy) {
                    // Cari rombel saat ini yang memiliki nama yang sama
                    const matchingRombel = rombelsCurrent.find((r) => r.id_kelas === rombelsPrevious.find((rp) => rp.id === kelas.id_rombel)?.id_kelas);

                    if (!matchingRombel) continue;

                    // Buat data kelas baru untuk rombel yang sesuai
                    const newKelas = await tx.data_kelas.create({
                        data: {
                            id_semester: parseInt(semester.id),
                            id_mapel: kelas.id_mapel,
                            nama: kelas.nama,
                            kode_kelas: kelas.kode_kelas,
                            tahfidz_jadwal: kelas.tahfidz_jadwal,
                            tahfidz_target_juz: kelas.tahfidz_target_juz,
                            id_master_kategori_status_data_kelas: kelas.id_master_kategori_status_data_kelas,
                            id_master_kategori_tipe_data_kelas: kelas.id_master_kategori_tipe_data_kelas,
                            id_rombel: matchingRombel.id,
                            is_locked: kelas.is_locked || false,
                        },
                    });

                    // Salin rencana penilaian
                    for (const penilaian of kelas.data_rencana_penilaian) {
                        await tx.data_rencana_penilaian.create({
                            data: {
                                id_kelas: newKelas.id,
                                id_komponen: penilaian.id_komponen,
                                nama: penilaian.nama,
                                pertemuan_ke: penilaian.pertemuan_ke,
                                bobot: penilaian.bobot,
                                nilai_maksimum: penilaian.nilai_maksimum,
                                keterangan: penilaian.keterangan,
                                urutan: penilaian.urutan,
                                id_kd: penilaian.id_kd,
                                bulan: penilaian.bulan,
                                hari: penilaian.hari,
                                pekan: penilaian.pekan,
                            },
                        });
                    }

                    createdKelas.push(newKelas);
                }
                return createdKelas;
            });

            return res.status(201).json({
                message: 'Konfigurasi berhasil disalin untuk mapel yang belum ada',
                data: new_data_kelas,
            });
        } catch (error) {
            next(error);
        }
    }
}