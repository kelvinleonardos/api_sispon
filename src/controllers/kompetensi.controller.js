import { prisma } from '../prisma.js';

export class KompetensiController {

  static async getMapelKD(req, res, next) {
    try {
      const { id_mapel, id_tingkat } = req.params;

      const dataKI = await prisma.data_kompetensi_inti.findMany({
        where: {
          id_mapel: parseInt(id_mapel),
          id_tingkat: parseInt(id_tingkat),
        },
        include: {
          data_kompetensi_dasar: true,
        },
      });

      // Flatten semua KD dari setiap KI
      const allKD = dataKI.flatMap(ki =>
          ki.data_kompetensi_dasar.map(kd => ({
            ...kd,
            kode_ki: ki.kode_ki, // kalau kamu mau ikut tampilkan kode KI-nya
          }))
      );

      // Urutkan berdasarkan kode_kd
      allKD.sort((a, b) => a.kode_kd.localeCompare(b.kode_kd));

      res.json(allKD);
    } catch (e) {
      next(e);
    }
  }


  static async createMapelKI(req, res, next) {
    try {
      const { id_mapel, deskripsi, kode_ki, kelompok, id_tingkat } = req.body;

      const data = await prisma.data_kompetensi_inti.create({
        data: {
          id_mapel,
          deskripsi,
          kode_ki,
          kelompok,
          id_tingkat,
        },
      });

      res.status(201).json({
        message: 'Kompetensi Inti berhasil dibuat',
        data,
      });
    } catch (e) {
      next(e);
    }
  }

  static async createMapelKD(req, res, next) {
    try {
      const { id_mapel, id_ki, kode_kd, deskripsi } = req.body;

      const data = await prisma.data_kompetensi_dasar.create({
        data: {
          id_mapel,
          id_ki,
          kode_kd,
          deskripsi,
        },
      });

      res.status(201).json({
        message: 'Kompetensi Dasar berhasil dibuat',
        data,
      });
    } catch (e) {
      next(e);
    }
  }

  static async updateMapelKI(req, res, next) {
    try {
      const { id } = req.params;
      const { deskripsi, kode_ki, kelompok, id_tingkat } = req.body;

      const data = await prisma.data_kompetensi_inti.update({
        where: { id: parseInt(id) },
        data: {
          deskripsi,
          kode_ki,
          kelompok,
          id_tingkat,
        },
      });

      res.json({
        status: true,
        message: 'Kompetensi Inti berhasil diperbarui',
        data,
      });
    } catch (e) {
      next(e);
    }
  }

  static async updateMapelKD(req, res, next) {
    try {
      const { id } = req.params;
      const { id_ki, kode_kd, deskripsi } = req.body;

      const data = await prisma.data_kompetensi_dasar.update({
        where: { id: parseInt(id) },
        data: {
          id_ki,
          kode_kd,
          deskripsi,
        },
      });

      res.json({
        status: true,
        message: 'Kompetensi Dasar berhasil diperbarui',
        data,
      });
    } catch (e) {
      next(e);
    }
  }

  // Menghapus Kompetensi Inti (KI)
  static async deleteMapelKI(req, res, next) {
    try {
      const { id } = req.params;

      await prisma.data_kompetensi_inti.delete({
        where: { id: parseInt(id) },
      });

      res.json({
        status: true,
        message: 'Kompetensi Inti berhasil dihapus',
      });
    } catch (e) {
      next(e);
    }
  }

  // Menghapus Kompetensi Dasar (KD)
  static async deleteMapelKD(req, res, next) {
    try {
      const { id } = req.params;

      await prisma.data_kompetensi_dasar.delete({
        where: { id: parseInt(id) },
      });

      res.json({
        status: true,
        message: 'Kompetensi Dasar berhasil dihapus',
      });
    } catch (e) {
      next(e);
    }
  }
}