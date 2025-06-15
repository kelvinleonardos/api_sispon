import { prisma } from '../prisma.js';
import {JWTService} from "../services/jwt.service.js";
import {getTokenPayload} from "../helpers.js";

export class RombelAnggotaController {
    static async createRombelAnggota(req, res, next) {
        try {

            const { id_rombel, id_santri } = req.body;
            const id_santri_list = Array.isArray(id_santri) ? id_santri : [id_santri];

            let count = 0;

            for (const id of id_santri_list) {
                const newAnggota = await prisma.data_rombel_anggota.create({
                    data: {
                        id_rombel: parseInt(id_rombel),
                        id_santri: parseInt(id),
                    },
                });
                count++;
            }

            res.status(201).json({"message": `${count} Siswa berhasil dimasukkan ke rombel`});
        } catch (error) {
            next(error);
        }
    }

    static async getRiwayatSantri(req, res, next) {
        try {
            const { id_santri } = req.params;

            const riwayat = await prisma.data_rombel_anggota.findMany({
                where: {
                    id_santri: parseInt(id_santri),
                },
                include: {
                    data_rombel: {
                        include: {
                            ref_kelas: true,
                            ref_tahun_ajaran: true,
                        },
                    },
                },
                orderBy: {
                    data_rombel: {
                        ref_kelas: {
                            id_tingkat: "desc"
                        }
                    }
                }
            });

            const mappedRiwayat = riwayat.map((item) => {
                const { data_rombel, ...rest } = item;
                return {
                    ...rest,
                    kelas: data_rombel.ref_kelas.kelas,
                    tahun_ajaran: data_rombel.ref_tahun_ajaran.nama,
                };
            });

            res.status(200).json(mappedRiwayat);
        } catch (error) {
            next(error);
        }
    }

    static async moveAnggota(req, res, next) {
        try {
            const { id_rombel_asal, id_santri, id_rombel_target } = req.body;
            const id_santri_list = Array.isArray(id_santri) ? id_santri : [id_santri];

            for (const id of id_santri_list) {
                const santri = await prisma.data_rombel_anggota.findFirst({
                    where: {
                        id_rombel: parseInt(id_rombel_asal),
                        id_santri: parseInt(id),
                    },
                });
                const updatedSantri = await prisma.data_rombel_anggota.update({
                    where: {
                        id: santri.id,
                    },
                    data: {
                        id_rombel: parseInt(id_rombel_target),
                    },
                })
            }


            res.status(200).json({"message": "Anggota moved successfully"});

        } catch (error) {
            next(error);
        }
    }

    static async graduateSantri(req, res, next) {
        try {
            // Ambil tahun ajaran saat ini dari token payload
            const { semester, tahunAjaran } = await getTokenPayload(req);

            // Ambil semua rombel yang terkait dengan ref_tingkat id = 6
            const rombels = await prisma.data_rombel.findMany({
                where: {
                    ref_kelas: {
                        id_tingkat: 6,
                    },
                    id_tahun_ajaran: parseInt(tahunAjaran.id)
                },
                include: {
                    data_rombel_anggota: {
                        select: {
                            id_santri: true,
                        },
                    },
                },
            });
            // Kumpulkan semua id_santri yang akan diproses
            const santriIds = new Set();
            for (const rombel of rombels) {
                for (const anggota of rombel.data_rombel_anggota) {
                    santriIds.add(anggota.id_santri);
                }
            }

            // Hapus semua entri data_rombel_anggota untuk rombel tersebut
            await prisma.data_rombel_anggota.deleteMany({
                where: {
                    id_rombel: {
                        in: rombels.map(rombel => rombel.id),
                    },
                    data_rombel: {
                        id_tahun_ajaran: tahunAjaran.id
                    }
                },
            });

            // // Update ref_kategori santri menjadi 7
            await prisma.santri.updateMany({
                where: {
                    id: {
                        in: Array.from(santriIds),
                    },
                },
                data: {
                    id_master_kategori_status_santri: 7,
                },
            });

            // Update atau buat entri di santri_status untuk tahun_ajaran_tamat
            for (const id_santri of santriIds) {
                const existingStatus = await prisma.santri_status.findFirst({
                    where: {
                        id_santri: id_santri,
                    },
                });

                if (existingStatus) {
                    // Update jika sudah ada
                    await prisma.santri_status.update({
                        where: {
                            id: existingStatus.id,
                        },
                        data: {
                            tahun_ajaran_tamat: tahunAjaran.nama,
                            tgl_keluar: new Date(),
                        },
                    });
                } else {
                    // Buat baru jika belum ada
                    await prisma.santri_status.create({
                        data: {
                            id_santri: id_santri,
                            tahun_ajaran_tamat: tahunAjaran.nama,
                            tgl_keluar: new Date(),
                        },
                    });
                }
            }

            res.status(200).json({
                message: `Berhasil meluluskan ${santriIds.size} santri dari kelas 12, mengubah kategori santri menjadi alumni, dan memperbarui status dengan tahun lulus ${tahunAjaran.nama}`,
            });
        } catch (error) {
            next(error);
        }
    }

