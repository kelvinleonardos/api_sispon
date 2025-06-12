import { AppError } from "../middleware/errorHandler.js";
import { prisma } from "../prisma.js";

const STATUS = {
    TAGIHAN_BELUM_LUNAS: 17, //BELUM LUNAS
    TAGIHAN_LUNAS: 18, //LUNAS
    POTONGAN_APPLIED: 17, //DISETUJUI
    POTONGAN_PENDING: 18, //DIPROSES
};

export class SkemaTagihanController {
    static getSkemaTagihan = async (req, res, next) => {
        try {
            const skemaTagihan = await prisma.data_skema_tagihan.findMany();
            return res.send(skemaTagihan);
        } catch (error) {
            return next(new AppError(error.message, 500));
        }
    };

    static createSkemaTagihan = async (req, res, next) => {
        try {
            const { id_jenis_tagihan, nominal } = req.body;

            if (!id_jenis_tagihan || !nominal) {
                return next(
                    new AppError(
                        "id jenis tagihan dan nominal harus diisi",
                        400
                    )
                );
            }

            if (
                typeof id_jenis_tagihan !== "number" ||
                typeof nominal !== "number"
            ) {
                return next(
                    new AppError(
                        "id jenis tagihan dan nominal harus berupa number",
                        400
                    )
                );
            }

            const skemaTagihan = await prisma.data_skema_tagihan.create({
                data: {
                    id_jenis_tagihan,
                    nominal,
                },
            });
            res.status(201).json({
                success: true,
                message: "skema tagihan berhasil dibuat",
                data: skemaTagihan,
            });
        } catch (error) {
            return next(new AppError(error.message, 500));
        }
    };

    static updateSkemaTagihan = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { id_jenis_tagihan, nominal } = req.body;

            if (!id_jenis_tagihan || !nominal) {
                return next(
                    new AppError(
                        "id jenis tagihan dan nominal harus diisi",
                        400
                    )
                );
            }
            if (
                typeof id_jenis_tagihan !== "number" ||
                typeof nominal !== "number"
            ) {
                return next(
                    new AppError(
                        "id jenis tagihan dan nominal harus berupa number",
                        400
                    )
                );
            }

