import { prisma } from "../prisma.js";
import {getTokenPayload} from "../helpers.js";

export class JamPelajaranController {
    static async createJamPelajaran(req, res, next) {
        try {
            const { decoded, semester, tahunAjaran, user } = await getTokenPayload(req);
            const { jam_ke, jam_mulai, jam_selesai, id_jenjang } = req.body;

            if (!jam_ke || !jam_mulai || !jam_selesai || !id_jenjang) {
                return res.status(400).json({
                    message: 'jam_ke, jam_mulai, jam_selesai, dan id_jenjang wajib diisi',
                });
            }

            const parsedJamKe = parseInt(jam_ke);
            const parsedIdJenjang = parseInt(id_jenjang);

            if (isNaN(parsedJamKe) || isNaN(parsedIdJenjang)) {
                return res.status(400).json({
                    message: 'jam_ke dan id_jenjang harus berupa angka yang valid',
                });
            }

            if (parsedJamKe < 1) {
                return res.status(400).json({
                    message: 'jam_ke harus berupa bilangan bulat positif',
                });
            }

            // Validate time format (expecting HH:mm or HH:mm:ss)
            const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
            if (!timeRegex.test(jam_mulai) || !timeRegex.test(jam_selesai)) {
                return res.status(400).json({
                    message: 'jam_mulai dan jam_selesai harus dalam format HH:mm atau HH:mm:ss',
                });
            }

            const startTime = new Date(`1970-01-01T${jam_mulai}:00Z`);
            const endTime = new Date(`1970-01-01T${jam_selesai}:00Z`);
            if (endTime <= startTime) {
                return res.status(400).json({
                    message: 'jam_selesai harus lebih besar dari jam_mulai',
                });
            }

            // 2. Check if jenjang exists
            const jenjang = await prisma.ref_jenjang.findUnique({
                where: { id: parsedIdJenjang },
            });
            if (!jenjang) {
                return res.status(404).json({
                    message: 'Jenjang tidak ditemukan',
                });
            }

            // 3. Check for duplicate jam_ke in the same jenjang
            const existingJam = await prisma.ref_jam_pelajaran.findFirst({
                where: {
                    jam_ke: parsedJamKe,
                    id_jenjang: parsedIdJenjang,
                },
            });
            if (existingJam) {
                return res.status(400).json({
                    message: 'Jam pelajaran dengan jam_ke dan jenjang yang sama sudah ada',
                });
            }

            // 4. Create jam pelajaran
            const jamPelajaran = await prisma.ref_jam_pelajaran.create({
                data: {
                    jam_ke: parsedJamKe,
                    jam_mulai: startTime,
                    jam_selesai: endTime,
                    id_jenjang: parsedIdJenjang,
                },
            });

            // 5. Success response
            res.status(201).json({
                message: 'Jam pelajaran berhasil ditambahkan',
                data: jamPelajaran,
            });
        } catch (error) {
            next(error);
        }
    }

    static async getAllJamPelajaran(req, res, next) {
        try {
            const jamPelajaran = await prisma.ref_jam_pelajaran.findMany({
                include: {
                    ref_jenjang: true
                },
                orderBy: {
                    jam_ke: 'asc',
                },
            });

            console.log(jamPelajaran);

            const flatJamPelajaran = jamPelajaran.map((item) => ({
                id: item.id,
                jam_ke: item.jam_ke,
                jam_mulai: item.jam_mulai.toISOString().substring(11, 16), // Format HH:mm
                jam_selesai: item.jam_selesai.toISOString().substring(11, 16), // Format HH:mm
                id_jenjang: item.id_jenjang,
                jenjang: item.ref_jenjang.jenjang,
            }));

            res.status(200).json(flatJamPelajaran);
        } catch (error) {
            next(error);
        }
    }

    static async getJamPelajaranById(req, res, next) {
        try {
            const { id } = req.params;
            const parsedId = parseInt(id);

            if (isNaN(parsedId)) {
                return res.status(400).json({
                    message: 'ID jam pelajaran tidak valid',
                });
            }

            const jamPelajaran = await prisma.ref_jam_pelajaran.findUnique({
                where: { id: parsedId },
                include: {
                    ref_jenjang: true,
                },
            });

            if (!jamPelajaran) {
                return res.status(404).json({
                    message: 'Jam pelajaran tidak ditemukan',
                });
            }

            const flatJamPelajaran = {
                id: jamPelajaran.id,
                jam_ke: jamPelajaran.jam_ke,
                jam_mulai: jamPelajaran.jam_mulai.toISOString().substring(11, 16), // Format HH:mm
                jam_selesai: jamPelajaran.jam_selesai.toISOString().substring(11, 16), // Format HH:mm
                id_jenjang: jamPelajaran.id_jenjang,
                jenjang: jamPelajaran.ref_jenjang.jenjang,
            };

            res.status(200).json(flatJamPelajaran);
        } catch (error) {
            next(error);
        }
    }

