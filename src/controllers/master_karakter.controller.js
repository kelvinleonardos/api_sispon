import { AppError } from "../middleware/errorHandler.js";
import { prisma } from "../prisma.js";

const TYPES = {
	SEKOLAH: 26,
	ASRAMA:25
}

export class MasterKarakterController {
	static getKategoriKarakter = async (req, res, next) => {
		try {
			const master_karakter =
				await prisma.ref_karakter_kategori.findMany();

			return res.status(201).json(master_karakter);
		} catch (error) {
			next(new AppError(error.message, 500));
		}
	};

	static getKategoriKarakterById = async (req, res, next) => {
		try {
			const { id } = req.params;
			const kategori_karakter =
				await prisma.ref_karakter_kategori.findFirst({
					where: {
						id: parseInt(id),
					},
				});
			if (!kategori_karakter) {
				return next(new AppError("Kategori not found", 404));
			}
			return res.status(200).json(kategori_karakter);
		} catch (error) {
			next(new AppError(error.message, 500));
		}
	};

	static createKategoriKarakter = async (req, res, next) => {
		try {
			const { nama, deskripsi } = req.body;

			const kategori_karakter = await prisma.ref_karakter_kategori.create(
				{
					data: {
						nama,
						deskripsi,
					},
				}
			);
			return res.status(201).json({
				success: true,
				message: "Kategori karakter berhasil ditambahkan",
				data: kategori_karakter,
			});
		} catch (error) {
			next(new AppError(error.message, 500));
		}
	};

	static updateKategoriKarakter = async (req, res, next) => {
		try {
			const { nama, deskripsi } = req.body;
			const { id } = req.params;

			const checkKategori = await prisma.ref_karakter_kategori.findFirst({
				where: {
					id: parseInt(id),
				},
			});

			if (!checkKategori) {
				return next(new AppError("Kategori not found", 404));
			}

			const kategori_karakter = await prisma.ref_karakter_kategori.update(
				{
					where: {
						id: parseInt(id),
					},
					data: {
						nama,
						deskripsi,
					},
				}
			);

			return res.status(200).json({
				success: true,
				message: "kategori karakter berhasil diupdate",
				data: kategori_karakter,
			});
		} catch (error) {
			next(new AppError(error.message, 500));
		}
	};

	static deleteKategoriKarakter = async (req, res, next) => {
		try {
			const { id } = req.params;

			const checkKategori = await prisma.ref_karakter_kategori.findFirst({
				where: {
					id: parseInt(id),
				},
			});

			if (!checkKategori) {
				return next(new AppError("Kategori not found", 404));
			}
			await prisma.ref_karakter_kategori.delete({
				where: {
					id: parseInt(id),
				},
			});

			return res.status(200).json({
				success: true,
				message: "kategori karakter berhasil dihapus",
			});
		} catch (error) {
			next(new AppError(error.message, 500));
		}
	};

	static getKriteriaKarakter = async (req, res, next) => {
		try {
			const { type, cat, group } = req.query;

			const karakterWhereClause = {};
			if (type && type !== "all") {
				if (type === "asrama") {
					karakterWhereClause.id_basis_lokasi = 25;
				} else if (type === "sekolah") {
					karakterWhereClause.id_basis_lokasi = 26;
				}
			}

			if (cat && cat !== "all") {
				const kelompokKarakter = await prisma.ref_karakter_kategori.findFirst({
					where: {
						nama: cat,
					},
					include: {
						ref_kriteria_karakter: true,
					},
				});

				if (kelompokKarakter && kelompokKarakter.ref_kriteria_karakter) {
					karakterWhereClause.id = {
						in: kelompokKarakter.ref_kriteria_karakter.map((k) => k.id),
					};
				} else {
					karakterWhereClause.id = { in: [] };
				}
			}

			const kriteria_karakter = await prisma.ref_kriteria_karakter.findMany({
				where: karakterWhereClause,
				include: {
					ref_karakter_kategori: true,
					ref_master_kategori: true,
				},
			});

			const mappedData = kriteria_karakter.map((item) => ({
				id: item.id,
				kategori: item.ref_karakter_kategori.nama,
				nama: item.nama,
				deskripsi: item.deskripsi,
				basis: item.ref_master_kategori.nama,
				is_aktif: item.is_aktif,
			}));

			if (group === "true") {
				// Kelompokkan data berdasarkan kategori, tapi kembalikan sebagai array
				const groupedData = Object.entries(
					mappedData.reduce((acc, item) => {
						if (!acc[item.kategori]) {
							acc[item.kategori] = [];
						}
						acc[item.kategori].push(item);
						return acc;
					}, {})
				).map(([kategori, items]) => ({
					kategori,
					items,
				}));

				return res.status(200).json(groupedData);
			}

			return res.status(200).json(mappedData);
		} catch (error) {
			next(new AppError(error.message, 500));
		}
	};

