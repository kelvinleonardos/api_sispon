// services/report.service.js

import ejs from "ejs";
import path from "path";
import { fileURLToPath } from "url";
import wkhtmltopdf from "wkhtmltopdf";
import ExcelJS from "exceljs";
import e from "express";
import fs from "fs/promises";
import { AppError } from "../middleware/errorHandler.js";
import QRCode from "qrcode";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Render EJS template ke HTML string
 */
export const renderEjsTemplate = async (templateFileName, data = {}) => {
	const templatePath = path.join(
		__dirname,
		"..",
		"..",
		"views",
		templateFileName
	);
	return await ejs.renderFile(templatePath, data);
};

/**
 * Konversi HTML ke PDF dan langsung kirim ke response stream
 */
export const convertHtmlToPdf = (res, html) => {
	res.header("Content-Type", "application/pdf");
	res.header(
		"Content-Disposition",
		"attachment; filename=Laporan_Pengguna.pdf"
	);

	wkhtmltopdf(html, {
		output: null,
		pageSize: "A4",
		orientation: "Portrait",
		marginTop: "20mm",
		marginBottom: "20mm",
		marginLeft: "15mm",
		marginRight: "15mm",
	}).pipe(res);
};

export const generateQRCode = async (res, imagePath) => {
	try {
		// Baca file gambar sebagai base64
		const imageBuffer = await fs.readFile(imagePath);
		const base64Image = `data:image/png;base64,${imageBuffer.toString(
			"base64"
		)}`;

		// Generate QR code dari data base64 gambar
		const qrDataURL = await QRCode.toDataURL(base64Image);

		res.writeHead(200, { "Content-Type": "text/html" });
		res.end(`<img src="${qrDataURL}" alt="QR Code TTD" />`);
	} catch (err) {
		console.error(err);
		res.status(500).send("Error generating QR code");
	}
};
 
export const printPdf = async (
	res,
	data,
	templatePath,
	orientation = "Portrait",
	filename = "document.pdf"
) => {
	try {
		// Render EJS template with provided data
		const html = await ejs.renderFile(templatePath, { data });

		// Set response headers for PDF
		res.header("Content-Type", "application/pdf");
		res.header("Content-Disposition", `attachment; filename=${filename}`);

		// Configure wkhtmltopdf options
		const pdfOptions = {
			output: null, // Stream output
			pageSize: "Folio",
			orientation: orientation,
			marginTop: "10mm",
			marginBottom: "20mm",
			marginLeft: "15mm",
			marginRight: "15mm",
		};

		// Generate and stream PDF
		wkhtmltopdf(html, pdfOptions).pipe(res);
	} catch (error) {
		console.error("Error generating PDF:", error);
		res.status(500).send(`Error generating PDF: ${error.message}`);
	}
};

const getColumnLetter = (colIdx) => {
	let letter = "";
	while (colIdx > 0) {
		const modulo = (colIdx - 1) % 26;
		letter = String.fromCharCode(65 + modulo) + letter;
		colIdx = Math.floor((colIdx - 1) / 26);
	}
	return letter;
};

