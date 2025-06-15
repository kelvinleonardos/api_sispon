import { prisma } from "../prisma.js";
import {getTokenPayload} from "../helpers.js";

export class RosterController {
    static async createRoster(req, res, next) {
        try {
            const { id_kelas, hari, id_jam } = req.body;

            const currentClass = await prisma.data_kelas.findUnique({
                where: {
                    id: parseInt(id_kelas)
                },
            });

            const currentRombel = await prisma.data_rombel.findFirst({
                where: {
                    id: parseInt(currentClass.id_rombel)
                },
            });

            const rombelClassList = await prisma.data_kelas.findMany({
                where: {
                    id_rombel: currentRombel.id
                },
            });

            const existingRoster = await prisma.data_roster.findFirst({
                where: {
                    id_kelas: {
                        in: rombelClassList.map(rombel => rombel.id)
                    },
                    hari,
                    id_jam: parseInt(id_jam)
                }
            });

            if (existingRoster) {
                return res.status(400).json({
                    message: "Roster untuk kelas ini pada hari dan jam tersebut sudah ada",
                    data: existingRoster
                });
            }

            // Create the roster entry
            const newRoster = await prisma.data_roster.create({
                data: {
                    id_kelas: parseInt(id_kelas),
                    hari,
                    id_jam: parseInt(id_jam)
                }
            });

            return res.status(201).json({
                message: "Roster berhasil dibuat",
                data: newRoster
            });

        } catch (error) {
            next(error);
        }
    }

