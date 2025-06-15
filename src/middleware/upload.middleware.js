import multer, { diskStorage } from 'multer';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as fs from "node:fs";

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Dynamic storage configuration
const storage = diskStorage({
    destination: (req, file, cb) => {
        const baseDir = join(__dirname, '../../../uploads');

        const url = req.url;
        const urlParts = req.baseUrl.split('/').filter(part => part.length > 0);
        let folderName = '';
        if (urlParts.includes('santris') && url === '/mass-input') {
            folderName = 'data_massal';
        } else if (urlParts.includes('guru-pegawais')) {
            folderName = 'foto_guru_pegawai';
        } else if (urlParts.includes('santris')) {
            folderName = 'foto_santri';
        } else if (urlParts.includes('prestasi-pelanggarans')) {
            console.log(JSON.parse(req.body.data));
            if (JSON.parse(req.body.data).perihal === "prestasi") {
                folderName = '/bukti-prpl/prestasi';
            } else if (JSON.parse(req.body.data).perihal === "pelanggaran") {
                folderName = '/bukti-prpl/pelanggaran';
            }
        } else if (urlParts.includes('nilai-karakter')) {
            folderName = 'nilai_karakter';
        } else if (urlParts.includes('rombels')) {
            folderName = 'ttd_gp';
        } else if (urlParts.includes('rapors')) {
            folderName = 'ttd_kepsek';
        } else if (urlParts.includes('upload-batch-nilai')) {
            folderName = 'batch_nilai_kelas';
        }
        const destPath = join(baseDir, folderName);

        // Ensure the directory exists
        if (!fs.existsSync(destPath)) {
            fs.mkdirSync(destPath, { recursive: true });
        }

        cb(null, destPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        let name = '';

        try {
            // Parse req.body.data safely
            const data = req.body.data ? JSON.parse(req.body.data) : {};
            const urlParts = req.baseUrl.split('/').filter(part => part.length > 0);

            if (urlParts.includes('santri') || urlParts.includes('santris')) {
                name = data.nama
                    ? data.nama.toLowerCase().replace(/\s+/g, '-')
                    : file.originalname.split('.')[0].toLowerCase().replace(/\s+/g, '-');
            } else if (urlParts.includes('guru-pegawais')) {
                name = data.nama_gp
                    ? data.nama_gp.toLowerCase().replace(/\s+/g, '-')
                    : file.originalname.split('.')[0].toLowerCase().replace(/\s+/g, '-');
            } else if (urlParts.includes('mass-input')) {
                name = "data-massal";
            } else if (urlParts.includes('prestasi-pelanggarans')) {
                name = data.id_santri
                    ? data.id_santri
                    : file.originalname.split('.')[0].toLowerCase().replace(/\s+/g, '-');
            } else if (urlParts.includes('nilai-karakter')) {
                name = data.nama
                    ? data.nama.toLowerCase().replace(/\s+/g, '-')
                    : file.originalname.split('.')[0].toLowerCase().replace(/\s+/g, '-');
            } else if (urlParts.includes('rombels')) {
                name = 'ttd'
            } else if (urlParts.includes('rapors')) {
                name = 'ttd-kepsek'
            } else if (urlParts.includes('upload-batch-nilai')) {
                name = 'batch-nilai-kelas';
            }
        } catch (err) {
            console.error(`Error parsing request body data: ${err.message}`);
            // Fallback to file's original name if data is not provided or is invalid
            name = file.originalname.split('.')[0].toLowerCase().replace(/\s+/g, '-');
        }

        cb(null, `${name}-${uniqueSuffix}${extname(file.originalname)}`);
    },
});

// Initialize multer middleware
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // File size limit: 5MB
});

export { upload };
