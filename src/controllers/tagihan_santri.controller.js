// import { AppError } from "../middleware/errorHandler.js";
// import { prisma } from "../prisma.js";
// import { ref_jenis_tagihan_frekuensi } from "@prisma/client";
//
// export class tagihanSantriController {
//     static frekuensiTypes = Object.values(ref_jenis_tagihan_frekuensi);
//
//     static getJenisTagihan = async (req, res, next) => {
//         try {
//             const jenis_bayar_santri =
//                 await prisma.ref_jenis_tagihan_santri.findMany();
//             return res.status(200).json({
//                 success: true,
//                 message: "jenis tagihan berhasil diambil",
//                 data: jenis_bayar_santri,
//             });
//         } catch (error) {
//             next(new AppError(error.message, 500));
//         }
//     };
//
//     static createJenisTagihanSantri = async (req, res, next) => {
//         try {
//             const { nama, deskripsi, frekuensi, wajib } = req.body;
//
//
//             const jenisByrSantri = await prisma.ref_jenis_tagihan_santri.create(
//                 {
//                     data: {
//                         nama,
//                         deskripsi,
//                         frekuensi,
//                         is_mandatory: wajib,
//                     },
//                 }
//             );
//
//             res.status(201).json(jenisByrSantri);
//         } catch (error) {
//             next(new AppError(error.message, 500));
//         }
//     };
//
//     static updateJenisTagihanSantri = async (req, res, next) => {
//         try {
//             const { id } = req.params;
//             const { nama, deskripsi, frekuensi, wajib } = req.body;
//
//
//             const jenisByrSantri = await prisma.ref_jenis_tagihan_santri.update(
//                 {
//                     where: {
//                         id: parseInt(id),
//                     },
//                     data: {
//                         nama,
//                         deskripsi,
//                         frekuensi,
//                         is_mandatory: wajib,
//                     },
//                 }
//             );
//
//             res.status(200).json(jenisByrSantri);
//         } catch (error) {
//             next(new AppError(error.message, 500));
//         }
//     };
//
//     static deleteJenisTagihanSantri = async (req, res, next) => {
//         try {
//             const { id } = req.params;
//             // console.log("id", id);
//
//             // if (!id || isNaN(parseInt(id))) {
//             //     return next(new AppError("ID tidak valid", 400));
//             // }
//
//             const jenisByrSantri = await prisma.ref_jenis_tagihan_santri.delete(
//                 {
//                     where: {
//                         id: parseInt(id),
//                     },
//                 }
//             );
//
//             res.status(200).json(jenisByrSantri);
//         } catch (error) {
//             next(new AppError(error.message, 500));
//         }
//     };
// }