    static async getAllRoster(req, res, next) {
        try {
            const { decoded, semester, tahunAjaran } = await getTokenPayload(req);
            const { groupBy, class: className, day } = req.query;

            // Define all possible days and time slots to ensure complete data
            const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Ahad'];
            const timeSlots = await prisma.ref_jam_pelajaran.findMany({
                orderBy: { jam_ke: 'asc' }
            });

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

            // Fetch all rombels for the semester and year
            const rombels = await prisma.data_rombel.findMany({
                where: {
                    id_tahun_ajaran: semester.id_tahun_ajaran,
                    id_kelas: ref_kelas ? parseInt(ref_kelas.id) : undefined
                },
                include: {
                    ref_master_kategori: true,
                    ref_kelas: {
                        include: {
                            ref_tingkat: {
                                include: {
                                    ref_jenjang: true
                                }
                            }
                        }
                    }
                },
                orderBy: [
                    { ref_kelas: { id_tingkat: 'asc' } },
                    { ref_kelas: { urutan: 'asc' } }
                ]
            });

            // Map rombels to a simpler structure
            const mappedRombels = rombels.map((rombel) => {
                const { nama, ref_master_kategori, ref_kelas, ...rest } = rombel;
                return {
                    ...rest,
                    status: ref_master_kategori.nama,
                    kelas: ref_kelas.kelas,
                    id_jenjang: ref_kelas.ref_tingkat.id_jenjang,
                };
            });

            // Base query for rosters with semester and rombel filter
            const whereClause = {
                data_kelas: {
                    id_semester: semester.id,
                    id_rombel: {
                        in: mappedRombels.map(r => r.id)
                    }
                }
            };

            if (groupBy === 'day') {
                // Group by day: x-axis = time slots, y-axis = rombels
                const rosters = await prisma.data_roster.findMany({
                    where: whereClause,
                    include: {
                        ref_jam_pelajaran: {
                            include: {
                                ref_jenjang: true
                            }
                        },
                        data_kelas: {
                            include: {
                                data_rombel: {
                                    include: {
                                        ref_master_kategori: true,
                                        ref_kelas: {
                                            include: {
                                                ref_tingkat: {
                                                    include: {
                                                        ref_jenjang: true
                                                    }
                                                }
                                            }
                                        }
                                    }
                                },
                                ref_mapel: {
                                    include: {
                                        guru_pegawai: true
                                    }
                                }
                            }
                        }
                    },
                    orderBy: [
                        { hari: 'asc' },
                        { id_jam: 'asc' }
                    ]
                });

                // Structure data: rombels on y-axis, time slots on x-axis
                const result = mappedRombels.map(rombel => {
                    // Ambil hanya slot yang sesuai jenjang
                    const filteredTimeSlots = timeSlots.filter(slot => slot.id_jenjang === rombel.id_jenjang);

                    // Mapping data roster berdasarkan slot yang sesuai jenjang
                    const rombelData = filteredTimeSlots.map(slot => {
                        const roster = rosters.find(r =>
                            r.data_kelas.id_rombel === rombel.id &&
                            r.hari === day &&
                            r.id_jam === slot.id &&
                            r.data_kelas.data_rombel.ref_kelas.ref_tingkat.id_jenjang === rombel.id_jenjang
                        );

                        const simplifiedRoster = roster ? {
                            id_jam: roster.id_jam,
                            id_roster: roster.id,
                            mapel: roster.data_kelas.ref_mapel.nama,
                            guru: roster.data_kelas.ref_mapel.guru_pegawai.nama_gp
                        } : null;

                        return simplifiedRoster;
                    });

                    return {
                        rombel: {
                            id: rombel.id,
                            status: rombel.status,
                            kelas: rombel.kelas
                        },
                        timeSlots: filteredTimeSlots.map(slot => ({
                            id_jam: slot.id,
                            jam_ke: slot.jam_ke,
                            jam: `${slot.jam_mulai.getHours().toString().padStart(2, '0')}:${slot.jam_mulai.getMinutes().toString().padStart(2, '0')} - ${slot.jam_selesai.getHours().toString().padStart(2, '0')}:${slot.jam_selesai.getMinutes().toString().padStart(2, '0')}`
                        })),
                        data: rombelData
                    };
                });


                return res.status(200).json({
                    groupBy: 'day',
                    data: result
                });

            } else if (groupBy === 'class') {
                // Group by class: x-axis = time slots, y-axis = days (per rombel)
                const rosters = await prisma.data_roster.findMany({
                    where: whereClause,
                    include: {
                        ref_jam_pelajaran: true,
                        data_kelas: {
                            include: {
                                data_rombel: {
                                    include: {
                                        ref_master_kategori: true,
                                        ref_kelas: {
                                            include: {
                                                ref_tingkat: {
                                                    include: {
                                                        ref_jenjang: true
                                                    }
                                                }
                                            }
                                        }
                                    }
                                },
                                ref_mapel: {
                                    include: {
                                        guru_pegawai: true
                                    }
                                }
                            }
                        }
                    },
                    orderBy: [
                        { hari: 'asc' },
                        { id_jam: 'asc' }
                    ]
                });

                // Structure data: group by rombel, then days on y-axis, time slots on x-axis
                const result = mappedRombels.map(rombel => {
                    const rombelData = days.map(day => {
                        const dayData = timeSlots
                            .filter(slot => slot.id_jenjang === rombel.id_jenjang) // ambil slot yg cocok dgn jenjang rombel
                            .map(slot => {
                                const roster = rosters.find(r =>
                                    r.hari === day &&
                                    r.id_jam === slot.id &&
                                    r.data_kelas.id_rombel === rombel.id &&
                                    r.data_kelas.data_rombel.ref_kelas.ref_tingkat.id_jenjang === rombel.id_jenjang
                                );

                                return roster ? {
                                    id_jam: roster.id_jam,
                                    id_roster: roster.id,
                                    mapel: roster.data_kelas.ref_mapel.nama,
                                    guru: roster.data_kelas.ref_mapel.guru_pegawai.nama_gp
                                } : null;
                            });

                        return {
                            day,
                            timeSlots: dayData
                        };
                    });

                    return {
                        rombel: {
                            id: rombel.id,
                            status: rombel.status,
                            kelas: rombel.kelas
                        },
                        timeSlots: timeSlots
                            .filter(slot => slot.id_jenjang === rombel.id_jenjang)
                            .map(slot => ({
                                id_jam: slot.id,
                                jam_ke: slot.jam_ke,
                                jam: `${slot.jam_mulai.getHours().toString().padStart(2, '0')}:${slot.jam_mulai.getMinutes().toString().padStart(2, '0')} - ${slot.jam_selesai.getHours().toString().padStart(2, '0')}:${slot.jam_selesai.getMinutes().toString().padStart(2, '0')}`
                            })),
                        data: rombelData
                    };
                });

                return res.status(200).json({
                    groupBy: 'class',
                    data: result
                });
            }

            return res.status(400).json({ error: "Invalid groupBy parameter" });

        } catch (error) {
            console.log(error);
            next(error);
        }
    }

