import { prisma } from "../prisma.js";

export class MapelController {
  static createMapel = async (req, res, next) => {
    try {
      const { nama, keterangan, nama_arab, id_pengajar, id_master_kategori_ref_mapel, id_kurikulum, jenis_nilai } = req.body;
      const { idkur } = req.params;

      // Determine id_kurikulum (prioritize body, fallback to params)
      let finalIdKurikulum = id_kurikulum ? parseInt(id_kurikulum) : idkur ? parseInt(idkur) : null;
      if (!finalIdKurikulum) {
        return res.status(400).json({
          success: false,
          message: "id_kurikulum is required either in body or params"
        });
      }

      // Validate required fields
      if (!nama || !id_master_kategori_ref_mapel) {
        return res.status(400).json({
          success: false,
          message: "Nama and id_master_kategori_ref_mapel are required"
        });
      }

      // Check if curriculum exists
      const kurikulum = await prisma.ref_kurikulum.findUnique({
        where: { id: finalIdKurikulum }
      });

      if (!kurikulum) {
        return res.status(404).json({
          success: false,
          message: "Curriculum not found"
        });
      }

      // Validate id_pengajar if provided
      if (id_pengajar) {
        const pengajar = await prisma.guru_pegawai.findUnique({
          where: { id: parseInt(id_pengajar) }
        });
        if (!pengajar) {
          return res.status(404).json({
            success: false,
            message: "Pengajar not found"
          });
        }
      }

      // Validate id_master_kategori_ref_mapel
      const kategori = await prisma.ref_master_kategori.findFirst({
        where: {
          id: parseInt(id_master_kategori_ref_mapel),
          tipe: 'mapel'
        }
      });
      if (!kategori) {
        return res.status(404).json({
          success: false,
          message: "Kategori not found or invalid type"
        });
      }

      // Generate kode otomatis: 2 huruf (inisial kategori) + 3 angka (berurut)
      let kodePrefix = '';
      const kategoriNama = kategori.nama.trim();
      const namaParts = kategoriNama.split(/\s+/);

      if (namaParts.length === 1) {
        kodePrefix = kategoriNama.substring(0, 2).toUpperCase();
      } else {
        kodePrefix = namaParts.map(word => word.charAt(0)).join('').substring(0, 2).toUpperCase();
      }

      // Ambil kode terakhir untuk kategori dan kurikulum ini
      const lastMapel = await prisma.ref_mapel.findFirst({
        where: {
          id_master_kategori_ref_mapel: parseInt(id_master_kategori_ref_mapel),
          id_kurikulum: finalIdKurikulum,
          kode: {
            startsWith: kodePrefix
          }
        },
        orderBy: {
          kode: 'desc'
        }
      });

      let kodeNumber = 1;
      if (lastMapel) {
        const lastNumber = parseInt(lastMapel.kode.substring(2)) || 0;
        kodeNumber = lastNumber + 1;
      }

      const kode = `${kodePrefix}${kodeNumber.toString().padStart(3, '0')}`;

      // Check if mapel code already exists for this curriculum
      const existingMapel = await prisma.ref_mapel.findFirst({
        where: {
          kode,
          keterangan,
          id_kurikulum: finalIdKurikulum
        }
      });

      if (existingMapel) {
        return res.status(400).json({
          success: false,
          message: "Generated subject code already exists in this curriculum"
        });
      }

      const newMapel = await prisma.ref_mapel.create({
        data: {
          kode,
          nama,
          keterangan,
          nama_arab,
          id_pengajar: id_pengajar ? parseInt(id_pengajar) : null,
          id_master_kategori_ref_mapel: parseInt(id_master_kategori_ref_mapel),
          id_kurikulum: finalIdKurikulum,
          jenis_nilai
        }
      });

      res.status(201).json({
        message: "Mata pelajaran berhasil ditambahkan",
        data: newMapel
      });
    } catch (error) {
      next(error);
    }
  };

