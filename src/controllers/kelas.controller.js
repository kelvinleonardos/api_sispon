import { prisma } from "../prisma.js";
import mysql from 'mysql2/promise';

export class KelasController {
  static createKelas = async (req, res, next) => {
    try {
      const {
        kelas,
        kapasitas,
        jumlah_meja,
        meja_rusak,
        jumlah_kursi,
        kursi_rusak,
        jumlah_lemari,
        lemari_rusak,
        jumlah_ptulis,
        ptulis_rusak,
        proyektor,
        gender,
        id_tingkat,
      } = req.body;

      // Validate required fields
      if (!kelas) {
        return res.status(400).json({ message: "Nama kelas wajib diisi" });
      }
      if (typeof kelas !== "string" || kelas.length === 0) {
        return res.status(400).json({ message: "Nama kelas harus berupa string yang tidak kosong" });
      }
      if (gender && !['putra', 'putri'].includes(gender)) {
        return res.status(400).json({ message: "Gender harus 'putra' atau 'putri'" });
      }
      if (id_tingkat && isNaN(parseInt(id_tingkat))) {
        return res.status(400).json({ message: "ID tingkat tidak valid: harus berupa angka" });
      }

      let kode;
      let existingKelas;
      do {
        // Generate random 6-digit code
        kode = Math.floor(100000 + Math.random() * 900000);

        // Check if kode already exists
        existingKelas = await prisma.ref_kelas.findUnique({
          where: { kode },
        });
      } while (existingKelas); // Repeat if code exists

      // Determine urutan based on the last character of kelas
      const urutanMap = {
        A: 1,
        B: 2,
        C: 3,
        D: 4,
        E: 5,
      };
      const lastChar = kelas[kelas.length - 1].toUpperCase();
      const urutan = urutanMap[lastChar] || null; // Fallback to null if last character not in map

      const newKelas = await prisma.ref_kelas.create({
        data: {
          kode,
          kelas: kelas.toUpperCase(),
          kapasitas: kapasitas ? parseInt(kapasitas) : null,
          jumlah_meja: jumlah_meja ? parseInt(jumlah_meja) : null,
          meja_rusak: meja_rusak ? parseInt(meja_rusak) : null,
          jumlah_kursi: jumlah_kursi ? parseInt(jumlah_kursi) : null,
          kursi_rusak: kursi_rusak ? parseInt(kursi_rusak) : null,
          jumlah_lemari: jumlah_lemari ? parseInt(jumlah_lemari) : null,
          lemari_rusak: lemari_rusak ? parseInt(lemari_rusak) : null,
          jumlah_ptulis: jumlah_ptulis ? parseInt(jumlah_ptulis) : null,
          ptulis_rusak: ptulis_rusak ? parseInt(ptulis_rusak) : null,
          proyektor: proyektor ? parseInt(proyektor) : null,
          gender: gender || null,
          id_tingkat: id_tingkat ? parseInt(id_tingkat) : null,
          urutan,
        },
      });

      res.status(201).json({
        message: "Kelas berhasil ditambahkan",
        data: newKelas,
      });
    } catch (error) {
      next(error);
    }
  };

  static getAllKelas = async (req, res, next) => {
    try {
      const kelas = await prisma.ref_kelas.findMany({
        include: {
          ref_tingkat: true, // Include related ref_tingkat data
        },
        orderBy: [
          { id_tingkat: 'asc' }, // Sort by id_tingkat first
          { urutan: 'asc' }, // Then by urutan
          { kelas: 'asc' }, // Then by kelas name
        ],
      });

      const mappedKelas = kelas.map((kelas) => {
        const { ref_tingkat, kelas: kelasName, ...rest } = kelas; // Destruktur kelas sebagai kelasName
        return {
          kelas: `${kelasName || '-'} - ${kelas.gender || '-'}`,
          ...rest,
          tingkat: ref_tingkat ? ref_tingkat.tingkat : '-',
        };
      });

      // Handle empty result
      if (kelas.length === 0) {
        return res.status(200).json({ message: "Tidak ada data kelas ditemukan", data: [] });
      }

      res.json(mappedKelas);
    } catch (error) {
      next(error);
    }
  };

  static getTingkat = async (req, res, next) => {
    try {
      const tingkat = await prisma.ref_tingkat.findMany({
        orderBy: { id: 'asc' },
      });

      // Handle empty result
      if (tingkat.length === 0) {
        return res.status(200).json({ message: "Tidak ada data tingkat ditemukan", data: [] });
      }

      res.json(tingkat);
    } catch (error) {
      next(error);
    }
  }

  static getKelasById = async (req, res, next) => {
    try {
      const { id } = req.params;
      if (isNaN(parseInt(id))) {
        return res.status(400).json({ message: "ID kelas tidak valid: harus berupa angka" });
      }

      const kelas = await prisma.ref_kelas.findUnique({
        where: { id: parseInt(id) },
        include: {
          ref_tingkat: true, // Include related ref_tingkat data
        },
      });

      const { ref_tingkat, ...rest } = kelas;

      const mappedKelas = {
        ...rest,
        tingkat: ref_tingkat.tingkat,
      }

      if (!kelas) {
        return res.status(404).json({ message: "Kelas tidak ditemukan" });
      }

      res.json(kelas);
    } catch (error) {
      next(error);
    }
  };

