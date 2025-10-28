/**
 * 🚀 Kythia Core Library - Entry Point (CJS Fleksibel)
 *
 * Mengekspor 'Kythia' sebagai ekspor utama,
 * dan menempelkan (attach) ekspor lain sebagai properti
 * agar bisa di-destructure.
 */

// 1. Ambil kelas utama
const Kythia = require('./src/Kythia.js');

// 2. Set kelas utama sebagai EKSPOR UTAMA (module.exports)
// Ini yang bikin "const Kythia = require('kythia-core')" BISA
module.exports = Kythia;

// 3. Tempelkan SEMUA ekspor (termasuk Kythia sendiri)
//    sebagai PROPERTI dari ekspor utama.
// Ini yang bikin "const { Kythia, KythiaModel } = require('kythia-core')" BISA

/** Kelas Utama Bot (buat destructuring) */
module.exports.Kythia = Kythia;

/** Kelas Discord Client yang di-extend */
module.exports.KythiaClient = require('./src/KythiaClient.js');

/** Kelas Model dasar untuk Sequelize */
module.exports.KythiaModel = require('./src/database/KythiaModel.js');

/** Fungsi untuk inisialisasi Sequelize */
module.exports.createSequelizeInstance = require('./src/database/KythiaSequelize.js');

/** (Opsional) Helper lain jika dibutuhkan addons */
module.exports.KythiaORM = require('./src/database/KythiaORM.js');

module.exports.utils = require('./src/utils/index.js');