	static getKriteriaKarakterbyId = async (req, res, next) => {
		try {
			const { id } = req.params;
			const kriteria_karakter =
				await prisma.ref_kriteria_karakter.findFirst({
					where: {
						id: parseInt(id),
					},
					include: {
						ref_karakter_kategori: true,
						ref_master_kategori: true,
						//     ref_master_kategori: true
					},
				});
			if (!kriteria_karakter) {
				return next(new AppError("Kriteria not found", 404));
			}
			return res.status(200).json({
				success: true,
				message: "kriteria karakter berhasil diambil",
				data: {
					id: kriteria_karakter.id,
					kategori: kriteria_karakter.ref_karakter_kategori.nama,
					nama: kriteria_karakter.nama,
					deskripsi: kriteria_karakter.deskripsi,
					basis: kriteria_karakter.ref_master_kategori.nama,
				},
			});
		} catch (error) {
			next(new AppError(error.message, 500));
		}
	};

	static updateKriteriaKarakter = async (req, res, next) => {
		try {
			const { kategori, nama, deskripsi, basis } = req.body;
			const { id } = req.params;

			const checkKriteria = await prisma.ref_kriteria_karakter.findFirst({
				where: {
					id: parseInt(id),
				},
			});

			if (!checkKriteria) {
				return next(new AppError("Kriteria not found", 404));
			}

			const checkKategori = await prisma.ref_karakter_kategori.findFirst({
				where: {
					id: parseInt(kategori),
				},
			});
			if (!checkKategori) {
				return next(new AppError("Kategori not found", 404));
			}

			const checkBasis = await prisma.ref_master_kategori.findFirst({
				where: {
					id: parseInt(basis),
				},
			});

			if (!checkBasis) {
				return next(new AppError("Basis not found", 404));
			}

			const kriteria_karakter = await prisma.ref_kriteria_karakter.update(
				{
					where: {
						id: parseInt(id),
					},
					data: {
						id_kategori: parseInt(kategori),
						nama,
						deskripsi,
						id_basis_lokasi: parseInt(basis),
					},
				}
			);

			return res.status(200).json({
				success: true,
				message: "kriteria karakter berhasil diupdate",
				data: kriteria_karakter,
			});
		} catch (error) {
			next(new AppError(error.message, 500));
		}
	};

	static deleteKriteriaKarakter = async (req, res, next) => {
		try {
			const { id } = req.params;

			const checkKriteria = await prisma.ref_kriteria_karakter.findFirst({
				where: {
					id: parseInt(id),
				},
			});

			if (!checkKriteria) {
				return next(new AppError("Kriteria not found", 404));
			}

			await prisma.ref_kriteria_karakter.delete({
				where: {
					id: parseInt(id),
				},
			});
			return res.status(200).json({
				success: true,
				message: "kriteria karakter berhasil dihapus",
			});
		} catch (error) {
			next(new AppError(error.message, 500));
		}
	};

