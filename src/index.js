import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { config } from './config/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './config/logger.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const app = express();

// Security Middleware
app.use(helmet()); // Helps secure Express apps with various HTTP headers
app.use(cors({
  exposedHeaders: ['new-authorization'], // Izinkan header kustom
})); // Enable Cross-Origin Resource Sharing
app.use(compression()); // Compress response bodies

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Request logging
// app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(morgan(':method :url :status', {
  stream: { write: message => logger.info(message.trim()) }
}));

// Body parsing
app.use(express.json({ limit: '10kb' })); // Body limit is 10kb
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));
app.use('/images', express.static(path.join(__dirname, '../public/pdf_template/images')));
app.use('/pdf_template', express.static(path.join(__dirname, '../public/pdf_template')));

// API Routes
import userRoutes from './routes/user.route.js';
import authRoutes from './routes/auth.route.js';
import guru_pegawaiRoutes from "./routes/guru_pegawai.route.js";
import santriRoutes from "./routes/santri.route.js";
import rombelRoutes from "./routes/rombel.route.js";
import tahunAjaranRoutes from './routes/tahun_ajaran.route.js'
import kelasRoutes from './routes/kelas.route.js'
import semesterRoutes from './routes/semester.route.js'
import rombelAnggotaRoutes from './routes/rombel_anggota.route.js'
import * as path from "node:path";
import ktiRoutes from "./routes/kti.route.js";
import ekskulSantriRoutes from "./routes/ekskul_santri.route.js";
import ekskulRoute from "./routes/ekskul.route.js";
import prestasiPelanggaranRoute from "./routes/prestasi_pelanggaran.route.js";
import rolesRoutes from "./routes/role.route.js";
import dataKelasRoutes from "./routes/data_kelas.route.js";
import rombelKelasRoutes from "./routes/rombel_kelas.route.js";
import mapelRoute from "./routes/mapel.route.js";
import komponenRoutes from "./routes/komponen.route.js";
import rencanaPenilaianRoutes from "./routes/rencana_penilaian.route.js";
import kurikulumRoutes from "./routes/kurikulum.route.js";
import jamPelajaranRoutes from "./routes/jam_pelajaran.route.js";
import raporRoutes from "./routes/rapor.route.js";
import kkmRoutes from "./routes/kkm.route.js";
import rosterRoutes from "./routes/roster.route.js";
import kompetensiRoutes from "./routes/kompetensi.route.js";
import jenjangRoutes from "./routes/jenjang.route.js";
import dataNilaiKelasRoutes from "./routes/data_nilai_kelas.route.js";
import izinSantriRoutes from "./routes/izin_santri.route.js";
import catatanWkWfRoutes from "./routes/catatan_wk_wf.route.js";
import dataNilaiEskulController from "./routes/data_nilai_eskul.route.js";

import beasiswaRouter from "./routes/beasiswa.route.js";
import beasiswsSantriRouter from "./routes/beasiswa_santri.route.js";

// import tagihanSantriRouter from "./routes/tagihan_santri.route.js";
import SkemaTagihanRouter  from './routes/skema_tagihan.route.js';
import dataTagihanRouter from "./routes/data_tagihan.route.js";
import coaRouter from './routes/coa.route.js';

import masterKarakterRoutes from './routes/master_karakter.route.js';
import nilaiKarakterRoutes from './routes/nilai_karakter.route.js';

import organisasiRoutes from './routes/organisasi.route.js';
import dataAnggotaOrganisasiRoutes from './routes/data_anggota_organisasi.route.js';
import dataNilaiiOrganisasiRoutes from './routes/data_nilai_organisasi.route.js';

import rekapKehadiranRoutes from './routes/rekap_kehadiran.route.js';

import lakRoutes from "./routes/lak.route.js";

import dataNilaiLakRoutes from "./routes/data_nilai_lak.route.js";

app.use('/auth', authRoutes);
app.use('/tahun-ajarans', tahunAjaranRoutes)
app.use('/guru-pegawais', guru_pegawaiRoutes);
app.use('/users', userRoutes);
app.use('/santris', santriRoutes);
app.use('/rombels', rombelRoutes);
app.use('/kelas', kelasRoutes);
app.use('/semesters', semesterRoutes);
app.use('/rombel-anggotas', rombelAnggotaRoutes);
app.use('/kti', ktiRoutes);
app.use('/ekskul-santris', ekskulSantriRoutes);
app.use('/ekskuls', ekskulRoute);
app.use('/prestasi-pelanggarans', prestasiPelanggaranRoute);
app.use('/roles', rolesRoutes);
app.use('/data-kelas', dataKelasRoutes);
app.use('/rombel-kelas', rombelKelasRoutes);
app.use('/mapels', mapelRoute);
app.use('/komponens', komponenRoutes);
app.use('/rencana-penilaians', rencanaPenilaianRoutes);
app.use('/kurikulums', kurikulumRoutes);
app.use('/jam-pelajarans', jamPelajaranRoutes);
app.use('/rapors', raporRoutes);
app.use('/kkms', kkmRoutes);
app.use('/rosters', rosterRoutes);
app.use('/kompetensis', kompetensiRoutes);
app.use('/jenjangs', jenjangRoutes);
app.use('/data-nilai-kelas', dataNilaiKelasRoutes);
app.use('/izin-santris', izinSantriRoutes);
app.use('/catatan-wk-wfs', catatanWkWfRoutes);
app.use('/data-nilai-eskuls', dataNilaiEskulController);
// app.use('/tagihan', tagihanSantriRouter)
app.use('/skema-tagihan',SkemaTagihanRouter)
app.use('/data-tagihan-santri', dataTagihanRouter)
app.use('/coa', coaRouter);

app.use('/master-karakter', masterKarakterRoutes);
app.use('/nilai-karakter', nilaiKarakterRoutes);

app.use('/organisasis', organisasiRoutes);
app.use('/data-anggota-organisasis', dataAnggotaOrganisasiRoutes);
app.use('/data-nilai-organisasis', dataNilaiiOrganisasiRoutes);

app.use('/rekap-kehadirans', rekapKehadiranRoutes);

app.use('/laks', lakRoutes);

app.use('/data-nilai-laks', dataNilaiLakRoutes);

// Error handling
app.use(errorHandler);

// Handle unhandled routes
app.use('*', (req, res) => {  
  res.status(404).json({
    status: 'error',
    message: `Can't find ${req.originalUrl} on this server!`
  });
});

// Start server
const PORT = config.port;
// console.log(config)
app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});

export default app;