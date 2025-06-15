import { prisma } from "../prisma.js";
import { getTokenPayload } from "../helpers.js";

export class RekapKehadiranController {
    static async getAll(req, res, next) {
        try {
            const { groupbyclass, class: className } = req.query;
            const { semester, tahunAjaran } = await getTokenPayload(req);

            // Validasi className dan ambil id_kelas jika diberikan
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

            // Buat where clause untuk data_rombel
            const whereClause = { id_tahun_ajaran: tahunAjaran.id };
            if (ref_kelas) {
                whereClause.id_kelas = ref_kelas.id;
            }

            // Ambil semua kategori status dengan tipe "status_izin_santri"
            const kategoriStatus = await prisma.ref_master_kategori.findMany({
                where: {
                    tipe: "status_izin_santri",
                },
                select: {
                    id: true,
                    nama: true,
                },
                orderBy: {
                    id: 'asc', // Pastikan urutan konsisten
                },
            });

            if (!kategoriStatus.length) {
                throw new Error('Tidak ada kategori status ditemukan');
            }

            // Ambil daftar rombel dan anggotanya
            const rombels = await prisma.data_rombel.findMany({
                where: whereClause,
                include: {
                    ref_kelas: true,
                    data_rombel_anggota: {
                        select: {
                            id_santri: true,
                        },
                    },
                },
            });


            if (!rombels.length) {
                throw new Error('Tidak ada rombel ditemukan');
            }

            let result = [];

            for (const rombel of rombels) {
                const santriIds = rombel.data_rombel_anggota.map(a => a.id_santri);
                console.log(rombel);

                // Ambil daftar santri
                const santriList = await prisma.santri.findMany({
                    where: {
                        id: { in: santriIds },
                    },
                    select: {
                        id: true,
                        nis: true,
                        nama: true,
                    },
                });

                // Ambil data kehadiran untuk santri di semester ini
                const kehadiranList = await prisma.data_kehadiran_santri.findMany({
                    where: {
                        id_semester: semester.id,
                        id_santri: { in: santriIds },
                    },
                    include: {
                        ref_master_kategori: {
                            select: {
                                id: true,
                                nama: true,
                            },
                        },
                    },
                });

                // Buat peta kehadiran per santri dan status
                const kehadiranMap = kehadiranList.reduce((acc, item) => {
                    if (!acc[item.id_santri]) acc[item.id_santri] = {};
                    acc[item.id_santri][item.id_status] = {
                        id_status: item.id_status,
                        nama_status: item.ref_master_kategori.nama,
                        jumlah: item.jumlah,
                    };
                    return acc;
                }, {});

                // Format data santri
                const formattedStudents = santriList.map(santri => {
                    const kehadiran = kategoriStatus.map(kategori => ({
                        id_status: kategori.id,
                        nama_status: kategori.nama,
                        jumlah: kehadiranMap[santri.id]?.[kategori.id]?.jumlah || null,
                    }));

                    return {
                        id_santri: santri.id,
                        nis: santri.nis,
                        nama: santri.nama,
                        kelas: rombel.ref_kelas.kelas,
                        kehadiran,
                    };
                });

                result.push({
                    class_id: rombel.id,
                    class: rombel.ref_kelas.kelas,
                    headers: kategoriStatus.map(k => ({
                        id: k.id,
                        nama: k.nama,
                    })),
                    students: formattedStudents,
                });
            }

            // Format response
            if (groupbyclass === 'true') {
                const sorted = result.map(r => ({
                    ...r,
                    students: r.students.sort((a, b) => a.nama.localeCompare(b.nama)),
                }));
                return res.status(200).json(sorted);
            } else {
                const flatList = result
                    .flatMap(r => r.students)
                    .sort((a, b) => a.nama.localeCompare(b.nama));
                return res.status(200).json({
                    headers: kategoriStatus.map(k => ({
                        id: k.id,
                        nama: k.nama,
                    })),
                    students: flatList,
                });
            }
        } catch (error) {
            console.error('Error fetching rekap kehadiran:', error);
            next(error);
        }
    }

    static async updateSingleKehadiran(req, res, next) {
        try {
            const { semester, tahunAjaran } = await getTokenPayload(req);
            const { id_santri, id_status, jumlah } = req.body;

            // Validasi input body
            if (!id_santri || !id_status || jumlah === undefined) {
                return res.status(400).json({ message: 'id_santri, id_status, dan jumlah wajib diisi' });
            }
            if (!Number.isInteger(jumlah) || jumlah < 0) {
                return res.status(400).json({ message: 'Jumlah harus berupa bilangan bulat tidak negatif' });
            }

            // Validasi kategori status
            const kategori = await prisma.ref_master_kategori.findUnique({
                where: {
                    id: id_status,
                    tipe: "status_izin_santri",
                },
                select: {
                    id: true,
                    nama: true,
                },
            });

            if (!kategori) {
                return res.status(404).json({ message: `Kategori status dengan id ${id_status} tidak valid atau bukan tipe status_izin_santri` });
            }

            // Ambil data santri untuk nama
            const santri = await prisma.santri.findUnique({
                where: { id: id_santri },
                select: { id: true, nama: true },
            });

            if (!santri) {
                return res.status(404).json({ message: `Santri dengan id ${id_santri} tidak ditemukan` });
            }

            // Proses update atau create dalam transaksi
            let operation = 'updated';
            await prisma.$transaction(async (tx) => {
                // Cek apakah data kehadiran sudah ada
                const existingKehadiran = await tx.data_kehadiran_santri.findFirst({
                    where: {
                        id_santri,
                        id_status,
                        id_semester: semester.id
                    },
                });

                if (existingKehadiran) {
                    // Update jika sudah ada
                    await tx.data_kehadiran_santri.update({
                        where: { id: existingKehadiran.id },
                        data: {
                            jumlah,
                        },
                    });
                } else {
                    // Buat baru jika belum ada
                    await tx.data_kehadiran_santri.create({
                        data: {
                            id_santri,
                            id_status,
                            id_semester: semester.id,
                            jumlah,
                        },
                    });
                    operation = 'created';
                }
            });

            // Kirim respons sukses
            return res.status(200).json({
                message: `Kehadiran untuk ${kategori.nama} berhasil ${operation === 'updated' ? 'diperbarui' : 'dibuat'}`,
                data: {
                    id_santri: santri.id,
                    nama_santri: santri.nama,
                    status: kategori.nama,
                    jumlah,
                },
            });
        } catch (error) {
            console.error('Error updating single kehadiran:', error);
            return res.status(500).json({ message: error.message || 'Terjadi kesalahan saat memproses data' });
        }
    }
}