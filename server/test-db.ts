import { db } from './database';

async function test() {
  try {
    const tables: any = await db.query("SHOW TABLES");
    console.log("✅ Koneksi Berhasil! Tabel yang ditemukan:");
    console.table(tables);
  } catch (err) {
    console.error("❌ Koneksi Gagal. Pastikan XAMPP (MySQL) sudah Start.");
  }
}

test();