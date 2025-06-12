import { AppError } from "../middleware/errorHandler.js";
import { prisma } from "../prisma.js";

const STATUS = {
    TAGIHAN_BELUM_LUNAS: 17, //BELUM LUNAS
    TAGIHAN_LUNAS: 18, //LUNAS
    POTONGAN_APPLIED: 17, //DISETUJUI
    POTONGAN_PENDING: 18, //DIPROSES
}

const COA = {
    KAS: 1,
    KAS_BANK: 2,
    PENDAPATAN_SPP: 4,
    PENDAPATAN_BEASISWA: 23,
};

export class DataTagihanSantriController {
    static async getDataTagihanSantri(req, res, next) {
        try {
            const { id_santri } = req.params;
            const tagihan = await prisma.data_tagihan_santri.findMany({
                where: {
                    id_santri: parseInt(id_santri),
                },
                include: {
                    // ref_jenis_tagihan_santri: true,
                    // santri: true,
                    data_tagihan_santri_potongan: true,
                },
            });

            return res.status(200).json({
                success: true,
                message: "Data tagihan santri berhasil diambil",
                data: tagihan,
            });
        } catch (error) {
            next(new AppError(error.message, 500));
        }
    }

    static async detailTagihanSantri(req, res, next) {
        try {
            const { id } = req.params;
            const tagihan = await prisma.data_tagihan_santri.findMany({
                where: {
                    id: parseInt(id),
                },
                include: {
                    ref_jenis_tagihan_santri: true,
                    santri: true,
                    data_tagihan_santri_potongan: true,
                },
            });

            return res.status(200).json({
                success: true,
                message: "Data tagihan santri berhasil diambil",
                data: tagihan,
            });
        } catch (error) {
            next(new AppError(error.message, 500));
        }
    }

