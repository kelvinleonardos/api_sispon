import { prisma } from '../prisma.js';
import mysql from 'mysql2/promise';

/*
Master Kategori Ref Semester:
- 11 = Aktif
- 12 = Inaktif
*/

export class SemesterController {
  // Fungsi baru untuk mengenerate opsi tahun ajaran 5 tahun ke depan
  static getTahunAjaranOptions = async (req, res, next) => {
    try {
      const currentYear = new Date().getFullYear();
      const tahunAjaranOptions = [];

      // Generate tahun ajaran untuk 5 tahun ke depan
      for (let i = 0; i < 5; i++) {
        const tahunMulai = currentYear + i;
        const tahunSelesai = tahunMulai + 1;
        const nama = `${tahunMulai}/${tahunSelesai}`;

        // Cek apakah tahun ajaran sudah ada di database, jika belum buat
        let tahunAjaran = await prisma.ref_tahun_ajaran.findFirst({
          where: {
            tahun_mulai: tahunMulai,
            tahun_selesai: tahunSelesai,
          },
        });

        if (!tahunAjaran) {
          tahunAjaran = await prisma.ref_tahun_ajaran.create({
            data: {
              nama,
              tahun_mulai: tahunMulai,
              tahun_selesai: tahunSelesai,
              id_master_kategori_status_ref_tahun_ajaran: 12, // Default inaktif
            },
          });
        }

        tahunAjaranOptions.push({
          id: tahunAjaran.id,
          nama: tahunAjaran.nama,
          tahun_mulai: tahunAjaran.tahun_mulai,
          tahun_selesai: tahunAjaran.tahun_selesai,
        });
      }

      res.status(200).json(tahunAjaranOptions);
    } catch (error) {
      res.status(500).json({
        message: 'Failed to fetch tahun ajaran options',
        error: error.message,
      });
    }
  };

  static createSemester = async (req, res, next) => {
    try {
      // 1. Input validation
      const { id_tahun_ajaran, urutan, status = 16 } = req.body;

      if (!id_tahun_ajaran || !urutan) {
        return res.status(400).json({
          message: 'id_tahun_ajaran and urutan are required',
        });
      }

      const parsedIdTahunAjaran = parseInt(id_tahun_ajaran);
      const parsedUrutan = parseInt(urutan);
      const parsedStatus = parseInt(status);

      if (
          isNaN(parsedIdTahunAjaran) ||
          isNaN(parsedUrutan) ||
          isNaN(parsedStatus)
      ) {
        return res.status(400).json({
          message: 'id_tahun_ajaran, urutan, and status must be valid numbers',
        });
      }

      if (![1, 2].includes(parsedUrutan)) {
        return res.status(400).json({
          message: 'Invalid urutan value. Must be 1 (Ganjil) or 2 (Genap)',
        });
      }

      if (![15, 16].includes(parsedStatus)) {
        return res.status(400).json({
          message: 'Invalid status value. Must be 11 (Aktif) or 12 (Inaktif)',
        });
      }

      // 2. Verify tahun ajaran exists
      const tahunAjaran = await prisma.ref_tahun_ajaran.findFirst({
        where: {
          id: parsedIdTahunAjaran,
        },
      });

      if (!tahunAjaran) {
        return res.status(404).json({
          message: 'Tahun ajaran not found',
        });
      }

      // 3. Check for existing semester
      const existingSemester = await prisma.ref_semester.findFirst({
        where: {
          id_tahun_ajaran: parsedIdTahunAjaran,
          urutan: parsedUrutan,
        },
      });

      if (existingSemester) {
        return res.status(400).json({
          message: 'Semester with the same tahun_ajaran and urutan already exists',
        });
      }

      // 4. Check active semester if status is Aktif (11)
      if (parsedStatus === 15) {
        const activeSemester = await prisma.ref_semester.findFirst({
          where: {
            id_master_kategori_status_ref_semester: 15,
          },
        });

        if (activeSemester) {
          return res.status(400).json({
            message: 'Another semester is already active. Only one semester can be active at a time.',
          });
        }
      }

      // 5. Construct semester name
      const semesterType = parsedUrutan === 1 ? 'Ganjil' : 'Genap';
      const nama = `${semesterType} ${tahunAjaran.nama}`;
      if (nama.length > 50) {
        return res.status(400).json({
          message: 'Semester name exceeds 50 characters',
        });
      }

      // 6. Create semester
      const semester = await prisma.ref_semester.create({
        data: {
          id_tahun_ajaran: parsedIdTahunAjaran,
          nama,
          urutan: parsedUrutan,
          id_master_kategori_status_ref_semester: parsedStatus,
        },
      });

      // 7. Success response
      res.status(201).json({
        message: 'Semester berhasil dibuat',
        data: semester,
      });
    } catch (error) {
      res.status(500).json({
        message: 'Failed to create semester',
        error: error.message,
      });
    }
  };

  static updateSemester = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { id_tahun_ajaran, urutan, status } = req.body;