  static getAllMapel = async (req, res, next) => {
    try {
      const { id_rombel, tipe } = req.query;

      let tingkat = null;

      // Validasi tipe jika diberikan
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

      // Ambil data rombel kalau diberikan
      if (id_rombel) {
        const rombel = await prisma.data_rombel.findFirst({
          where: { id: parseInt(id_rombel) },
          include: {
            ref_kelas: {
              include: {
                ref_tingkat: true
              },
            },
          },
        });

        if (!rombel) {
          return res.status(404).json({ message: 'Rombel tidak ditemukan' });
        }

        tingkat = rombel.ref_kelas?.id_tingkat || null;
      }

      // Siapkan where clause untuk mapel
      const mapelWhereClause = {};

      const mapel_kategori = await prisma.ref_master_kategori.findMany({
        where: {
          tipe: 'mapel',
        },
      });

      const mapel_kategori_ids = mapel_kategori.map(kategori => kategori.id);

      mapelWhereClause.id_master_kategori_ref_mapel = {
        in: mapel_kategori_ids,
      };

      if (kategori) {
        mapelWhereClause.id_master_kategori_ref_mapel = parseInt(tipe);
      }

      // Ambil data mapel dengan filter
      const mapel = await prisma.ref_mapel.findMany({
        where: mapelWhereClause,
        include: {
          guru_pegawai: true,
        },
      });

      // Gabungkan dengan data KKM berdasarkan tingkat (jika ada)
      const flatMapel = await Promise.all(
          mapel.map(async (mapel) => {
            return {
              id: mapel.id,
              kode: mapel.kode,
              nama: mapel.nama,
              nama_arab: mapel.nama_arab,
              keterangan: mapel.keterangan,
              id_kurikulum: mapel.id_kurikulum,
              id_pengajar: mapel.id_pengajar,
              id_master_kategori_ref_mapel: mapel.id_master_kategori_ref_mapel,
              guru: mapel.guru_pegawai ? mapel.guru_pegawai.nama_gp : null,
            };
          })
      );

      res.json(flatMapel);
    } catch (error) {
      next(error);
    }
  };

  static getAllDetailMapel = async (req, res, next) => {
    try {
      const { id_rombel, tipe } = req.query;

      let tingkat = null;

      // Validasi tipe jika diberikan
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

      // Ambil data rombel kalau diberikan
      if (id_rombel) {
        const rombel = await prisma.data_rombel.findFirst({
          where: { id: parseInt(id_rombel) },
          include: {
            ref_kelas: {
              include: {
                ref_tingkat: true
              },
            },
          },
        });

        if (!rombel) {
          return res.status(404).json({ message: 'Rombel tidak ditemukan' });
        }

        tingkat = rombel.ref_kelas?.id_tingkat || null;
      }

      // Siapkan where clause untuk mapel
      const mapelWhereClause = {};
      const mapel_kategori = await prisma.ref_master_kategori.findMany({
        where: {
          tipe: 'mapel',
        },
      });

      const mapel_kategori_ids = mapel_kategori.map(kategori => kategori.id);

      mapelWhereClause.id_master_kategori_ref_mapel = {
        in: mapel_kategori_ids,
      };

      if (kategori) {
        mapelWhereClause.id_master_kategori_ref_mapel = parseInt(tipe);
      }

      // Ambil data mapel dengan filter
      const mapel = await prisma.ref_mapel.findMany({
        where: mapelWhereClause,
        include: {
          guru_pegawai: true,
          data_kompetensi_inti: {
            include: {
              ref_tingkat: true,
              data_kompetensi_dasar: true
            }
          },
          data_kkm_detail: {
            include: {
              ref_tingkat: true,
            }
          },
          ref_kurikulum: true
        },
      });

      // Gabungkan dengan data KKM berdasarkan tingkat (jika ada)
      const flatMapel = await Promise.all(
          mapel.map(async (mapel) => {
            const kompetensi = mapel.data_kompetensi_inti
                .filter(ki => !tingkat || ki.id_tingkat === tingkat)
                .map(ki => ({
                  id_ki: ki.id,
                  kode_ki: ki.kode_ki || `KI-${ki.id}`,
                  deskripsi_ki: ki.deskripsi,
                  nama: `${ki.kode_ki || 'KI-' + ki.id} - ${ki.ref_tingkat?.nama || 'N/A'}`,
                  kompetensi_dasar: ki.data_kompetensi_dasar.map(kd => ({
                    id_kd: kd.id,
                    kode_kd: kd.kode_kd,
                    deskripsi: kd.deskripsi,
                    nama: `KD ${kd.kode_kd} - ${ki.ref_tingkat?.nama || 'N/A'}`
                  }))
                }));



            return {
              id_mapel: mapel.id,
              kode: mapel.kode,
              nama: mapel.nama,
              kurikulum: mapel.ref_kurikulum.nama,
              id_kurikulum: mapel.id_kurikulum,
              guru: mapel.guru_pegawai ? mapel.guru_pegawai.nama_gp : null,
              kompetensi: kompetensi || [],
            };
          })
      );

      res.json(flatMapel);
    } catch (error) {
      console.log(error);
      next(error);
    }
  };

