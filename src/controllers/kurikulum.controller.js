import { prisma } from '../prisma.js';

export class KurikulumController {
  static createKurikulum = async (req, res, next) => {
    try {
      const { nama, visi, misi } = req.body;

      if (!nama) {
        return res.status(400).json({
          success: false,
          message: 'Nama kurikulum wajib diisi'
        });
      }

      const kurikulum = await prisma.ref_kurikulum.create({
        data: {
          nama,
          visi: visi || null,
          misi: misi || null
        }
      });

      res.status(201).json({
        success: true,
        message: 'Kurikulum berhasil dibuat',
        data: kurikulum
      });
    } catch (error) {
      next(error);
    }
  }

  static getAllKurikulum = async (req, res, next) => {
    try {
      const kurikulum = await prisma.ref_kurikulum.findMany();

      res.json(kurikulum);
    } catch (error) {
      next(error);
    }
  }

  static getAllDetailKurikulum = async (req, res, next) => {
    try {
      const { tipe } = req.query;

      let kategori = null;
      if (tipe) {
        if (isNaN(parseInt(tipe))) {
          return res.status(400).json({ message: 'ID tipe kategori tidak valid' });
        }
        kategori = await prisma.ref_master_kategori.findFirst({
          where: {
            id: parseInt(tipe),
            tipe: 'mapel',
          },
        });
        if (!kategori) {
          return res.status(404).json({ message: 'Kategori dengan ID tersebut tidak ditemukan' });
        }
      }

      // Ambil semua kurikulum dengan ref_mapel terfilter
      const kurikulum = await prisma.ref_kurikulum.findMany({
        include: {
          ref_mapel: {
            where: kategori ? {
              id_master_kategori_ref_mapel: parseInt(tipe),
            } : undefined,
            include: {
              guru_pegawai: true,
              data_kompetensi_inti: {
                include: {
                  ref_tingkat: true,
                  data_kompetensi_dasar: true
                }
              }
            }
          }
        }
      });

      const simplifiedKurikulum = kurikulum.map(k => {
        const mapelWithoutKi = k.ref_mapel.filter(m =>
            m.data_kompetensi_inti.length === 0
        ).length;

        return {
          id_kurikulum: k.id,
          visi: k.visi,
          misi: k.misi,
          nama: k.nama,
          jumlah_mapel_tanpa_ki: mapelWithoutKi,
          mapel: k.ref_mapel.map(m => {
            const kdByKi = m.data_kompetensi_inti.reduce((acc, ki) => {
              acc[ki.id] = {
                id_ki: ki.id,
                kode_ki: ki.kode_ki || `KI-${ki.id}`,
                deskripsi_ki: ki.deskripsi,
                nama: `${ki.kode_ki || 'KI-' + ki.id} - ${ki.ref_tingkat?.nama || 'N/A'}`,
                kompetensi_dasar: ki.data_kompetensi_dasar.map(kd => ({
                  id: kd.id,
                  kode_kd: kd.kode_kd,
                  deskripsi: kd.deskripsi
                }))
              };
              return acc;
            }, {});

            const kisWithoutKd = m.data_kompetensi_inti.filter(ki =>
                ki.data_kompetensi_dasar.length === 0
            ).length;

            return {
              id_mapel: m.id,
              nama: m.nama,
              kode_mapel: m.kode,
              guru: m.guru_pegawai ? m.guru_pegawai.nama_gp : null,
              jumlah_ki_tanpa_kd: kisWithoutKd,
              kompetensi_inti: Object.values(kdByKi)
            };
          })
        };
      });

      res.json(simplifiedKurikulum);
    } catch (error) {
      next(error);
    }
  };