    // Additional method for filtered class view (table per rombel, similar to the image)
    static async getRosterByClassAndDay(req, res, next) {
        try {
            const { decoded, semester, tahunAjaran } = await getTokenPayload(req);
            const { class: classId } = req.query;

            if (!classId) {
                return res.status(400).json({ error: "Class ID is required" });
            }

            // Define all possible days and time slots
            const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Ahad'];
            const timeSlots = await prisma.ref_jam_pelajaran.findMany({
                orderBy: { id: 'asc' }
            });

            // Fetch rosters for the specific class and semester
            const rosters = await prisma.data_roster.findMany({
                where: {
                    id_kelas: parseInt(classId),
                    data_kelas: {
                        id_semester: semester.id,
                    }
                },
                include: { ref_jam_pelajaran: true },
                orderBy: [
                    { hari: 'asc' },
                    { id_jam: 'asc' }
                ]
            });

            // Structure data: table per class group, days on y-axis, time slots on x-axis
            const result = days.map(day => {
                const dayData = timeSlots.map(slot => {
                    const roster = rosters.find(r =>
                        r.hari === day &&
                        r.id_jam === slot.id
                    );
                    return roster || null; // Return null if no data for this slot
                });
                return {
                    day,
                    timeSlots: dayData
                };
            });

            return res.status(200).json({
                classId,
                timeSlots: timeSlots.map(slot => slot.id),
                data: result
            });

        } catch (error) {
            next(error);
        }
    }

    static async getRosterById(req, res, next) {
        try {
            const { id } = req.params;
            const roster = await prisma.data_roster.findUnique({
                where: { id: parseInt(id) },
                include: {
                    ref_jam_pelajaran: {
                        include: {
                            ref_jenjang: true
                        }
                    },
                    data_kelas: {
                        include: {
                            data_rombel: {
                                include: {
                                    ref_master_kategori: true,
                                    ref_kelas: true
                                }
                            },
                            ref_mapel: {
                                include: {
                                    guru_pegawai: true
                                }
                            }
                        }
                    }
                }
            });

            const simplifiedRoster = {
                id_roster: roster.id,
                id_jam: roster.id_jam,
                id_kelas: roster.id_kelas,
                hari: roster.hari,
                jenjang: roster.ref_jam_pelajaran.ref_jenjang.jenjang,
                jam: `${roster.ref_jam_pelajaran.jam_mulai.getHours().toString().padStart(2, '0')}:${roster.ref_jam_pelajaran.jam_mulai.getMinutes().toString().padStart(2, '0')} - ${roster.ref_jam_pelajaran.jam_selesai.getHours().toString().padStart(2, '0')}:${roster.ref_jam_pelajaran.jam_selesai.getMinutes().toString().padStart(2, '0')}`,
                kelas: `${roster.data_kelas.ref_mapel.nama} - ${roster.data_kelas.ref_mapel.guru_pegawai.nama_gp}`,
            };

            res.status(200).json(simplifiedRoster);
        } catch (e) {
            next(e);
        }
    }

    static async updateRoster(req, res, next) {}

    static async deleteRoster(req, res, next) {}
}