  static getDetailMapelById = async (req, res, next) => {
    try {
      const { id_mapel } = req.params;
      const { id_rombel, tipe } = req.query;

      // Validasi id_mapel
      if (!id_mapel || isNaN(parseInt(id_mapel))) {
        return res.status(400).json({ message: 'ID mapel tidak valid' });
      }

      let tingkat = null;

      // Validasi tipe jika diberikan
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

      // Ambil data rombel kalau diberikan
      if (id_rombel) {
        const rombel = await prisma.data_rombel.findFirst({
          where: { id: parseInt(id_rombel) },
          include: {
            ref_kelas: {
              include: {
                ref_tingkat: true,
              },
            },
          },
        });

        if (!rombel) {
          return res.status(404).json({ message: 'Rombel tidak ditemukan' });
        }

        tingkat = rombel.ref_kelas?.id_tingkat || null;
      }

      // Siapkan where clause untuk mapel
      const mapelWhereClause = {
        id: parseInt(id_mapel),
      };
      if (kategori) {
        mapelWhereClause.id_master_kategori_ref_mapel = parseInt(tipe);
      }

      // Ambil data mapel berdasarkan id_mapel
      const mapel = await prisma.ref_mapel.findFirst({
        where: mapelWhereClause,
        include: {
          guru_pegawai: true,
          data_kompetensi_inti: {
            include: {
              ref_tingkat: true,
              data_kompetensi_dasar: true
            }
          },
          ref_master_kategori_ref_mapel: true,
          data_kkm_detail: {
            include: {
              ref_tingkat: true
            }
          }
        },
      });

      // Jika mapel tidak ditemukan
      if (!mapel) {
        return res.status(404).json({ message: 'Mapel tidak ditemukan' });
      }

      // Format data kompetensi
      const kompetensi = mapel.data_kompetensi_inti
          .filter(ki => !tingkat || ki.id_tingkat === tingkat)
          .map(ki => ({
            id_ki: ki.id,
            kode_ki: ki.kode_ki || `KI-${ki.id}`,
            deskripsi_ki: ki.deskripsi,
            nama: `${ki.kode_ki || 'KI-' + ki.id} - ${ki.ref_tingkat?.nama || 'N/A'}`,
            kompetensi_dasar: ki.data_kompetensi_dasar.map(kd => ({
              id_kd: kd.id,
              kode_kd: kd.kode_kd,
              deskripsi: kd.deskripsi,
              nama: `KD ${kd.kode_kd} - ${ki.ref_tingkat?.nama || 'N/A'}`
            }))
          }));

      // Format data KKM
      const kkm = mapel.data_kkm_detail.map((kkm) => ({
        nama: `KKM ${kkm.ref_tingkat?.nama || 'N/A'} (${kkm.kkm})`
      }));

      const result = {
        id_mapel: mapel.id,
        kode: mapel.kode,
        nama: mapel.nama,
        id_kategori: mapel.id_master_kategori_ref_mapel,
        kategori: mapel.ref_master_kategori_ref_mapel?.nama || null,
        id_kurikulum: mapel.id_kurikulum,
        id_guru: mapel.id_pengajar,
        guru: mapel.guru_pegawai ? mapel.guru_pegawai.nama_gp : null,
        jenis_nilai: mapel.jenis_nilai || null,
        kompetensi: kompetensi || [],
        kkm: kkm || [],
      };

      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  static updateDetailMapel = async (req, res, next) => {
    try {
      const { id_mapel } = req.params;
      const { kode, nama, keterangan, id_kurikulum, id_master_kategori_ref_mapel, nama_arab, sifat, id_pengajar } = req.body;

      // Validasi id_mapel
      if (!id_mapel || isNaN(parseInt(id_mapel))) {
        return res.status(400).json({ message: 'ID mapel tidak valid' });
      }

      // Cek apakah mapel ada
      const existingMapel = await prisma.ref_mapel.findUnique({
        where: { id: parseInt(id_mapel) },
      });

      if (!existingMapel) {
        return res.status(404).json({ message: 'Mapel tidak ditemukan' });
      }

      // Cek apakah kode sudah digunakan (kecuali untuk mapel yang sama)
      if (kode) {
        const duplicateKode = await prisma.ref_mapel.findFirst({
          where: {
            kode,
            keterangan: keterangan || existingMapel.keterangan,
            id: { not: parseInt(id_mapel) },
          },
        });

        if (duplicateKode) {
          return res.status(400).json({ message: 'Kode dan keterangan sudah digunakan oleh mapel lain' });
        }
      }

      // Siapkan data untuk update
      const updateData = {
        kode,
        nama: nama || undefined,
        keterangan: keterangan || undefined,
        id_kurikulum: id_kurikulum ? parseInt(id_kurikulum) : undefined,
        id_master_kategori_ref_mapel: id_master_kategori_ref_mapel ? parseInt(id_master_kategori_ref_mapel) : undefined,
        nama_arab: nama_arab || undefined,
        sifat: sifat || undefined,
        id_pengajar: id_pengajar ? parseInt(id_pengajar) : undefined,
      };

      // Update mapel
      const updatedMapel = await prisma.ref_mapel.update({
        where: { id: parseInt(id_mapel) },
        data: updateData,
      });

      res.json({
        message: 'Mapel berhasil diperbarui',
        data: updatedMapel,
      });
    } catch (error) {
      if (error.name === 'PrismaClientValidationError') {
        return res.status(400).json({ message: 'Data input tidak valid', error: error.message });
      }
      next(error);
    }
  };

  static getMapelById = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { idkur } = req.params;

      // Determine id_kurikulum (prioritize params if provided)
      let finalIdKurikulum = idkur ? parseInt(idkur) : null;
      if (!finalIdKurikulum) {
        return res.status(400).json({
          success: false,
          message: "idkur is required in params"
        });
      }

      const mapel = await prisma.ref_mapel.findFirst({
        where: {
          id: parseInt(id),
          id_kurikulum: finalIdKurikulum
        },
        include: {
          guru_pegawai: true,
          ref_master_kategori_ref_mapel: true
        }
      });

      if (!mapel) {
        return res.status(404).json({
          success: false,
          message: "Subject not found"
        });
      }

      res.json({
        success: true,
        data: {
          id: mapel.id,
          kode: mapel.kode,
          nama: mapel.nama,
          nama_arab: mapel.nama_arab,
          keterangan: mapel.keterangan,
          id_kurikulum: mapel.id_kurikulum,
          id_pengajar: mapel.id_pengajar,
          id_master_kategori_ref_mapel: mapel.id_master_kategori_ref_mapel,
          guru: mapel.guru_pegawai ? mapel.guru_pegawai.nama_gp : null,
          kategori: mapel.ref_master_kategori_ref_mapel?.nama || null
        }
      });
    } catch (error) {
      next(error);
    }
  };