export const writeExcelFilewithSubheader = async (res, data, fileName) => {
	const workbook = new ExcelJS.Workbook();
	const worksheet = workbook.addWorksheet(fileName);

	worksheet.columns = [
		{ width: 5 }, // Kolom A (kosong)
		{ key: "nis", width: 15 },
		{ key: "nama", width: 30 },
		...Object.values(data.header).flatMap((cat) =>
			cat.items.map(() => ({ width: 15 }))
		),
	];

	// Baris untuk header utama
	const headerRow = 1;
	let currentCol = 3; // Mulai dari kolom C (setelah NIS dan Nama)

	// Merge cells dan tambahkan header utama untuk setiap kategori
	Object.keys(data.header).forEach((kategori) => {
		const mergeLength = data.header[kategori].length;
		const startColLetter = getColumnLetter(currentCol);
		const endColLetter = getColumnLetter(currentCol + mergeLength - 1);
		const range = `${startColLetter}${headerRow}:${endColLetter}${headerRow}`;

		worksheet.mergeCells(range);
		worksheet.getCell(`${startColLetter}${headerRow}`).value = kategori;
		worksheet.getCell(`${startColLetter}${headerRow}`).font = {
			size: 14,
			bold: true,
		};
		worksheet.getCell(`${startColLetter}${headerRow}`).alignment = {
			horizontal: "center",
		};

		currentCol += mergeLength; // Perbarui kolom untuk kategori berikutnya
	});

	// Tambahkan sub-header (NIS, Nama, dan item dari semua kategori)
	const subHeaderRow = 2;
	const subHeaderValues = [
		// null, // Kolom A kosong
		"nis",
		"nama",
		...Object.values(data.header).flatMap((cat) =>
			cat.items.map((item) => item.nama)
		),
	];
	worksheet.getRow(subHeaderRow).values = subHeaderValues;
	worksheet.getRow(subHeaderRow).font = { bold: true };

	// Tambahkan data santri
	data.nilai.forEach((santri) => {
		const rowData = {
			nis: santri.nis,
			nama: santri.nama,
		};

		// Isi nilai untuk setiap item karakter dari semua kategori
		Object.values(data.header).forEach((cat) => {
			cat.items.forEach((item) => {
				const nilai = santri.nilai.find(
					(n) => n.karakter_id === item.id
				);
				rowData[item.nama] = nilai ? nilai.nilai : "";
			});
		});

		// Konversi rowData ke array sesuai urutan subHeaderValues
		const rowDataArray = [
			rowData.nis,
			rowData.nama,
			...Object.values(data.header).flatMap((cat) =>
				cat.items.map((item) => rowData[item.nama] || "")
			),
		];

		const row = worksheet.addRow(rowDataArray);
	});

	worksheet.columns = [
		{ width: 5 }, // Kolom A (kosong)
		{ key: "nis", width: 15 },
		{ key: "nama", width: 30 },
		...Object.values(data.header).flatMap((cat) =>
			cat.items.map(() => ({ width: 15 }))
		),
	];

	res.setHeader(
		"Content-Type",
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	);
	res.setHeader(
		"Content-Disposition",
		`attachment; filename=${fileName}.xlsx`
	);

	// Tulis file ke response
	await workbook.xlsx.write(res).catch((err) => {
		console.error("Error writing Excel file:", err);
		res.status(500).send("Error generating Excel file");
	});

	res.end();
};
export const writeExcelFilewithSubheader2 = async (
	res,
	header,
	data,
	fileName
) => {
	const workbook = new ExcelJS.Workbook();
	const worksheet = workbook.addWorksheet(fileName);
	// console.log("header", header);
	// console.log("data", data);
	// console.log("1", header)
	// console.log("2",...Object.values(header))
	// console.log("3",...Object.values(header).flatMap((cat) =>cat.nama))
	// console.log("4",...Object.values(header).flatMap((cat) =>cat.items.map((item) => item.nama)))
	worksheet.columns = [
		{ width: 5 }, // Kolom A (kosong)
		{ key: "nis", width: 15 },
		{ key: "nama", width: 30 },
		...Object.values(header).flatMap((cat) =>
			cat.items.map(() => ({ width: 15 }))
		),
	];
	// console.log("worksheet.columns");
	// Baris untuk header utama
	const headerRow = 1;
	let currentCol = 3; // Mulai dari kolom C (setelah NIS dan Nama)

	// Merge cells dan tambahkan header utama untuk setiap kategori
	Object.keys(header).forEach((kategori) => {
		const mergeLength = header[kategori].length;
		const startColLetter = getColumnLetter(currentCol);
		const endColLetter = getColumnLetter(currentCol + mergeLength - 1);
		const range = `${startColLetter}${headerRow}:${endColLetter}${headerRow}`;

		worksheet.mergeCells(range);
		worksheet.getCell(`${startColLetter}${headerRow}`).value = kategori;
		worksheet.getCell(`${startColLetter}${headerRow}`).font = {
			size: 14,
			bold: true,
		};
		worksheet.getCell(`${startColLetter}${headerRow}`).alignment = {
			horizontal: "center",
		};

		currentCol += mergeLength; // Perbarui kolom untuk kategori berikutnya
	});

	console.log("row 1");

	// Tambahkan sub-header (NIS, Nama, dan item dari semua kategori)
	const subHeaderRow = 2;
	const subHeaderValues = [
		// null, // Kolom A kosong
		"nis",
		"nama",
		...Object.values(header).flatMap((cat) =>
			cat.items.map((item) => item.nama)
		),
	];
	worksheet.getRow(subHeaderRow).values = subHeaderValues;
	worksheet.getRow(subHeaderRow).font = { bold: true };

	console.log("row 2");

	// Tambahkan data santri
	data.forEach((santri) => {
		// console.log("santri", santri);
		// const rowData = {
		// 	nis: santri.nis,
		// 	nama: santri.nama,
		// };

		// // Isi nilai untuk setiap item karakter dari semua kategori
		// Object.values(header).forEach((cat) => {
		// 	cat.items.forEach((item) => {
		// 		console.log("item", item);
		// 		console.log(santri.nilai);
		// 		const nilai = santri.find(
		// 			(n) => n.nama === item.nama
		// 		);
		// 		// const nilai = santri.nilai.find(
		// 		// 	(n) => n.karakter_id === item.id
		// 		// );
		// 		rowData[item.nama] = nilai ? nilai.nilai : "";
		// 	});
		// });

		// Konversi rowData ke array sesuai urutan subHeaderValues
		const rowDataArray = [
			santri.nis,
			santri.nama,
			...Object.values(header).flatMap((cat) =>
				cat.items.map((item) => santri[item.nama] || "")
			),
		];
		console.log("rowDataArray", rowDataArray);

		const row = worksheet.addRow(rowDataArray);
	});

	// worksheet.columns = [
	// 	{ width: 5 }, // Kolom A (kosong)
	// 	{ key: "nis", width: 15 },
	// 	{ key: "nama", width: 30 },
	// 	...Object.values(data.header).flatMap((cat) =>
	// 		cat.items.map(() => ({ width: 15 }))
	// 	),
	// ];

	res.setHeader(
		"Content-Type",
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	);
	res.setHeader(
		"Content-Disposition",
		`attachment; filename=${fileName}.xlsx`
	);

	// Tulis file ke response
	await workbook.xlsx.write(res).catch((err) => {
		console.error("Error writing Excel file:", err);
		res.status(500).send("Error generating Excel file");
	});

	res.end();
};
export const writeExcelFileNilaiKelas = async (res, header, data, fileName) => {
	const workbook = new ExcelJS.Workbook();

	// Fungsi untuk sanitasi nama worksheet
	const sanitizeWorksheetName = (name) => {
		// Hapus karakter yang tidak valid: * ? : \ / [ ]
		let sanitized = name.replace(/[\*\?\:\\\/\[\]]/g, '');
		// Batasi panjang nama menjadi 31 karakter
		sanitized = sanitized.substring(0, 31);
		// Jika nama kosong setelah sanitasi, gunakan default
		return sanitized || 'Sheet1';
	};

	// Sanitasi nama worksheet
	const sanitizedFileName = sanitizeWorksheetName(fileName);
	const worksheet = workbook.addWorksheet(sanitizedFileName);

	// Atur kolom
	worksheet.columns = [
		{ key: 'nis', width: 10 },
		{ key: 'nama', width: 20 },
		...Object.values(header).flatMap((cat) =>
			cat.items.map(() => ({ width: 30 }))
		),
	];

	// Bekukan kolom NIS dan Nama (kolom A dan B)
	worksheet.views = [
		{
			state: 'frozen',
			xSplit: 2, // Bekukan 2 kolom pertama (A dan B)
			ySplit: 0, // Tidak bekukan baris
		},
	];

	// Baris untuk header utama
	const headerRow = 1;
	let currentCol = 3; // Mulai dari kolom C (setelah NIS dan Nama)

	// Merge cells dan tambahkan header utama untuk setiap kategori
	Object.keys(header).forEach((kategori) => {
		const mergeLength = header[kategori].items.length;
		const startColLetter = getColumnLetter(currentCol);
		const endColLetter = getColumnLetter(currentCol + mergeLength - 1);
		const range = `${startColLetter}${headerRow}:${endColLetter}${headerRow}`;

		worksheet.mergeCells(range);
		const headerCell = worksheet.getCell(`${startColLetter}${headerRow}`);
		headerCell.value = kategori;
		headerCell.font = { size: 14, bold: true };
		headerCell.alignment = { horizontal: 'center' };
		// Tambahkan border tebal untuk header utama
		headerCell.border = {
			top: { style: 'thick' },
			left: { style: 'thick' },
			bottom: { style: 'thick' },
			right: { style: 'thick' },
		};

		currentCol += mergeLength; // Perbarui kolom untuk kategori berikutnya
	});

	// Tambahkan sub-header (NIS, Nama, dan item dari semua kategori)
	const subHeaderRow = 2;
	const subHeaderValues = [
		'nis',
		'nama',
		...Object.values(header).flatMap((cat) =>
			cat.items.map((item) => `${item.nama} (${item.bobot}) ${item.kode}`)
		),
	];
	worksheet.getRow(subHeaderRow).values = subHeaderValues;
	worksheet.getRow(subHeaderRow).font = { bold: true };

	// Tambahkan border tebal untuk sub-header
	worksheet.getRow(subHeaderRow).eachCell({ includeEmpty: true }, (cell) => {
		cell.border = {
			top: { style: 'thick' },
			left: { style: 'thick' },
			bottom: { style: 'thick' },
			right: { style: 'thick' },
		};
	});

	// Tambahkan data santri
	data.forEach((santri, index) => {
		// Konversi rowData ke array sesuai urutan subHeaderValues
		const rowDataArray = [
			santri.nis,
			santri.nama,
			...Object.values(header).flatMap((cat) =>
				cat.items.map((item) => santri[item.nama] || '')
			),
		];
		const row = worksheet.addRow(rowDataArray);

		// Tambahkan border tebal untuk kolom nis dan nama, border tipis untuk kolom nilai
		row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
			if (colNumber <= 2) {
				// Kolom 1 (nis) dan 2 (nama): border tebal
				cell.border = {
					top: { style: 'thick' },
					left: { style: 'thick' },
					bottom: { style: 'thick' },
					right: { style: 'thick' },
				};
			} else {
				// Kolom 3 dan seterusnya (nilai): border tipis
				cell.border = {
					top: { style: 'thin' },
					left: { style: 'thin' },
					bottom: { style: 'thin' },
					right: { style: 'thin' },
				};
			}
		});
	});

	// Atur header HTTP untuk file Excel
	res.setHeader(
		'Content-Type',
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
	);
	res.setHeader(
		'Content-Disposition',
		`attachment; filename=${sanitizedFileName}.xlsx`
	);

	// Tulis file ke response
	await workbook.xlsx.write(res).catch((err) => {
		console.error('Error writing Excel file:', err);
		res.status(500).send('Error generating Excel file');
	});

	res.end();
};
export const writeExcelFile = async (res, data, fileName) => {
	const workbook = new ExcelJS.Workbook();
	const worksheet = workbook.addWorksheet(fileName);

	worksheet.columns = [
		{ width: 5 }, // Kolom A (kosong)
		{ key: "nis", width: 15 },
		{ key: "nama", width: 30 },
		...Object.values(data.header).flatMap((cat) =>
			cat.items.map(() => ({ width: 15 }))
		),
	];

	// Baris untuk header utama
	const headerRow = 1;

	// Tambahkan sub-header (NIS, Nama, dan item dari semua kategori)
	const subHeaderRow = 2;
	const subHeaderValues = [
		// null, // Kolom A kosong
		"nis",
		"nama",
		...Object.values(data.header).flatMap((cat) =>
			cat.items.map((item) => item.nama)
		),
	];
	worksheet.getRow(subHeaderRow).values = subHeaderValues;
	worksheet.getRow(subHeaderRow).font = { bold: true };

	// Tambahkan data santri
	data.nilai.forEach((santri) => {
		// console.log("santri",santri)
		const rowData = {
			nis: santri.nis,
			nama: santri.nama,
		};

		// Isi nilai untuk setiap item karakter dari semua kategori
		Object.values(data.header).forEach((item) => {
			const nilai = santri.nilai.find((n) => n.karakter_id === item.id);
			rowData[item.nama] = nilai ? nilai.nilai : "";
		});

		const rowDataArray = [
			rowData.nis,
			rowData.nama,
			...Object.values(data.header).flatMap((cat) =>
				cat.items.map((item) => rowData[item.nama] || "")
			),
		];

		const row = worksheet.addRow(rowDataArray);
	});
	res.setHeader(
		"Content-Type",
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	);
	res.setHeader(
		"Content-Disposition",
		`attachment; filename=${fileName}.xlsx`
	);

	// Tulis file ke response
	await workbook.xlsx.write(res).catch((err) => {
		console.error("Error writing Excel file:", err);
		res.status(500).send("Error generating Excel file");
	});

	res.end();
};
export const writeExcelFile2 = async (res, data, fileName) => {
	const workbook = new ExcelJS.Workbook();
	const worksheet = workbook.addWorksheet(fileName);

	worksheet.columns = [
		{ width: 5 }, // Kolom A (kosong)
		{ key: "nis", width: 15 },
		{ key: "nama", width: 30 },
		...Object.values(data.header).flatMap((cat) =>
			cat.items.map(() => ({ width: 15 }))
		),
	];

	// Baris untuk header utama
	const headerRow = 1;

	// Tambahkan sub-header (NIS, Nama, dan item dari semua kategori)
	const subHeaderRow = 2;
	const subHeaderValues = [
		// null, // Kolom A kosong
		"nis",
		"nama",
		...Object.values(data.header).flatMap((cat) =>
			cat.items.map((item) => item.nama)
		),
	];
	worksheet.getRow(subHeaderRow).values = subHeaderValues;
	worksheet.getRow(subHeaderRow).font = { bold: true };

	// Tambahkan data santri
	data.nilai.forEach((santri) => {
		// console.log("santri",santri)
		const rowData = {
			nis: santri.nis,
			nama: santri.nama,
		};

		// Isi nilai untuk setiap item karakter dari semua kategori
		Object.values(data.header).forEach((item) => {
			const nilai = santri.nilai.find((n) => n.karakter_id === item.id);
			rowData[item.nama] = nilai ? nilai.nilai : "";
		});

		const rowDataArray = [
			rowData.nis,
			rowData.nama,
			...Object.values(data.header).flatMap((cat) =>
				cat.items.map((item) => rowData[item.nama] || "")
			),
		];

		const row = worksheet.addRow(rowDataArray);
	});
	res.setHeader(
		"Content-Type",
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	);
	res.setHeader(
		"Content-Disposition",
		`attachment; filename=${fileName}.xlsx`
	);

	// Tulis file ke response
	await workbook.xlsx.write(res).catch((err) => {
		console.error("Error writing Excel file:", err);
		res.status(500).send("Error generating Excel file");
	});

	res.end();
};

