import { AppError } from "../middleware/errorHandler.js";
import { prisma } from "../prisma.js";

const STATUS = {
    TAGIHAN_BELUM_LUNAS: 17, //BELUM LUNAS
    TAGIHAN_LUNAS: 18, //LUNAS
    POTONGAN_APPLIED: 17, //DISETUJUI
    POTONGAN_PENDING: 18, //DIPROSES
};

const COA = {
    KAS: 1,
    KAS_BANK: 2,
    KOPERASI: 25,
    DONASI: 26,
    PENJUALAN: 27,
    INVESTASI: 28,
};

export class PendapatanLainController {
    static getAllPendapatanLain = async (req, res, next) => {
        try {
            const pendapatan = await prisma.data_pendapatan_lain.findMany({
                include: {
                    ref_master_kategori_data_pendapatan_lain_id_jenisToref_master_kategori: true,
                    ref_master_kategori_data_pendapatan_lain_id_statusToref_master_kategori: true,
                },
            });

            return res.status(200).json({
                success: true,
                message: "Data pendapatan lain berhasil diambil",
                data: pendapatan,
            });
        } catch (error) {
            next(new AppError(error.message, 500));
        }
    };

    static createPendapatanLain = async (req, res, next) => {
        try {
            const {
                id_jenis,
                tanggal,
                nominal,
                metode_pembayaran,
                keterangan,
                nomor_referensi,
            } = req.body;

            const jenis = await prisma.ref_master_kategori.findUnique({
                where: {
                    id: id_jenis,
                },
            });

            if (!jenis) {
                return next(new AppError("Jenis pendapatan tidak ditemukan", 404));
            }
            const createdPendapatan = await prisma.$transaction(async (prisma) => {
                const pendapatan = await prisma.data_pendapatan_lain.create({
                    data: {
                        id_jenis,
                        tanggal,
                        nominal,
                        id_status: STATUS.TAGIHAN_LUNAS,
                        metode_pembayaran,
                        keterangan,
                        nomor_referensi,
                    },
                });

                const jurnal = await prisma.data_jurnal.create({
                    data: {
                        tanggal,
                        deskripsi: pendapatan.keterangan,
                        ref_type: jenis.nama,
                        ref_id: pendapatan.id,
                        posted: 1,
                        // debit: nominal,
                        // kredit: 0
                    },
                });

                const transaksiKeuangan = [];

                let coa;
                let newKeterangan = `Penerimaan ${jenis.nama}`;
                switch (jenis.nama) {
                    case "koperasi":
                        coa = COA.KOPERASI;
                        break;
                    case "donasi":
                        coa = COA.DONASI;
                        break;
                    case "penjualan":
                        coa = COA.PENJUALAN;
                        break;
                    case "investasi":
                        coa = COA.INVESTASI;
                        break;
                    default:
                        return next(new AppError(`Jenis pendapatan '${jenis.nama}' tidak valid`, 400));
                }
                transaksiKeuangan.push({
                    tanggal: tanggal,
                    nominal: Number(nominal),
                    keterangan: newKeterangan,
                    no_referensi:
                        nomor_referensi || `TRX${tanggal.getTime()}`,
                    status: "approved",
                    coa_id:
                        metode_pembayaran !== "tunai" ? COA.KAS_BANK : COA.KAS, // Kas
                    jurnal_id: jurnal.id,
                    created_at: tanggal,
                    updated_at: tanggal,
                });

                transaksiKeuangan.push({
                    tanggal: tanggal,
                    nominal: Number(nominal),
                    keterangan: `Pendapatan ${newKeterangan}`,
                    no_referensi:
                        nomor_referensi || `TRX${tanggal.getTime()}`,
                    status: "approved",
                    coa_id: coa,
                    jurnal_id: jurnal.id,
                    created_at: tanggal,
                    updated_at: tanggal,
                });

                await prisma.data_transaksi_keuangan.createMany({
                    data: transaksiKeuangan,
                });
            });

            return res.status(201).json({
                success: true,
                message: "Data pendapatan lain berhasil ditambahkan",
                data: createdPendapatan,
            });
        } catch (error) {
            return next(new AppError(error.message, 500));
        }
    };
}