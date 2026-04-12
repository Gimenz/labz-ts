import { SQLiteStore } from '../src/store/sqlite-store';

async function runMaintenance() {
    const store = new SQLiteStore();

    console.log('📊 Storage Stats Before:');
    const before = store.getStorageStats();
    console.log(before);

    console.log('\n🗜️  Archiving messages older than 90 days...');
    store.archiveOldMessages(90);

    console.log('🧹 Vacuuming database...');
    store.vacuum();

    console.log('\n📊 Storage Stats After:');
    const after = store.getStorageStats();
    console.log(after);

    store.close();
}

runMaintenance().catch(console.error);