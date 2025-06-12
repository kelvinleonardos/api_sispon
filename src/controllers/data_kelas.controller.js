import { prisma } from "../prisma.js"
import {getTokenPayload} from "../helpers.js";

export class DataKelasController {
  // Data Kelas Operations
  static createDataKelas = async (req, res, next) => {
    try {
      const { id_semester, id_mapel, nama } = req.body;

      const kelas = await prisma.data_kelas.create({
        data: {
          id_semester,
          id_mapel,
          nama,
          status: 'aktif'
        }
      });

      res.status(201).json({
        success: true,
        data: kelas
      });
    } catch (error) {
      next(error)
    }
  }

  static getAllDataKelas = async (req, res, next) => {
    try {
      const { decoded, semester, tahunAjaran } = await getTokenPayload(req);

      const kelas = await prisma.data_kelas.findMany({
        where: {
          id_semester: parseInt(semester.id),
        },
        include: {
          data_absensi: true,
          data_rencana_penilaian: {
            include: {
              ref_komponen_nilai: true
            }
          }
        }
      });

      res.json(kelas);
    } catch (error) {
      next(error)
    }
  }

  static getDataKelasById = async (req, res, next) => {
    try {
      const { id } = req.params;

      const kelas = await prisma.data_kelas.findUnique({
        where: { id: parseInt(id) },
        include: {
          data_absensi: true,
          data_rencana_penilaian: true
        }
      });

      if (!kelas) {
        return res.status(404).json({
          success: false,
          message: 'Data kelas not found'
        });
      }

      res.json({
        success: true,
        data: kelas
      });
    } catch (error) {
      next(error)
    }
  }

  static updateDataKelas = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { id_semester, id_mapel, nama, status } = req.body;

      const kelas = await prisma.data_kelas.update({
        where: { id: parseInt(id) },
        data: {
          id_semester,
          id_mapel,
          nama,
          status
        }
      });

      res.json({
        success: true,
        data: kelas
      });
    } catch (error) {
      next(error)
    }
  }

  static lockDataKelas = async (req, res, next) => {
    try {
      const { id } = req.params;

      const kelas = await prisma.data_kelas.update({
        where: { id: parseInt(id) },
        data: {
          is_locked: true
        }
      });

      res.json({
        message: "Data kelas berhasil dikunci",
        data: kelas
      });
    } catch (error) {
      next(error)
    }
  }

  static unlockDataKelas = async (req, res, next) => {
    try {
      const { id } = req.params;

      const kelas = await prisma.data_kelas.update({
        where: { id: parseInt(id) },
        data: {
          is_locked: false
        }
      });

      res.json({
        message: "Data kelas berhasil dibuka kuncinya",
        data: kelas
      });
    } catch (error) {
      next(error)
    }
  }

  static deleteDataKelas = async (req, res, next) => {
    try {
      const { id } = req.params;

      await prisma.data_kelas.delete({
        where: { id: parseInt(id) }
      });

      res.json({
        success: true,
        message: 'Data kelas berhasil dihapus'
      });
    } catch (error) {
      let e = error;
      if (error.code === 'P2003' || error.message.includes('Foreign key constraint')) {
        e = {
            status: 400,
            message: 'Data kelas tidak dapat dihapus karena masih digunakan dalam data lain'
        }
      }
      next(e);
    }
  }

  // Data Kelas Anggota Operations
  static addKelasAnggota = async (req, res, next) => {
    try {
      const { id_kelas, id_santri } = req.body;

      const anggota = await prisma.data_kelas_anggota.create({
        data: {
          id_kelas,
          id_santri
        }
      });

      res.status(201).json({
        success: true,
        data: anggota
      });
    } catch (error) {
      next(error)
    }
  }

  static getKelasAnggota = async (req, res, next) => {
    try {
      const { id_kelas } = req.params;

      const anggota = await prisma.data_kelas_anggota.findMany({
        where: { id_kelas: parseInt(id_kelas) }
      });

      res.json({
        success: true,
        data: anggota
      });
    } catch (error) {
      next(error)
    }
  }

  static removeKelasAnggota = async (req, res, next) => {
    try {
      const { id } = req.params;

      await prisma.data_kelas_anggota.delete({
        where: { id: parseInt(id) }
      });

      res.json({
        success: true,
        message: 'Anggota kelas removed successfully'
      });
    } catch (error) {
      next(error)
    }
  }

  // Data Kelas Pengajar Operations
  static addKelasPengajar = async (req, res, next) => {
    try {
      const { id, id_guru, id_kelas } = req.body;

      const pengajar = await prisma.data_kelas_pengajar.create({
        data: {
          id,
          id_guru,
          id_kelas
        }
      });

      res.status(201).json({
        success: true,
        data: pengajar
      });
    } catch (error) {
      next(error)
    }
  }

  static getKelasPengajar = async (req, res, next) => {
    try {
      const { id_kelas } = req.params;

      const pengajar = await prisma.data_kelas_pengajar.findMany({
        where: { id_kelas: parseInt(id_kelas) }
      });

      res.json({
        success: true,
        data: pengajar
      });
    } catch (error) {
      next(error)
    }
  }

  static removeKelasPengajar = async (req, res, next) => {
    try {
      const { id } = req.params;

      await prisma.data_kelas_pengajar.delete({
        where: { id: parseInt(id) }
      });

      res.json({
        success: true,
        message: 'Pengajar kelas removed successfully'
      });
    } catch (error) {
      next(error)
    }
  }
}