  static getMapelTipe = async (req, res, next) => {
    try {
      const kategori = await prisma.ref_master_kategori.findMany({
        orderBy: {
          nama: "asc"
        },
        where: {
          tipe: "mapel"
        }
      });

      res.json(kategori);
    } catch (error) {
      next(error);
    }
  };

  static updateMapel = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { kode, nama, keterangan, nama_arab, id_pengajar, id_master_kategori_ref_mapel, id_kurikulum, jenis_nilai } = req.body;
      const { idkur } = req.params;

      // Determine id_kurikulum (prioritize body, fallback to params)
      let finalIdKurikulum = id_kurikulum ? parseInt(id_kurikulum) : idkur ? parseInt(idkur) : null;
      if (!finalIdKurikulum) {
        return res.status(400).json({
          success: false,
          message: "id_kurikulum is required either in body or params"
        });
      }

      // Check if mapel exists
      const existingMapel = await prisma.ref_mapel.findFirst({
        where: {
          id: parseInt(id),
          id_kurikulum: finalIdKurikulum
        }
      });

      if (!existingMapel) {
        return res.status(404).json({
          success: false,
          message: "Subject not found"
        });
      }

      // Validate id_kurikulum if provided
      const kurikulum = await prisma.ref_kurikulum.findUnique({
        where: { id: finalIdKurikulum }
      });
      if (!kurikulum) {
        return res.status(404).json({
          success: false,
          message: "Curriculum not found"
        });
      }