  static updateKelas = async (req, res, next) => {
    try {
      const { id } = req.params;
      const data = req.body;

      // Check if kelas exists
      const existingKelas = await prisma.ref_kelas.findUnique({
        where: { id: parseInt(id) },
      });

      if (!existingKelas) {
        return res.status(404).json({ message: "Kelas tidak ditemukan" });
      }

      // If kode is being updated, check if new kode already exists
      if (data.kode && data.kode !== existingKelas.kode) {
        const kodeExists = await prisma.ref_kelas.findFirst({
          where: { kode: data.kode },
        });

        if (kodeExists) {
          return res.status(400).json({ message: "Kode kelas sudah digunakan" });
        }
      }

      // Determine urutan based on the last character of kelas
      let urutan = existingKelas.urutan; // Default to existing urutan if kelas is not updated
      if (data.kelas) {
        const urutanMap = {
          A: 1,
          B: 2,
          C: 3,
          D: 4,
          E: 5,
        };
        const lastChar = data.kelas[data.kelas.length - 1].toUpperCase();
        urutan = urutanMap[lastChar] || null; // Fallback to null if last character not in map
      }

      data.urutan = urutan;

      const updatedKelas = await prisma.ref_kelas.update({
        where: { id: parseInt(id) },
        data
      });

      res.status(200).json({
        message: "Kelas berhasil diperbarui",
        data: updatedKelas,
      });
    } catch (error) {
      next(error);
    }
  };

  static deleteKelas = async (req, res, next) => {
    try {
      const { id } = req.params;

      // Validate ID
      if (isNaN(parseInt(id))) {
        return res.status(400).json({ message: "ID kelas tidak valid: harus berupa angka" });
      }

      // Check if kelas exists
      const existingKelas = await prisma.ref_kelas.findUnique({
        where: { id: parseInt(id) },
      });

      if (!existingKelas) {
        return res.status(404).json({ message: "Kelas tidak ditemukan" });
      }

      // Delete kelas (related data will be handled by ON DELETE CASCADE)
      await prisma.ref_kelas.delete({
        where: { id: parseInt(id) },
      });

      res.json({ message: "Kelas berhasil dihapus" });
    } catch (error) {
      next(error);
    }
  };

  static migrateKelas = async (req, res, next) => {
    try {
      // Konfigurasi koneksi ke database lama
      const connection = await mysql.createConnection({
        host: process.env.OLD_DB_HOST,
        user: process.env.OLD_DB_USER,
        password: process.env.OLD_DB_PASSWORD,
        database: process.env.OLD_DB_NAME,
      });

      // Ambil semua data dari tabel `master_kelas` di database lama
      const [rows] = await connection.execute('SELECT * FROM master_kelas');

      // Tutup koneksi ke database lama
      await connection.end();

      // Gunakan transaksi untuk memastikan integritas data
      await prisma.$transaction(async (tx) => {
        for (const row of rows) {
          const {
            kd_kls,
            kelas,
            kapasitas,
            jml_meja,
            meja_r,
            jml_kursi,
            kursi_r,
            jml_lemari,
            lrusak,
            jml_ptulis,
            prusak,
            proyektor,
            gender,
            id_tingkat,
            urutan,
          } = row;

          // Validate gender if provided
          const validGender = gender && ['putra', 'putri'].includes(gender) ? gender : null;

          // Migrasi data ke tabel `ref_kelas`
          await tx.ref_kelas.create({
            data: {
              kode: kd_kls,
              kelas: kelas,
              kapasitas: kapasitas ? parseInt(kapasitas) : null,
              jumlah_meja: jml_meja ? parseInt(jml_meja) : null,
              meja_rusak: meja_r ? parseInt(meja_r) : null,
              jumlah_kursi: jml_kursi ? parseInt(jml_kursi) : null,
              kursi_rusak: kursi_r ? parseInt(kursi_r) : null,
              jumlah_lemari: jml_lemari ? parseInt(jml_lemari) : null,
              lemari_rusak: lrusak ? parseInt(lrusak) : null,
              jumlah_ptulis: jml_ptulis ? parseInt(jml_ptulis) : null,
              ptulis_rusak: prusak ? parseInt(prusak) : null,
              proyektor: proyektor ? parseInt(proyektor) : null,
              gender: validGender,
              id_tingkat: id_tingkat ? parseInt(id_tingkat) : null,
              urutan: urutan ? parseInt(urutan) : null,
            },
          });
        }
      });

      // Kirim respons sukses
      res.status(200).json({ message: 'Data kelas berhasil dimigrasi' });
    } catch (error) {
      next(error);
    }
  };
}