import { AppError } from "../middleware/errorHandler.js";
import { prisma } from "../prisma.js";

const STATUS = {
    TAGIHAN_BELUM_LUNAS: 17, //BELUM LUNAS
    TAGIHAN_LUNAS: 18, //LUNAS
    POTONGAN_APPLIED: 19, //DISETUJUI
    POTONGAN_PENDING: 20, //DIPROSES
}

export class BeasiswaSantriController {
    static getBeasiswaSantri = async (req, res, next) => {
        try {
            const beasiswa_santri = await prisma.data_beasiswa_santri.findMany();

            return res.status(200).json({
                success: true,
                message: "beasiswa santri berhasil diambil",
                data: beasiswa_santri
            });


        }catch (error) {
            next(new AppError(error.message, 500));
        }
    }

    static createBeasiswaSantri = async (req, res, next) => {
        try{
            const {id_santri, id_jenis_beasiswa, status, keterangan, tanggal_mulai, tanggal_selesai, lewati_verifikasi = false} = req.body;

            if (!id_santri || typeof id_santri!=='number') {
                return next(new AppError("id santri harus diisi", 400));
            }

            if (!id_jenis_beasiswa || typeof id_jenis_beasiswa!=='number') {
                return next(new AppError("id jenis beasiswa harus diisi", 400));
            }

            if (!status || typeof status!=='boolean') {
                return next(new AppError("status harus diisi", 400));
            }

            if (!keterangan || typeof keterangan!=='string') {
                return next(new AppError("keterangan harus diisi", 400));
            }

            const santri = await prisma.santri.findUnique({
                where: {
                    id: id_santri
                }
            })

            if (!santri) {
                return next(new AppError("santri tidak ditemukan", 404));
            }

            const jenis_beasiswa = await prisma.ref_jenis_beasiswa.findUnique({
                where: {
                    id: id_jenis_beasiswa
                }
            })
            if (!jenis_beasiswa) {
                return next(new AppError("jenis beasiswa tidak ditemukan", 404));
            }

            const startDate = new Date(tanggal_mulai);
            const endDate = new Date(tanggal_selesai);
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                throw new AppError("Format tanggal tidak valid", 400);
            }
            if (startDate > endDate) {
                throw new AppError("Tanggal mulai harus sebelum tanggal selesai", 400);
            }

            const newBeasiswa = await prisma.data_beasiswa_santri.create({
                data: {
                    id_santri: parseInt(id_santri),
                    id_beasiswa: parseInt(id_jenis_beasiswa),
                    status: status ? 21 : 22,
                    tanggal_mulai: new Date(tanggal_mulai),
                    tanggal_selesai: new Date(tanggal_selesai),
                    keterangan: `Beasiswa ${jenis_beasiswa.nama} untuk siswa ${santri.nama}`,
                    created_at: new Date(),
                    updated_at: new Date(),
                },
            });

            // Terapkan potongan sesuai lewati_verifikasi
            if (lewati_verifikasi) {
                await this.applyBeasiswaPotongan(newBeasiswa.id, res, next);
            } else {
                await this.syncBeasiswaPotongan(newBeasiswa.id, res, next);
            }

            return res.status(201).json({
                success: true,
                message: "Beasiswa berhasil dibuat",
                data: newBeasiswa,
            });
        }catch (error) {
            next(new AppError(error.message, 500));
        }
    }

    // Fungsi untuk menerapkan potongan beasiswa langsung (lewati_verifikasi = true)
    static applyBeasiswaPotongan = async (beasiswaId, res, next) => {
        try {
            const beasiswa = await prisma.data_beasiswa_santri.findUnique({
                where: { id: beasiswaId },
                include: { beasiswa: true },
            });

            const tagihanList = await prisma.data_tagihan_santri.findMany({
                where: {
                    id_santri: beasiswa.id_santri,
                    status: STATUS.TAGIHAN_BELUM_LUNAS,
                    tanggal_jatuh_tempo: {
                        gte: beasiswa.tanggal_mulai,
                        lte: beasiswa.tanggal_selesai,
                    },
                },
                include: { ref_jenis_tagihan_santri: true },
            });

            if (tagihanList.length > 0) {
                await prisma.$transaction(async (tx) => {
                    const updates = [];
                    for (const tagihan of tagihanList) {
                        const potonganNominal = beasiswa.beasiswa.nominal
                            ? beasiswa.beasiswa.nominal
                            : (tagihan.nominal * beasiswa.beasiswa.persentase) / 100;
                        const newNominal = tagihan.nominal - potonganNominal;

                        if (newNominal >= 0) {
                            updates.push(
                                tx.data_tagihan_santri.update({
                                    where: { id: tagihan.id },
                                    data: { nominal: newNominal, updated_at: new Date(), updated_by: "system" },
                                }),
                                tx.data_tagihan_santri_potongan.create({
                                    data: {
                                        pembayaran_id: tagihan.id,
                                        tipe: "beasiswa",
                                        nominal: potonganNominal,
                                        keterangan: `Potongan beasiswa ${beasiswa.beasiswa.persentase === 100 ? "penuh" : "parsial"} untuk ${tagihan.ref_jenis_tagihan_santri.nama}`,
                                        id_status: STATUS.POTONGAN_APPLIED,
                                    },
                                })
                            );
                        }
                    }
                    await Promise.all(updates);
                });
            }
        } catch (error) {
            next(new AppError(error.message, error.statusCode || 500));
        }
    }

    // Fungsi untuk menambahkan potongan dengan status pending (lewati_verifikasi = false)
    static syncBeasiswaPotongan = async (beasiswaId, res, next) => {
        try {
            const beasiswa = await prisma.data_beasiswa_santri.findUnique({
                where: { id: beasiswaId },
                include: { beasiswa: true },
            });

            const tagihanList = await prisma.data_tagihan_santri.findMany({
                where: {
                    id_santri: beasiswa.id_santri,
                    status: STATUS.TAGIHAN_BELUM_LUNAS,
                    tanggal_jatuh_tempo: {
                        gte: beasiswa.tanggal_mulai,
                        lte: beasiswa.tanggal_selesai,
                    },
                },
                include: { ref_jenis_tagihan_santri: true },
            });

            if (tagihanList.length > 0) {
                const potonganData = [];
                for (const tagihan of tagihanList) {
                    const potonganNominal = beasiswa.beasiswa.nominal
                        ? beasiswa.beasiswa.nominal
                        : (tagihan.nominal * beasiswa.beasiswa.persentase) / 100;
                    potonganData.push({
                        pembayaran_id: tagihan.id,
                        tipe: "beasiswa",
                        nominal: potonganNominal,
                        keterangan: `Potongan beasiswa ${beasiswa.beasiswa.persentase === 100 ? "penuh" : "parsial"} untuk ${tagihan.ref_jenis_tagihan_santri.nama}`,
                        id_status: STATUS.POTONGAN_PENDING,
                    });
                }

                await prisma.data_tagihan_santri_potongan.createMany({
                    data: potonganData,
                });
            }
        } catch (error) {
            next(new AppError(error.message, error.statusCode || 500));
        }
    }

    static applyBeasiswaPotonganbyId = async (req, res, next) => {
        try {
            const { id } = req.params;
            // console.log(typeof id);

            if (!id) {
                return next(new AppError("ID Potongan harus diisi", 400));
            }

            const potongan = await prisma.data_tagihan_santri_potongan.findUnique({
                where: {
                    id: parseInt(id),
                }
            })

            if (!potongan) {
                return next(new AppError("potongan tidak ditemukan", 404));
            }

            await prisma.$transaction(async (tx) => {
                await tx.data_tagihan_santri_potongan.update({
                    where: {
                        id: parseInt(id),
                        id_status: STATUS.POTONGAN_PENDING,
                    },
                    data: {
                        id_status: STATUS.POTONGAN_APPLIED,
                        updated_at: new Date(),
                    },
                });

                const tagihan = await tx.data_tagihan_santri.findUnique({
                    where: {
                        id: potongan.pembayaran_id,
                    },
                });

                await tx.data_tagihan_santri.update({
                    where: {
                        id: potongan.pembayaran_id,
                    },
                    data: {
                        updated_at: new Date(),
                        nominal: tagihan.nominal - potongan.nominal,
                    },
                });
            })
        }catch (error) {
            next(new AppError(error.message, 500));
        }
    }

    static getPotonganBeasiswa = async (req, res, next) => {
        try {
            const beasiswa_potongan = await prisma.data_tagihan_santri_potongan.findMany({
                where: {
                    tipe: "beasiswa",
                },
            })
            const beasiswa_potongan_approved = beasiswa_potongan.filter((potongan) => potongan.id_status === STATUS.POTONGAN_APPLIED);
            const beasiswa_potongan_pending = beasiswa_potongan.filter((potongan) => potongan.id_status === STATUS.POTONGAN_PENDING);

            return res.status(200).json({
                success: true,
                message: "potongan beasiswa berhasil diambil",
                data: {
                    approved: beasiswa_potongan_approved,
                    pending: beasiswa_potongan_pending,
                }
            })
        }catch (error) {
            next(new AppError(error.message, 500));
        }
    }