      // Validate id_pengajar if provided
      if (id_pengajar) {
        const pengajar = await prisma.guru_pegawai.findUnique({
          where: { id: parseInt(id_pengajar) }
        });
        if (!pengajar) {
          return res.status(404).json({
            success: false,
            message: "Pengajar not found"
          });
        }
      }

      // Validate id_master_kategori_ref_mapel if provided
      if (id_master_kategori_ref_mapel) {
        const kategori = await prisma.ref_master_kategori.findFirst({
          where: {
            id: parseInt(id_master_kategori_ref_mapel),
            tipe: 'mapel'
          }
        });
        if (!kategori) {
          return res.status(404).json({
            success: false,
            message: "Kategori not found or invalid type"
          });
        }
      }

      // If code is being updated, check if it already exists
      if (kode && kode !== existingMapel.kode) {
        const kodeExists = await prisma.ref_mapel.findFirst({
          where: {
            kode,
            keterangan,
            id_kurikulum: finalIdKurikulum,
            NOT: {
              id: parseInt(id)
            }
          }
        });

        if (kodeExists) {
          return res.status(400).json({
            success: false,
            message: "Subject code already exists in this curriculum"
          });
        }
      }

      const updatedMapel = await prisma.ref_mapel.update({
        where: { id: parseInt(id) },
        data: {
          kode,
          nama,
          keterangan,
          nama_arab,
          id_pengajar: id_pengajar ? parseInt(id_pengajar) : null,
          id_master_kategori_ref_mapel: id_master_kategori_ref_mapel ? parseInt(id_master_kategori_ref_mapel) : null,
          id_kurikulum: finalIdKurikulum,
          jenis_nilai
        }
      });

      res.json({
        success: true,
        data: updatedMapel
      });
    } catch (error) {
      next(error);
    }
  };

  static deleteMapel = async (req, res, next) => {
    try {
      const { id, idkur } = req.params;

      // Validasi ID mapel
      const mapelId = parseInt(id);
      if (isNaN(mapelId)) {
        return res.status(400).json({
          success: false,
          message: "ID mapel tidak valid",
        });
      }

      // Validasi ID kurikulum jika diberikan
      let kurikulumId = null;
      if (idkur) {
        kurikulumId = parseInt(idkur);
        if (isNaN(kurikulumId)) {
          return res.status(400).json({
            success: false,
            message: "ID kurikulum tidak valid",
          });
        }
      }

      // Cek apakah mapel ada
      const whereClause = { id: mapelId };
      if (kurikulumId !== null) {
        whereClause.id_kurikulum = kurikulumId;
      }

      const existingMapel = await prisma.ref_mapel.findFirst({
        where: whereClause,
      });

      if (!existingMapel) {
        return res.status(404).json({
          success: false,
          message: "Mata pelajaran tidak ditemukan",
        });
      }

      // Hapus mapel
      await prisma.ref_mapel.delete({
        where: { id: mapelId },
      });

      return res.status(200).json({
        success: true,
        message: "Mata pelajaran berhasil dihapus",
      });
    } catch (error) {
      console.error(`Error deleting mapel ID ${req.params.id}:`, error);
      next(error);
    }
  };
}