      // 1. Input validation
      if (!id_tahun_ajaran || !urutan || !status) {
        return res.status(400).json({
          message: 'id_tahun_ajaran, urutan, and status are required',
        });
      }

      const parsedIdTahunAjaran = parseInt(id_tahun_ajaran);
      const parsedUrutan = parseInt(urutan);
      const parsedStatus = parseInt(status);
      const parsedId = parseInt(id);

      if (
          isNaN(parsedIdTahunAjaran) ||
          isNaN(parsedUrutan) ||
          isNaN(parsedStatus) ||
          isNaN(parsedId)
      ) {
        return res.status(400).json({
          message: 'id_tahun_ajaran, urutan, status, and id must be valid numbers',
        });
      }

      if (![1, 2].includes(parsedUrutan)) {
        return res.status(400).json({
          message: 'Invalid urutan value. Must be 1 (Ganjil) or 2 (Genap)',
        });
      }

      if (![11, 12].includes(parsedStatus)) {
        return res.status(400).json({
          message: 'Invalid status value. Must be 11 (Aktif) or 12 (Inaktif)',
        });
      }

      // 2. Check if semester exists
      const existingSemester = await prisma.ref_semester.findUnique({
        where: { id: parsedId },
      });

      if (!existingSemester) {
        return res.status(404).json({
          message: 'Semester not found',
        });
      }

      // 3. Verify tahun ajaran exists
      const tahunAjaran = await prisma.ref_tahun_ajaran.findFirst({
        where: {
          id: parsedIdTahunAjaran,
        },
      });

      if (!tahunAjaran) {
        return res.status(404).json({
          message: 'Tahun ajaran not found',
        });
      }

      // 4. Check for duplicate semester
      const duplicateSemester = await prisma.ref_semester.findFirst({
        where: {
          id_tahun_ajaran: parsedIdTahunAjaran,
          urutan: parsedUrutan,
          NOT: { id: parsedId },
        },
      });

      if (duplicateSemester) {
        return res.status(400).json({
          message: 'Semester lain dengan tahun ajaran dan urutan yang sama sudah ada',
        });
      }

      // 5. Check active semester if status is Aktif (11)
      if (parsedStatus === 11) {
        const activeSemester = await prisma.ref_semester.findFirst({
          where: {
            id_master_kategori_status_ref_semester: 11,
            NOT: { id: parsedId },
          },
        });

        if (activeSemester) {
          return res.status(400).json({
            message: 'Semester lain sudah aktif. Hanya satu semester yang dapat aktif pada satu waktu.',
          });
        }
      }

      // 6. Construct semester name
      const semesterType = parsedUrutan === 1 ? 'Ganjil' : 'Genap';
      const nama = `${semesterType} ${tahunAjaran.nama}`;
      if (nama.length > 50) {
        return res.status(400).json({
          message: 'Nama semester melebihi 50 karakter',
        });
      }

      // 7. Update semester
      const semester = await prisma.ref_semester.update({
        where: { id: parsedId },
        data: {
          id_tahun_ajaran: parsedIdTahunAjaran,
          nama,
          urutan: parsedUrutan,
          id_master_kategori_status_ref_semester: parsedStatus,
        },
      });