// to do: update beasiswa santri, jika update maka semua potongan yang memiliki/berada di status pending dan tagihan belum di proses, indikatornya beasiswaid, tanggal mulai dan tanggal selesai, id_santri,
    static updateBeasiswaSantri = async (req, res, next) => {
        try{
            const {id} = req.params;
            const {id_santri, id_jenis_beasiswa, status, keterangan} = req.body;

            if (!id || typeof id!=='number') {
                return next(new AppError("id harus diisi", 400));
            }
            if (!id_santri || typeof id_santri!=='number') {
                return next(new AppError("id santri harus diisi", 400));
            }

            if (!id_jenis_beasiswa || typeof id_jenis_beasiswa!=='number') {
                return next(new AppError("id jenis beasiswa harus diisi", 400));
            }

            if (!status || typeof status!=='boolean') {
                return next(new AppError("status harus diisi", 400));
            }

            if (!keterangan || typeof keterangan!=='string') {
                return next(new AppError("keterangan harus diisi", 400));
            }

            const santri = await prisma.santri.findUnique({
                where: {
                    id: id_santri
                }
            })

            if (!santri) {
                return next(new AppError("santri tidak ditemukan", 404));
            }

            const jenis_beasiswa = await prisma.ref_jenis_beasiswa.findUnique({
                where: {
                    id: id_jenis_beasiswa
                }
            })
            if (!jenis_beasiswa) {
                return next(new AppError("jenis beasiswa tidak ditemukan", 404));
            }

            const beasiswa_santri = await prisma.data_beasiswa_santri.update({
                where: {
                    id: parseInt(id)
                },
                data: {
                    id_santri,
                    id_jenis_beasiswa,
                    status,
                    keterangan
                }
            })
            return res.status(200).json({
                success: true,
                message: "beasiswa santri berhasil diupdate",
                data: beasiswa_santri
            })
        }catch (error) {
            next(new AppError(error.message, 500));
        }
    }

    static deleteBeasiswaSantri = async (req, res, next) => {
        try{
            const {id} = req.params;

            if (!id || typeof id!=='number') {
                return next(new AppError("id harus diisi", 400));
            }

            const beasiswa_santri = await prisma.data_beasiswa_santri.delete({
                where: {
                    id: parseInt(id)
                }
            })
            return res.status(200).json({
                success: true,
                message: "beasiswa santri berhasil dihapus",
                data: beasiswa_santri
            })
        }catch (error) {
            next(new AppError(error.message, 500));
        }
    }

}