	static createKriteriaKarakter = async (req, res, next) => {
		try {
			const { kategori, nama, deskripsi, basis } = req.body;

			const checkKategori = await prisma.ref_karakter_kategori.findFirst({
				where: {
					id: parseInt(kategori),
				},
			});

			if (!checkKategori) {
				return next(new AppError("Kategori not found", 404));
			}

			const checkBasis = await prisma.ref_master_kategori.findFirst({
				where: {
					id: parseInt(basis),
				},
			});

			if (!checkBasis) {
				return next(new AppError("Basis not found", 404));
			}

			const kriteria_karakter = await prisma.ref_kriteria_karakter.create(
				{
					data: {
						kategori: parseInt(kategori),
						nama,
						deskripsi,
						basis: parseInt(basis),
					},
				}
			);
			return res.status(200).json({
				success: true,
				message: "kriteria karakter berhasil ditambahkan",
				data: kriteria_karakter,
			});
		} catch (error) {
			next(new AppError(error.message, 500));
		}
	};

	static createKategoriKarakterdanKriteria = async (req, res, next) => {
		try {
			const { nama, kriteria, tipe } = req.body;

			if(!nama || !kriteria || !Array.isArray(kriteria) || kriteria.length === 0) {
				return next(new AppError("Nama kategori dan kriteria harus diisi", 400));
			}

			const normalizedType = tipe.toUpperCase();

			console.log("Normalized Type:", normalizedType);
			// console.log("Available Types:", Object.values(TYPES));
			// console.log("Available Keys:", Object.keys(TYPES));
			// console.log(Object.keys(TYPES).includes(normalizedType));
			// console.log("TYPES:", TYPES[normalizedType]);
			// return next(new AppError("Tipe harus diisi", 400));

			if(!Object.keys(TYPES).includes(normalizedType)) {
				return next(
					new AppError(
						`Tipe harus salah satu dari: ${Object.keys(TYPES).join(", ")}`,
						400
					)
				);
			}

			// Execute transaction
			const kategori_karakter = await prisma.$transaction(async (tx) => {
				// Create the new kategori_karakter
				const newKategori = await tx.ref_karakter_kategori.create({
					data: {
						nama: nama.trim(),
					},
					select: {
						id: true,
						nama: true,
					},
				});

				// Create the kriteria_karakter for each kriteria
				const kriteriaPromises = kriteria.map((k) =>
					tx.ref_kriteria_karakter.create({
						data: {
							nama: k.nama.trim(),
							deskripsi: k.deskripsi ? k.deskripsi.trim() : null,
							id_kategori: newKategori.id,
							id_basis_lokasi: TYPES[normalizedType],
							is_aktif: k.is_aktif !== undefined ? k.is_aktif : true,
						},
					})
				);

				// Wait for all kriteria to be created
				await Promise.all(kriteriaPromises);

				return newKategori;
			});

			return res.status(201).json({
				success: true,
				message: "Kategori karakter dan kriteria berhasil ditambahkan",
				data: kategori_karakter,
			});
		} catch (error) {
			next(new AppError(error.message, 500));
		}
	};

	static setActive = async (req, res, next) => {
		try {
			const { id } = req.params;

			// Periksa apakah kriteria ada
			const checkKriteria = await prisma.ref_kriteria_karakter.findFirst({
				where: {
					id: parseInt(id),
				},
			});

			if (!checkKriteria) {
				return next(new AppError("Kriteria not found", 404));
			}

			// Ubah status is_aktif (toggle)
			const kriteria_karakter = await prisma.ref_kriteria_karakter.update({
				where: {
					id: parseInt(id),
				},
				data: {
					is_aktif: !checkKriteria.is_aktif,
				},
			});

			return res.status(200).json({
				success: true,
				message: `Kriteria karakter berhasil diubah menjadi ${kriteria_karakter.is_aktif ? 'aktif' : 'inaktif'}`,
				data: kriteria_karakter,
			});
		} catch (error) {
			next(new AppError(error.message, 500));
		}
	};
}