    static async bayarTagihanSantri(req, res, next) {
        try {
            const { id } = req.params;
            const {
                nominal,
                metode_pembayaran,
                nomor_referensi,
                potongan = [], // Array potongan opsional
                keterangan,
                created_by = "system",
            } = req.body;

            // Validasi input
            if (!id || isNaN(parseInt(id))) {
                return next(new AppError("ID tagihan tidak valid", 400));
            }
            if (!nominal || nominal < 0) {
                return next(new AppError("Nominal tidak valid", 400));
            }
            if (
                metode_pembayaran &&
                !["tunai", "transfer", "virtual_account"].includes(
                    metode_pembayaran
                )
            ) {
                return next(new AppError("Metode pembayaran tidak valid", 400));
            }
            for (const p of potongan) {
                if (
                    ![
                        "beasiswa_penuh",
                        "beasiswa_parial",
                        "potongan",
                        "diskon",
                    ].includes(p.tipe)
                ) {
                    return next(
                        new AppError(`Tipe potongan ${p.tipe} tidak valid`, 400)
                    );
                }
                if (!p.nominal || p.nominal < 0) {
                    return next(
                        new AppError("Nominal potongan tidak valid", 400)
                    );
                }
            }

            // Transaksi Prisma
            const result = await prisma.$transaction(async (tx) => {
                // Ambil data tagihan beserta potongan yang sudah ada
                const dataTagihanSantri =
                    await tx.data_tagihan_santri.findFirst({
                        where: { id: parseInt(id) },
                        include: {
                            ref_jenis_tagihan_santri: true,
                            santri: true,
                            data_tagihan_santri_potongan: true, // Ambil potongan yang sudah ada
                        },
                    });

                if (!dataTagihanSantri) {
                    throw new AppError(
                        "Data tagihan santri tidak ditemukan",
                        404
                    );
                }

                if (dataTagihanSantri.status === 1) {
                    // Asumsi status 1 = Lunas
                    throw new AppError("Tagihan sudah lunas", 400);
                }

                // Hitung total potongan: dari database + dari body API
                const existingPotongan =
                    dataTagihanSantri.data_tagihan_santri_potongan || [];
                const totalExistingPotongan = existingPotongan
                    .filter((p) => p.id_status == STATUS.POTONGAN_APPLIED)
                    .reduce((sum, p) => sum + Number(p.nominal), 0);
                const totalNewPotongan = potongan.reduce(
                    (sum, p) => sum + Number(p.nominal),
                    0
                );
                const totalPotongan = totalExistingPotongan + totalNewPotongan;

                // Ambil nominal tagihan asli dari data_skema_tagihan
                const skemaTagihan = await tx.data_skema_tagihan.findFirst({
                    where: {
                        id_jenis_tagihan: dataTagihanSantri.id_jenis_tagihan,
                    },
                });

                if (!skemaTagihan) {
                    throw new AppError("Skema tagihan tidak ditemukan", 404);
                }

                const nominalTagihanAsli = Number(skemaTagihan.nominal);

                // Validasi total pembayaran + potongan
                if (Number(nominal) + totalPotongan > nominalTagihanAsli) {
                    throw new AppError(
                        "Total pembayaran dan potongan melebihi nominal tagihan",
                        400
                    );
                }

                const tanggalBayar = new Date();
                const tanggalJatuhTempo = new Date(
                    dataTagihanSantri.tanggal_jatuh_tempo
                );

                // Cek duplikasi tagihan
                const duplicate = await tx.data_tagihan_santri.findMany({
                    where: {
                        id_santri: dataTagihanSantri.id_santri,
                        id_jenis_tagihan: dataTagihanSantri.id_jenis_tagihan,
                        tanggal_jatuh_tempo:
                        dataTagihanSantri.tanggal_jatuh_tempo,
                        NOT: { id: dataTagihanSantri.id },
                    },
                });

                // Tentukan keterangan
                const bulan = tanggalBayar.getMonth() + 1;
                const keteranganTagihan =
                    keterangan ||
                    (nominal + totalPotongan < nominalTagihanAsli
                        ? `Cicilan ${duplicate.length + 1} ${
                            dataTagihanSantri.ref_jenis_tagihan_santri.nama
                        } bulan ${bulan} ${dataTagihanSantri.santri.nama}`
                        : `Pembayaran ${dataTagihanSantri.ref_jenis_tagihan_santri.nama} bulan ${bulan} ${dataTagihanSantri.santri.nama}`);

                // Update tagihan saat ini
                const updatedTagihan = await tx.data_tagihan_santri.update({
                    where: { id: parseInt(id) },
                    data: {
                        nominal: Number(nominal),
                        metode_pembayaran:
                            metode_pembayaran ||
                            dataTagihanSantri.metode_pembayaran,
                        nomor_referensi:
                            nomor_referensi ||
                            dataTagihanSantri.nomor_referensi,
                        tanggal_bayar: tanggalBayar,
                        keterangan: keteranganTagihan,
                        status:
                            nominal + totalPotongan >= nominalTagihanAsli
                                ? STATUS.TAGIHAN_LUNAS
                                : STATUS.TAGIHAN_BELUM_LUNAS, // 1 = Lunas, 2 = Belum Lunas
                        updated_at: tanggalBayar,
                        updated_by: created_by,
                    },
                });

                // Jika cicilan, buat tagihan baru untuk sisa nominal
                if (nominal + totalPotongan < nominalTagihanAsli) {
                    await tx.data_tagihan_santri.create({
                        data: {
                            id_santri: dataTagihanSantri.id_santri,
                            id_jenis_tagihan:
                            dataTagihanSantri.id_jenis_tagihan,
                            nominal:
                                nominalTagihanAsli -
                                (Number(nominal) + totalPotongan),
                            status: STATUS.TAGIHAN_BELUM_LUNAS, // Belum Lunas
                            tanggal_jatuh_tempo: tanggalJatuhTempo,
                            keterangan: `Sisa cicilan ${duplicate.length + 2} ${
                                dataTagihanSantri.ref_jenis_tagihan_santri.nama
                            } bulan ${bulan} ${dataTagihanSantri.santri.nama}`,
                            created_at: tanggalBayar,
                            created_by,
                        },
                    });
                }

                // Simpan potongan baru dari body API (jika ada)
                if (potongan.length > 0) {
                    await tx.data_tagihan_santri_potongan.createMany({
                        data: potongan.map((p) => ({
                            pembayaran_id: parseInt(id),
                            tipe: p.tipe,
                            nominal: Number(p.nominal),
                            id_status: STATUS.POTONGAN_APPLIED, // 17 = Di Setujui, 18 = Di Proses
                            keterangan:
                                p.keterangan ||
                                `Potongan ${p.tipe} untuk ${dataTagihanSantri.ref_jenis_tagihan_santri.nama}`,
                        })),
                    });
                }

                // Buat entri jurnal
                const jurnal = await tx.data_jurnal.create({
                    data: {
                        tanggal: tanggalBayar,
                        deskripsi: keteranganTagihan,
                        ref_type:
                        dataTagihanSantri.ref_jenis_tagihan_santri.nama,
                        ref_id: parseInt(id),
                        posted: true,
                        created_at: tanggalBayar,
                        updated_at: tanggalBayar,
                    },
                });

                // Buat entri transaksi keuangan
                const transaksiKeuangan = [];

                // Transaksi debet (Kas) jika ada pembayaran tunai
                if (nominal > 0) {
                    transaksiKeuangan.push({
                        tanggal: tanggalBayar,
                        nominal: Number(nominal),
                        keterangan: `Penerimaan ${keteranganTagihan}`,
                        no_referensi:
                            nomor_referensi || `TRX${tanggalBayar.getTime()}`,
                        status: "approved",
                        coa_id:
                            metode_pembayaran != "tunai"
                                ? COA.KAS_BANK
                                : COA.KAS, // Kas
                        jurnal_id: jurnal.id,
                        created_at: tanggalBayar,
                        updated_at: tanggalBayar,
                    });
                }

                // Transaksi kredit (Pendapatan SPP)
                transaksiKeuangan.push({
                    tanggal: tanggalBayar,
                    nominal: Number(nominal) + totalPotongan,
                    keterangan: `Pendapatan ${keteranganTagihan}`,
                    no_referensi:
                        nomor_referensi || `TRX${tanggalBayar.getTime()}`,
                    status: "approved",
                    coa_id: COA.PENDAPATAN_SPP, // Pendapatan SPP
                    jurnal_id: jurnal.id,
                    created_at: tanggalBayar,
                    updated_at: tanggalBayar,
                });

                // Transaksi kredit untuk potongan (jika ada beasiswa)
                for (const p of [...existingPotongan, ...potongan]) {
                    if (
                        [
                            "beasiswa_penuh",
                            "beasiswa_partial",
                            "beasiswa",
                        ].includes(p.tipe)
                    ) {
                        transaksiKeuangan.push({
                            tanggal: tanggalBayar,
                            nominal: Number(p.nominal),
                            keterangan: `Beasiswa ${p.tipe} untuk ${keteranganTagihan}`,
                            no_referensi:
                                nomor_referensi ||
                                `TRX${tanggalBayar.getTime()}`,
                            status: "approved",
                            coa_id: COA.PENDAPATAN_BEASISWA, // Pendapatan Beasiswa
                            jurnal_id: jurnal.id,
                            created_at: tanggalBayar,
                            updated_at: tanggalBayar,
                        });
                    }
                }

                await tx.data_transaksi_keuangan.createMany({
                    data: transaksiKeuangan,
                });

                // Update saldo COA
                const periode = `${tanggalBayar.getFullYear()}-${(
                    tanggalBayar.getMonth() + 1
                )
                    .toString()
                    .padStart(2, "0")}`;
                for (const transaksi of transaksiKeuangan) {
                    const coaSaldo = await tx.coa_saldo.findFirst({
                        where: { coa_id: transaksi.coa_id, periode },
                    });

                    if (coaSaldo) {
                        await tx.coa_saldo.update({
                            where: { id: coaSaldo.id },
                            data: {
                                saldo_debet:
                                    transaksi.coa_id === COA.KAS ||
                                    transaksi.coa_id === COA.KAS_BANK
                                        ? Number(coaSaldo.saldo_debet) +
                                        Number(transaksi.nominal)
                                        : coaSaldo.saldo_debet,
                                saldo_kredit:
                                    transaksi.coa_id !== COA.KAS ||
                                    transaksi.coa_id !== COA.KAS_BANK
                                        ? Number(coaSaldo.saldo_kredit) +
                                        Number(transaksi.nominal)
                                        : coaSaldo.saldo_kredit,
                            },
                        });
                    } else {
                        await tx.coa_saldo.create({
                            data: {
                                coa_id: transaksi.coa_id,
                                periode,
                                saldo_debet:
                                    transaksi.coa_id === COA.KAS ||
                                    transaksi.coa_id === COA.KAS_BANK
                                        ? Number(transaksi.nominal)
                                        : 0,
                                saldo_kredit:
                                    transaksi.coa_id !== COA.KAS ||
                                    transaksi.coa_id !== COA.KAS_BANK
                                        ? Number(transaksi.nominal)
                                        : 0,
                            },
                        });
                    }
                }

                return updatedTagihan;
            });

            return res.status(200).json({
                success: true,
                message: "Data tagihan santri berhasil dibayar",
                data: result,
            });
        } catch (error) {
            next(new AppError(error.message, error.statusCode || 500));
        }
    }