      // 8. Success response
      res.status(200).json({
        message: 'Semester berhasil diperbarui',
        data: semester,
      });
    } catch (error) {
      res.status(500).json({
        message: 'Failed to update semester',
        error: error.message,
      });
    }
  };

  static getAllSemesters = async (req, res, next) => {
    try {
      const semesters = await prisma.ref_semester.findMany({
        include: {
          ref_tahun_ajaran: true,
          ref_master_kategori_status_ref_semester: true,
        },
        orderBy: {
          id: 'desc',
        },
      });

      const flatSemesters = semesters.map((semester) => {
        const { ref_tahun_ajaran, ref_master_kategori_status_ref_semester, ...rest } = semester;
        return {
          ...rest,
          status: ref_master_kategori_status_ref_semester.nama,
          tahun_ajaran: ref_tahun_ajaran.nama,
          periode: semester.urutan === 1 ? 'Ganjil' : semester.urutan === 2 ? 'Genap' : 'Unknown',
        };
      });

      res.status(200).json(flatSemesters);
    } catch (error) {
      res.status(500).json({
        message: 'Failed to fetch semesters',
        error: error.message,
      });
    }
  };

  static getSemesterById = async (req, res, next) => {
    try {
      const { id } = req.params;
      const parsedId = parseInt(id);

      if (isNaN(parsedId)) {
        return res.status(400).json({
          message: 'Invalid semester ID',
        });
      }

      const semester = await prisma.ref_semester.findUnique({
        where: { id: parsedId },
        include: {
          ref_tahun_ajaran: true,
          ref_master_kategori_status_ref_semester: true,
        },
      });

      if (!semester) {
        return res.status(404).json({
          message: 'Semester not found',
        });
      }

      const { ref_tahun_ajaran, ref_master_kategori_status_ref_semester, ...rest } = semester;
      const flatSemester = {
        ...rest,
        status: ref_master_kategori_status_ref_semester.nama,
        tahun_ajaran: ref_tahun_ajaran.nama,
      };

      res.status(200).json(flatSemester);
    } catch (error) {
      res.status(500).json({
        message: 'Failed to fetch semester',
        error: error.message,
      });
    }
  };

  static getActiveSemester = async (req, res, next) => {
    try {
      const activeSemester = await prisma.ref_semester.findFirst({
        where: {
          id_master_kategori_status_ref_semester: 11,
        },
        include: {
          ref_master_kategori_status_ref_semester: true,
          ref_tahun_ajaran: true,
        },
      });

      if (!activeSemester) {
        return res.status(404).json({
          message: 'No active semester found',
        });
      }

      const { ref_tahun_ajaran, ref_master_kategori_status_ref_semester, ...rest } = activeSemester;
      const flatActiveSemester = {
        ...rest,
        status: ref_master_kategori_status_ref_semester.nama,
        tahun_ajaran: ref_tahun_ajaran.nama,
      };

      res.status(200).json(flatActiveSemester);
    } catch (error) {
      res.status(500).json({
        message: 'Failed to fetch active semester',
        error: error.message,
      });
    }
  };

  static setActiveSemester = async (req, res, next) => {
    try {
      const { id } = req.params;
      const parsedId = parseInt(id);

      if (isNaN(parsedId)) {
        return res.status(400).json({
          message: 'Invalid semester ID',
        });
      }

      // Check if semester exists
      const semester = await prisma.ref_semester.findUnique({
        where: { id: parsedId },
      });

      if (!semester) {
        return res.status(404).json({
          message: 'Semester not found',
        });
      }

      // Start transaction to ensure atomicity
      const updatedSemester = await prisma.$transaction(async (tx) => {
        // Deactivate all active semesters
        await tx.ref_semester.updateMany({
          where: {
            id_master_kategori_status_ref_semester: 11,
          },
          data: {
            id_master_kategori_status_ref_semester: 12,
          },
        });

        // Activate the requested semester
        return tx.ref_semester.update({
          where: { id: parsedId },
          data: {
            id_master_kategori_status_ref_semester: 11,
          },
          include: {
            ref_tahun_ajaran: true,
            ref_master_kategori_status_ref_semester: true,
          },
        });
      });

      const { ref_tahun_ajaran, ref_master_kategori_status_ref_semester, ...rest } = updatedSemester;
      const flatUpdatedSemester = {
        ...rest,
        status: ref_master_kategori_status_ref_semester.nama,
        tahun_ajaran: ref_tahun_ajaran.nama,
      };

      res.status(200).json({
        message: 'Berhasil mengaktifkan semester',
        data: flatUpdatedSemester,
      });
    } catch (error) {
      res.status(500).json({
        message: 'Failed to set active semester',
        error: error.message,
      });
    }
  };

  static deleteSemester = async (req, res, next) => {
    try {
      const { id } = req.params;
      const parsedId = parseInt(id);

      if (isNaN(parsedId)) {
        return res.status(400).json({
          message: 'ID semester tidak valid',
        });
      }

      const semester = await prisma.ref_semester.findUnique({
        where: { id: parsedId },
      });

      if (!semester) {
        return res.status(404).json({
          message: 'Semester tidak ditemukan',
        });
      }

      if (semester.id_master_kategori_status_ref_semester === 11) {
        return res.status(400).json({
          message: 'Tidak dapat menghapus semester yang sedang aktif',
        });
      }

      await prisma.ref_semester.delete({
        where: { id: parsedId },
      });

      res.status(200).json({
        message: 'Semester berhasil dihapus',
      });
    } catch (error) {
      res.status(500).json({
        message: 'Failed to delete semester',
        error: error.message,
      });
    }
  };

  static migrateSemester = async (req, res) => {
    try {
      const tahunAjaranList = await prisma.ref_tahun_ajaran.findMany();

      await prisma.$transaction(async (tx) => {
        for (const tahun of tahunAjaranList) {
          const semesterCount = await tx.ref_semester.count({
            where: { id_tahun_ajaran: tahun.id },
          });

          if (semesterCount === 0) {
            await tx.ref_semester.create({
              data: {
                id_tahun_ajaran: tahun.id,
                nama: `Ganjil ${tahun.nama}`,
                urutan: 1,
                id_master_kategori_status_ref_semester: 12,
              },
            });

            await tx.ref_semester.create({
              data: {
                id_tahun_ajaran: tahun.id,
                nama: `Genap ${tahun.nama}`,
                urutan: 2,
                id_master_kategori_status_ref_semester: 12,
              },
            });
          }
        }
      });

      res.status(200).json({
        message: 'Semesters migrated successfully',
      });
    } catch (error) {
      res.status(500).json({
        message: 'Failed to migrate semesters',
        error: error.message,
      });
    }
  };
}