  static getDetailMapel = async (req, res, next) => {
    try {
      const { id_mapel } = req.params;

      // Validasi id_mapel
      if (!id_mapel || isNaN(parseInt(id_mapel))) {
        return res.status(400).json({ error: "ID mapel tidak valid" });
      }

      // Ambil data mapel dengan relasi
      const mapel = await prisma.ref_mapel.findUnique({
        where: { id: parseInt(id_mapel) },
        include: {
          guru_pegawai: true,
          data_kompetensi_inti: {
            include: {
              ref_tingkat: true,
              data_kompetensi_dasar: true
            }
          },
          data_kelas: {
            include: {
              data_rombel: {
                include: {
                  ref_kelas: {
                    include: {
                      ref_tingkat: {
                        include: {
                          data_kkm_detail: true
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          ref_master_kategori_ref_mapel: true
        }
      });

      if (!mapel) {
        return res.status(404).json({ error: "Mapel not found" });
      }

      // Ambil semua tingkat
      const allTingkats = await prisma.ref_tingkat.findMany({
        orderBy: { tingkat: 'asc' }
      });

      // Group KI and KD by tingkat
      const kiKdByTingkat = allTingkats.map((tingkat) => {
        const kompetensiInti = mapel.data_kompetensi_inti
            .filter(ki => ki.id_tingkat === tingkat.id)
            .map(ki => ({
              id_ki: ki.id,
              kode_ki: ki.kode_ki,
              deskripsi_ki: ki.deskripsi,
              kompetensi_dasar: ki.data_kompetensi_dasar.map(kd => ({
                id: kd.id,
                kode_kd: kd.kode_kd,
                deskripsi: kd.deskripsi
              }))
            }));

        // Cari KKM untuk tingkat ini
        const kkmForTingkat = mapel.data_kelas
            .flatMap(k => k.data_rombel || [])
            .find(r => r.ref_kelas?.ref_tingkat?.id === tingkat.id)
            ?.ref_kelas?.ref_tingkat?.data_kkm_detail[0]?.kkm || null;

        return {
          id_tingkat: tingkat.id,
          tingkat: tingkat.nama,
          kkm: kkmForTingkat,
          kompetensi_inti: kompetensiInti.length > 0 ? kompetensiInti : null
        };
      });

      // Simplified mapel details
      const simplifiedMapel = {
        id_mapel: mapel.id,
        mata_pelajaran: mapel.nama,
        kategori: mapel.ref_master_kategori_ref_mapel?.nama || null,
        guru: mapel.guru_pegawai ? mapel.guru_pegawai.nama_gp : null,
        tujuan_pembelajaran: kiKdByTingkat
      };

      res.json(simplifiedMapel);
    } catch (error) {
      console.log(error);
      next(error);
    }
  };

  static getKurikulumById = async (req, res, next) => {
    try {
      const { id } = req.params;

      const kurikulum = await prisma.ref_kurikulum.findUnique({
        where: { id: parseInt(id) }
      });

      if (!kurikulum) {
        return res.status(404).json({
          success: false,
          message: 'Kurikulum not found'
        });
      }

      res.json({
        success: true,
        data: kurikulum
      });
    } catch (error) {
      next(error);
    }
  }

  static updateKurikulum = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { nama, visi, misi } = req.body;

      if (!nama) {
        return res.status(400).json({
          success: false,
          message: 'Nama is required'
        });
      }

      const kurikulum = await prisma.ref_kurikulum.update({
        where: { id: parseInt(id) },
        data: {
          nama,
          visi: visi || undefined,
          misi: misi || undefined
        }
      });

      res.json({
        success: true,
        message: 'Kurikulum berhasil diperbarui',
        data: kurikulum
      });
    } catch (error) {
      next(error);
    }
  }


  static deleteKurikulum = async (req, res, next) => {
    try {
      const { id } = req.params;

      await prisma.ref_kurikulum.delete({
        where: { id: parseInt(id) }
      });

      res.json({
        success: true,
        message: 'Kurikulum Berhasil dihapus'
      });
    } catch (error) {
      next(error);
    }
  }
}