    static async allowAccessTallum(req, res, next) {
        try {
            const { nis_santri } = req.params;
            const santri = await prisma.data_santri.findFirst({
                where: {
                    nis_santri,
                },
            });

            if (!santri) {
                return next(new AppError("Santri tidak ditemukan", 404));
            }

            const tagihan = await prisma.data_tagihan_santri.findFirst({
                where: {
                    id_santri: santri.id,
                    status: STATUS.TAGIHAN_BELUM_LUNAS,
                },
                skip: 1,
            });

            if (!tagihan) {
                return res.status(200).json({
                    success: true,
                    message: "Tidak ada tagihan yang belum lunas",
                    data: {
                        allowed: true,
                    },
                });
            }

            const today = new Date();
            const tanggalJatuhTempo = new Date(tagihan.tanggal_jatuh_tempo);

            // get month as number
            // value of today.getMonth() is 0 for january, 1 for february, 2 for march, and so on
            // value of tanggalJatuhTempo.getMonth() is 0 for january, 1 for february, 2 for march, and so on

            // for example today is 25 may 2025 and tanggalJatuhTempo is 25 april 2025
            // today.getMonth() is 4
            // tanggalJatuhTempo.getMonth() is 3
            // tanggalJatuhTempo.getMonth() - today.getMonth() is 1
            // tanggalJatuhTempo.getMonth() - today.getMonth() > 1 is true

            if (tanggalJatuhTempo.getMonth() - today.getMonth() >= 2) {
                return res.status(200).json({
                    success: true,
                    message: "Santri tidak dapat mengakses tallum",
                    data: {
                        allowed: false,
                    },
                });
            }

            return res.status(200).json({
                success: true,
                message: "Santri dapat mengakses tallum",
                data: {
                    allowed: true,
                },
            }); // true or fals
        } catch (error) {
            next(new AppError(error.message, error.statusCode || 500));
        }
    }
}