export const extractExcelData = async (req) => {
	try {
		const file = req.file;
		console.log("file", file);
		if (!file) {
			throw new AppError("File tidak ditemukan atau tidak valid", 400);
		}

		// Validasi tipe file
		const validMimeTypes = [
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
			"application/vnd.ms-excel", // .xls
		];
		if (!validMimeTypes.includes(file.mimetype)) {
			throw new AppError(
				"File harus dalam format Excel (.xlsx atau .xls)",
				400
			);
		}

		const workbook = new ExcelJS.Workbook();

		let buffer;

		// Jika buffer tersedia, gunakan langsung
		if (file.buffer) {
			buffer = file.buffer;
		} else if (file.path) {
			// Jika file disimpan ke disk, baca dari path
			buffer = await fs.readFile(file.path);
		} else {
			throw new AppError("File tidak memiliki buffer atau path", 400);
		}
		await workbook.xlsx.load(buffer);

		const worksheet = workbook.worksheets[0];
		if (!worksheet) {
			throw new AppError(
				"Worksheet tidak ditemukan dalam file Excel",
				400
			);
		}

		const data = [];
		// Ambil header dari baris kedua (sesuaikan dengan struktur file Anda)
		const headerRow = worksheet.getRow(2);
		const headers = headerRow.values.slice(2).filter(Boolean); // Mengabaikan kolom pertama dan nilai null/undefined

		if (!headers.length) {
			throw new AppError("Header tidak ditemukan di baris kedua", 400);
		}

		// Iterasi setiap baris mulai dari baris ketiga
		for (let i = 3; i <= worksheet.rowCount; i++) {
			const row = worksheet.getRow(i);
			console.log("row", row.values);
			if (row.values.length <= 1) continue; // Skip baris kosong

			const rowData = {};
			headers.forEach((header, index) => {
				rowData[header] = row.getCell(index + 2).value || ""; // Mulai dari kolom kedua
			});

			// Tambahkan NIS dan nama dari kolom pertama dan kedua
			rowData.nis = row.getCell(1).value || "";
			rowData.nama = row.getCell(2).value || "";
			// rowData.minggu = row.getCell(3).value || "";
			data.push(rowData);
		}

		return data;
	} catch (error) {
		throw new AppError(
			`Gagal mengekstrak data Excel: ${error.message}`,
			error.statusCode || 500
		);
	}
};