            const skemaTagihan = await prisma.data_skema_tagihan.update({
                where: {
                    id: parseInt(id),
                },
                data: {
                    id_jenis_tagihan,
                    nominal,
                },
            });
            res.status(200).json({
                success: true,
                message: "skema tagihan berhasil diupdate",
                data: skemaTagihan,
            });
        } catch (error) {
            return next(new AppError(error.message, 500));
        }
    };

    static deleteSkemaTagihan = async (req, res, next) => {
        try {
            const { id } = req.params;
            const skemaTagihan = await prisma.data_skema_tagihan.delete({
                where: {
                    id: parseInt(id),
                },
            });
            res.status(200).json({
                success: true,
                message: "skema tagihan berhasil dihapus",
                data: skemaTagihan,
            });
        } catch (error) {
            return next(new AppError(error.message, 500));
        }
    };

    static generateTagihanSantri = async (req, res, next) => {
        try {
            const { id_santri } = req.body;

            const skema = await prisma.data_skema_tagihan.findMany({
                // where: {
                // 	is_active: true, // Example filter: only fetch active records
                // },
                include: {
                    ref_jenis_tagihan_santri: true,
                },
            });

            const currentYear = new Date().getFullYear();

            for (const item of skema) {
                if (item.ref_jenis_tagihan_santri.frekuensi === "tahunan") {
                    try {
                        await prisma.data_tagihan_santri.create({
                            data: {
                                id_santri,
                                id_jenis_tagihan: item.id_jenis_tagihan,
                                nominal: item.nominal,
                                status: 17,
                                tanggal_jatuh_tempo: new Date(
                                    currentYear,
                                    11, // December is month 11 (0-based index)
                                    31 // Last day of December
                                ),
                            },
                        });
                    } catch (error) {
                        // Handle error if needed, e.g., log it or send a response
                        console.error("Error creating annual tagihan:", error);
                        continue; // Skip to the next item if there's an error
                    }
                }
                if (item.ref_jenis_tagihan_santri.frekuensi === "bulanan") {
                    for (let i = 0; i < 12; i++) {
                        try {
                            await prisma.data_tagihan_santri.create({
                                data: {
                                    id_santri,
                                    id_jenis_tagihan: item.id_jenis_tagihan,
                                    nominal: item.nominal,
                                    status: 17,
                                    tanggal_jatuh_tempo: new Date(
                                        currentYear,
                                        i + 1,
                                        0 // The 0th day of the next month gives the last day of the current month
                                    ),
                                },
                            });
                        } catch (error) {
                            // Handle error if needed, e.g., log it or send a response
                            console.error("Error creating monthly tagihan:", error);
                            continue; // Skip to the next item if there's an error
                        }
                    }
                }
                if (item.ref_jenis_tagihan_santri.frekuensi === "semester") {
                    try {
                        await prisma.data_tagihan_santri.create({
                            data: {
                                id_santri,
                                id_jenis_tagihan: item.id_jenis_tagihan,
                                nominal: item.nominal,
                                status: 17,
                                tanggal_jatuh_tempo: new Date(
                                    currentYear,
                                    6, // July is month 6 (0-based index)
                                    1
                                ),
                            },
                        });
                        await prisma.data_tagihan_santri.create({
                            data: {
                                id_santri,
                                id_jenis_tagihan: item.id_jenis_tagihan,
                                nominal: item.nominal,
                                status: 17,
                                tanggal_jatuh_tempo: new Date(
                                    currentYear + 1,
                                    0, // January is month 0 (0-based index)
                                    1
                                ),
                            },
                        });
                    } catch (error) {
                        // Handle error if needed, e.g., log it or send a response
                        console.error("Error creating semester tagihan:", error);
                        continue; // Skip to the next item if there's an error
                    }
                }
                if (item.ref_jenis_tagihan_santri.frekuensi === "sekali") {
                    try {
                        await prisma.data_tagihan_santri.create({
                            data: {
                                id_santri,
                                id_jenis_tagihan: item.id_jenis_tagihan,
                                nominal: item.nominal,
                                status: 17,
                                tanggal_jatuh_tempo: new Date(
                                    currentYear + 1,
                                    1,
                                    1
                                ),
                            },
                        });
                    } catch (error) {
                        // Handle error if needed, e.g., log it or send a response
                        console.error("Error creating once-off tagihan:", error);
                        continue; // Skip to the next item if there's an error
                    }
                }
            }

            await this.syncBeasiswaPotongan(next); // Tambahkan ini untuk memanggil fungsi syncBeasiswaPotongan setelah tagihan santri di-generate

            res.status(200).json({
                success: true,
                message: "tagihan santri berhasil dibuat",
            });
            // const tagihan = await prisma.data_tagihan_santri.createMany({
            //     data: skema.map((item) => ({
            //         id_santri,
            //         id_jenis_tagihan: item.id_jenis_tagihan,
            //         nominal: item.nominal,
            //         status: 17,
            //         tanggal_jatuh_tempo: new Date()

            //     }))
            // })
            // res.status(200).json({
            //     success: true,
            //     message: "tagihan santri berhasil dibuat",
            //     data: tagihan
            // })
        } catch (error) {
            return next(new AppError(error.message, 500));
        }
    };

    // Fungsi untuk menambahkan potongan dengan status pending (lewati_verifikasi = false)
    static async syncBeasiswaPotongan(next) {
        try {
            const beasiswaList = await prisma.data_beasiswa_santri.findMany({
                // where: { id: beasiswaId },
                include: { beasiswa: true },
            });

            for (const beasiswa of beasiswaList) {
                // await this.syncBeasiswaPotongan(next);

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
                            : (tagihan.nominal * beasiswa.beasiswa.persentase) /
                            100;
                        potonganData.push({
                            pembayaran_id: tagihan.id,
                            tipe: "beasiswa",
                            nominal: potonganNominal,
                            keterangan: `Potongan beasiswa ${
                                beasiswa.beasiswa.persentase === 100
                                    ? "penuh"
                                    : "parsial"
                            } untuk ${tagihan.ref_jenis_tagihan_santri.nama}`,
                            status_potongan: STATUS.POTONGAN_PENDING,
                        });
                    }

                    await prisma.data_tagihan_santri_potongan.createMany({
                        data: potonganData,
                    });
                }
            }
        } catch (error) {
            next(new AppError(error.message, error.statusCode || 500));
        }
    }
}