    static async syncRombel(req, res, next) {
        try {
            const { decoded, semester, tahunAjaran } = await getTokenPayload(req);

            // Ambil semua kelas dari ref_kelas
            const class_list = await prisma.ref_kelas.findMany();

            // Ambil tahun ajaran sebelumnya (jika ada) untuk menarik anggota
            const previousTahunAjaran = await prisma.ref_tahun_ajaran.findFirst({
                where: {
                    id: { lt: semester.id_tahun_ajaran }, // Ambil tahun ajaran sebelumnya
                },
                orderBy: { id: 'desc' },
            });

            for (const class_item of class_list) {
                // Cek apakah rombel sudah ada untuk kelas dan tahun ajaran ini
                const rombel = await prisma.data_rombel.findFirst({
                    where: {
                        id_tahun_ajaran: semester.id_tahun_ajaran,
                        id_kelas: class_item.id,
                    },
                });

                let newRombel;
                if (!rombel) {
                    // Buat rombel baru jika belum ada
                    newRombel = await prisma.data_rombel.create({
                        data: {
                            id_kelas: class_item.id,
                            id_tahun_ajaran: semester.id_tahun_ajaran,
                            id_wali_kelas: null,
                            id_status: 13,
                        },
                    });
                } else {
                    newRombel = rombel;
                }

                // Jika ada tahun ajaran sebelumnya, tarik anggota dari rombel sebelumnya
                if (previousTahunAjaran) {
                    // Ambil rombel dari tahun ajaran sebelumnya untuk kelas yang sama
                    const previousRombel = await prisma.data_rombel.findFirst({
                        where: {
                            id_tahun_ajaran: previousTahunAjaran.id,
                            id_kelas: class_item.id,
                        },
                        include: {
                            data_rombel_anggota: {
                                where: {
                                    santri: {
                                        id_master_kategori_status_santri: 8, // Hanya santri dengan status 8
                                    },
                                },
                                include: {
                                    santri: true, // Sertakan data santri untuk memastikan filter
                                },
                            },
                        },
                    });

                    if (previousRombel && previousRombel.data_rombel_anggota.length > 0) {
                        // Salin anggota dari rombel sebelumnya ke rombel baru dengan catatan dikosongkan
                        const anggotaList = previousRombel.data_rombel_anggota.map(anggota => ({
                            id_rombel: newRombel.id,
                            id_santri: anggota.id_santri,
                            id_master_kategori_status_data_rombel_anggota: anggota.id_master_kategori_status_data_rombel_anggota,
                            catatan_wf_as: null, // Kosongkan catatan
                            catatan_wf_ts: null, // Kosongkan catatan
                            catatan_wk_as: null, // Kosongkan catatan
                            catatan_wk_ts: null, // Kosongkan catatan
                        }));

                        // Masukkan anggota ke rombel baru
                        await prisma.data_rombel_anggota.createMany({
                            data: anggotaList,
                            skipDuplicates: true, // Hindari duplikasi jika anggota sudah ada
                        });
                    }
                }
            }

            res.status(200).json({ message: "Rombel dan anggota synced successfully dengan catatan dikosongkan" });
        } catch (error) {
            next(error);
        }
    }
}
