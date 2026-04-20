// Gerenciador Local Offline via IndexedDB

const DB_NAME = "mapaDenunciasDB";
const DB_VERSION = 1;

class OfflineStorage {
    constructor() {
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Store para denúncias em cache (leitura offline)
                if (!db.objectStoreNames.contains('reports_cache')) {
                    db.createObjectStore('reports_cache', { keyPath: 'id' });
                }

                // Store para fila de sincronização (denúncias feitas offline para enviar depois)
                if (!db.objectStoreNames.contains('sync_queue')) {
                    db.createObjectStore('sync_queue', { keyPath: 'temp_id', autoIncrement: true });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log("[IndexedDB] Banco de dados inicializado com sucesso.");
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error("[IndexedDB] Erro ao abrir banco de dados:", event.target.error);
                reject(event.target.error);
            };
        });
    }

    // Operações para CACHE DE LEITURA

    async saveReportsToCache(reports) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['reports_cache'], 'readwrite');
            const store = transaction.objectStore('reports_cache');

            // Limpa o store antigo e insere os novos
            store.clear().onsuccess = () => {
                reports.forEach(report => store.add(report));
            };

            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error);
        });
    }

    async getCachedReports() {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['reports_cache'], 'readonly');
            const store = transaction.objectStore('reports_cache');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.result);
        });
    }

       // Operações para FILA DE SINCRONIZAÇÃO (OFFLINE SEND)
   
    async addToSyncQueue(reportPayload) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sync_queue'], 'readwrite');
            const store = transaction.objectStore('sync_queue');
            
            const request = store.add({
                ...reportPayload,
                timestamp: new Date().getTime(),
                status: 'pending_sync'
            });

            request.onsuccess = () => {
                if ('serviceWorker' in navigator && 'SyncManager' in window) {
                    navigator.serviceWorker.ready.then((swRegistration) => {
                        return swRegistration.sync.register('sync-denuncias');
                    });
                }
                resolve(true);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getSyncQueue() {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sync_queue'], 'readonly');
            const store = transaction.objectStore('sync_queue');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async clearSyncItem(tempId) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sync_queue'], 'readwrite');
            const store = transaction.objectStore('sync_queue');
            const request = store.delete(tempId);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    // Processador de fila que deve ser chamado assim que a internet voltar
    async processSyncQueue(apiFunction) {
        if (!navigator.onLine) return;

        const queue = await this.getSyncQueue();
        if (queue.length === 0) return;

        console.log(`[Sync] Processando ${queue.length} denúncias pendentes de quando estivemos offline...`);

        for (const item of queue) {
            try {
                // Tenta engatilhar a API real
                await apiFunction(item);
                // Se der certo, removemos da fila local
                await this.clearSyncItem(item.temp_id);
                console.log(`[Sync] Item ${item.temp_id} sincronizado com a nuvem!`);
            } catch (err) {
                console.error(`[Sync] Falha ao sincronizar item ${item.temp_id}`, err);
                // Para no primeiro erro para não inundar rede instável
                break; 
            }
        }
    }
}

// Instância global para uso na aplicação
window.offlineDB = new OfflineStorage();
window.offlineDB.init();
