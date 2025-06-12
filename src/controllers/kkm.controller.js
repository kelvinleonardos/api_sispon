import { prisma } from "../prisma.js";

export class KkmDetailController {
    static createKkmDetail = async (req, res, next) => {
        try {
            const { mapel_id, kkm, tingkat_id } = req.body;

            // Validate required fields
            if (!mapel_id || !kkm || !tingkat_id) {
                return res.status(400).json({
                    success: false,
                    message: "mapel_id, kkm, and tingkat_id are required"
                });
            }

            // Validate mapel_id
            const mapel = await prisma.ref_mapel.findUnique({
                where: { id: parseInt(mapel_id) }
            });
            if (!mapel) {
                return res.status(404).json({
                    success: false,
                    message: "Mapel not found"
                });
            }

            // Validate tingkat_id
            const tingkat = await prisma.ref_tingkat.findUnique({
                where: { id: parseInt(tingkat_id) }
            });
            if (!tingkat) {
                return res.status(404).json({
                    success: false,
                    message: "Tingkat not found"
                });
            }

            // Check if KKM already exists for this mapel and tingkat
            const existingKkm = await prisma.data_kkm_detail.findFirst({
                where: {
                    mapel_id: parseInt(mapel_id),
                    tingkat_id: parseInt(tingkat_id)
                }
            });
            if (existingKkm) {
                return res.status(400).json({
                    success: false,
                    message: "KKM for this mapel and tingkat already exists"
                });
            }

            const newKkmDetail = await prisma.data_kkm_detail.create({
                data: {
                    mapel_id: parseInt(mapel_id),
                    kkm: parseInt(kkm),
                    tingkat_id: parseInt(tingkat_id)
                }
            });

            res.status(201).json({
                message: "Berhasil menambahkan KKM",
                data: newKkmDetail
            });
        } catch (error) {
            next(error);
        }
    };

    static getAllKkmDetail = async (req, res, next) => {
        try {
            const kkmDetails = await prisma.data_kkm_detail.findMany({
                include: {
                    ref_mapel: true,
                    ref_tingkat: true
                }
            });

            const formattedKkmDetails = kkmDetails.map(kkm => ({
                id: kkm.id,
                mapel_id: kkm.mapel_id,
                mapel_nama: kkm.ref_mapel?.nama || null,
                kkm: kkm.kkm,
                tingkat_id: kkm.tingkat_id,
                tingkat_nama: kkm.ref_tingkat?.nama || null
            }));

            res.json(formattedKkmDetails);
        } catch (error) {
            next(error);
        }
    };

    static getKkmDetailById = async (req, res, next) => {
        try {
            const { id } = req.params;

            const kkmDetail = await prisma.data_kkm_detail.findUnique({
                where: { id: parseInt(id) },
                include: {
                    ref_mapel: true,
                    ref_tingkat: true
                }
            });

            if (!kkmDetail) {
                return res.status(404).json({
                    success: false,
                    message: "KKM Detail not found"
                });
            }

            res.json({
                id: kkmDetail.id,
                mapel_id: kkmDetail.mapel_id,
                mapel_nama: kkmDetail.ref_mapel?.nama || null,
                kkm: kkmDetail.kkm,
                tingkat_id: kkmDetail.tingkat_id,
                tingkat_nama: kkmDetail.ref_tingkat?.nama || null
            });
        } catch (error) {
            next(error);
        }
    };

    static updateKkmDetail = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { mapel_id, kkm, tingkat_id } = req.body;

            // Check if KKM Detail exists
            const existingKkmDetail = await prisma.data_kkm_detail.findUnique({
                where: { id: parseInt(id) }
            });

            if (!existingKkmDetail) {
                return res.status(404).json({
                    success: false,
                    message: "KKM Detail not found"
                });
            }

            // Validate mapel_id if provided
            if (mapel_id) {
                const mapel = await prisma.ref_mapel.findUnique({
                    where: { id: parseInt(mapel_id) }
                });
                if (!mapel) {
                    return res.status(404).json({
                        success: false,
                        message: "Mapel not found"
                    });
                }
            }

            // Validate tingkat_id if provided
            if (tingkat_id) {
                const tingkat = await prisma.ref_tingkat.findUnique({
                    where: { id: parseInt(tingkat_id) }
                });
                if (!tingkat) {
                    return res.status(404).json({
                        success: false,
                        message: "Tingkat not found"
                    });
                }
            }

            // Check for duplicate KKM if mapel_id or tingkat_id is updated
            if (mapel_id || tingkat_id) {
                const newMapelId = mapel_id ? parseInt(mapel_id) : existingKkmDetail.mapel_id;
                const newTingkatId = tingkat_id ? parseInt(tingkat_id) : existingKkmDetail.tingkat_id;

                const duplicateKkm = await prisma.data_kkm_detail.findFirst({
                    where: {
                        mapel_id: newMapelId,
                        tingkat_id: newTingkatId,
                        NOT: { id: parseInt(id) }
                    }
                });

                if (duplicateKkm) {
                    return res.status(400).json({
                        success: false,
                        message: "KKM for this mapel and tingkat already exists"
                    });
                }
            }

            const updatedKkmDetail = await prisma.data_kkm_detail.update({
                where: { id: parseInt(id) },
                data: {
                    mapel_id: mapel_id ? parseInt(mapel_id) : undefined,
                    kkm: kkm ? parseInt(kkm) : undefined,
                    tingkat_id: tingkat_id ? parseInt(tingkat_id) : undefined
                }
            });

            res.json({
                message: "Berhasil memperbarui KKM",
                data: updatedKkmDetail
            });
        } catch (error) {
            next(error);
        }
    };

    static deleteKkmDetail = async (req, res, next) => {
        try {
            const { id } = req.params;

            // Check if KKM Detail exists
            const existingKkmDetail = await prisma.data_kkm_detail.findUnique({
                where: { id: parseInt(id) }
            });

            if (!existingKkmDetail) {
                return res.status(404).json({
                    success: false,
                    message: "KKM Detail not found"
                });
            }

            await prisma.data_kkm_detail.delete({
                where: { id: parseInt(id) }
            });

            res.json({
                success: true,
                message: "KKM berhasil dihapus"
            });
        } catch (error) {
            next(error);
        }
    };
}