    static async updateJamPelajaran(req, res, next) {
        try {
            const { id } = req.params;
            const { jam_ke, jam_mulai, jam_selesai, id_jenjang } = req.body;

            // 1. Input validation
            const parsedId = parseInt(id);
            if (isNaN(parsedId)) {
                return res.status(400).json({
                    message: 'ID jam pelajaran tidak valid',
                });
            }

            if (jam_ke !== undefined && (isNaN(parseInt(jam_ke)) || parseInt(jam_ke) < 1)) {
                return res.status(400).json({
                    message: 'jam_ke harus berupa bilangan bulat positif',
                });
            }

            if (id_jenjang !== undefined && isNaN(parseInt(id_jenjang))) {
                return res.status(400).json({
                    message: 'id_jenjang harus berupa angka yang valid',
                });
            }

            if (jam_mulai !== undefined || jam_selesai !== undefined) {
                const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
                if ((jam_mulai && !timeRegex.test(jam_mulai)) || (jam_selesai && !timeRegex.test(jam_selesai))) {
                    return res.status(400).json({
                        message: 'jam_mulai dan jam_selesai harus dalam format HH:mm atau HH:mm:ss',
                    });
                }

                const startTime = jam_mulai ? new Date(`1970-01-01T${jam_mulai}:00Z`) : null;
                const endTime = jam_selesai ? new Date(`1970-01-01T${jam_selesai}:00Z`) : null;
                if (startTime && endTime && endTime <= startTime) {
                    return res.status(400).json({
                        message: 'jam_selesai harus lebih besar dari jam_mulai',
                    });
                }
            }

            // 2. Check if jam pelajaran exists
            const existingJamPelajaran = await prisma.ref_jam_pelajaran.findUnique({
                where: { id: parsedId },
            });

            if (!existingJamPelajaran) {
                return res.status(404).json({
                    message: 'Jam pelajaran tidak ditemukan',
                });
            }

            // 3. Check if jenjang exists (if provided)
            let parsedIdJenjang = id_jenjang !== undefined ? parseInt(id_jenjang) : existingJamPelajaran.id_jenjang;
            if (id_jenjang !== undefined) {
                const jenjang = await prisma.ref_jenjang.findUnique({
                    where: { id: parsedIdJenjang },
                });
                if (!jenjang) {
                    return res.status(404).json({
                        message: 'Jenjang tidak ditemukan',
                    });
                }
            }

            // 4. Check for duplicate jam_ke in the same jenjang (if provided)
            if (jam_ke !== undefined || id_jenjang !== undefined) {
                const parsedJamKe = jam_ke !== undefined ? parseInt(jam_ke) : existingJamPelajaran.jam_ke;
                const duplicateJam = await prisma.ref_jam_pelajaran.findFirst({
                    where: {
                        jam_ke: parsedJamKe,
                        id_jenjang: parsedIdJenjang,
                        NOT: { id: parsedId },
                    },
                });
                if (duplicateJam) {
                    return res.status(400).json({
                        message: 'Jam pelajaran dengan jam_ke dan jenjang yang sama sudah ada',
                    });
                }
            }

            // 5. Prepare update data
            const updateData = {
                jam_ke: jam_ke !== undefined ? parseInt(jam_ke) : existingJamPelajaran.jam_ke,
                jam_mulai: jam_mulai ? new Date(`1970-01-01T${jam_mulai}:00Z`) : existingJamPelajaran.jam_mulai,
                jam_selesai: jam_selesai ? new Date(`1970-01-01T${jam_selesai}:00Z`) : existingJamPelajaran.jam_selesai,
                id_jenjang: id_jenjang !== undefined ? parseInt(id_jenjang) : existingJamPelajaran.id_jenjang,
            };

            // 6. Update jam pelajaran
            const updatedJamPelajaran = await prisma.ref_jam_pelajaran.update({
                where: { id: parsedId },
                data: updateData,
                include: {
                    ref_jenjang: true,
                },
            });

            // 7. Success response
            const flatUpdatedJamPelajaran = {
                id: updatedJamPelajaran.id,
                jam_ke: updatedJamPelajaran.jam_ke,
                jam_mulai: updatedJamPelajaran.jam_mulai.toISOString().substring(11, 16),
                jam_selesai: updatedJamPelajaran.jam_selesai.toISOString().substring(11, 16),
                id_jenjang: updatedJamPelajaran.id_jenjang,
                jenjang: updatedJamPelajaran.ref_jenjang.nama,
            };

            res.status(200).json({
                message: 'Jam pelajaran berhasil diperbarui',
                data: flatUpdatedJamPelajaran,
            });
        } catch (error) {
            next(error);
        }
    }

    static async deleteJamPelajaran(req, res, next) {
        try {
            const { id } = req.params;
            const parsedId = parseInt(id);

            // 1. Input validation
            if (isNaN(parsedId)) {
                return res.status(400).json({
                    message: 'ID jam pelajaran tidak valid',
                });
            }

            // 2. Check if jam pelajaran exists
            const jamPelajaran = await prisma.ref_jam_pelajaran.findUnique({
                where: { id: parsedId },
            });

            if (!jamPelajaran) {
                return res.status(404).json({
                    message: 'Jam pelajaran tidak ditemukan',
                });
            }

            // 3. Check for related data_roster
            const relatedRoster = await prisma.data_roster.findFirst({
                where: { id_jam: parsedId },
            });

            if (relatedRoster) {
                return res.status(400).json({
                    message: 'Jam pelajaran tidak dapat dihapus karena memiliki roster terkait',
                });
            }

            // 4. Delete jam pelajaran
            await prisma.ref_jam_pelajaran.delete({
                where: { id: parsedId },
            });

            // 5. Success response
            res.status(200).json({
                message: 'Jam pelajaran berhasil dihapus',
            });
        } catch (error) {
            next(error);
        }
    }
}