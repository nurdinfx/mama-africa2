import { dbService } from './db';
import { productAPI, tableAPI, orderAPI, customerAPI, authAPI, supplierAPI, inventoryAPI } from '../api/realApi';

export const syncService = {
    // Sync core data from Server to IDB
    syncDataDown: async () => {
        try {
            if (!navigator.onLine) return; // Only sync if online

            console.log('🔄 Starting data sync...');

            // 1. Sync Products
            try {
                const productRes = await productAPI.getProducts({ limit: 1000 });
                if (productRes.success) {
                    await dbService.clear('products');
                    await dbService.put('products', productRes.data);
                    console.log('✅ Products synced');
                }
            } catch (e) { console.error('Failed to sync products', e); }

            // 2. Sync Categories (if available via API, or extract from products)
            try {
                const categoryRes = await productAPI.getCategories();
                if (categoryRes.success) {
                    await dbService.clear('categories');
                    await dbService.put('categories', categoryRes.data);
                    console.log('✅ Categories synced');
                }
            } catch (e) { console.error('Failed to sync categories', e); }

            // 3. Sync Tables
            try {
                const tableRes = await tableAPI.getTables();
                if (tableRes.success) {
                    await dbService.clear('tables');
                    await dbService.put('tables', tableRes.data);
                    console.log('✅ Tables synced');
                }
            } catch (e) { console.error('Failed to sync tables', e); }

            // 4. Sync Customers
            try {
                const customerRes = await customerAPI.getCustomers({ limit: 1000 });
                if (customerRes.success) {
                    await dbService.clear('customers');
                    await dbService.put('customers', customerRes.data);
                    console.log('✅ Customers synced');
                }
            } catch (e) { console.error('Failed to sync customers', e); }

            // 5. Sync Users (Using custom endpoint or current user if not admin. Assuming admin rights for simplicity or just caching needed users)
            // Note: Usually frontend doesn't need ALL users unless for "Served By" selection

            console.log('✨ Data sync completed');

        } catch (error) {
            console.error('❌ Sync failed:', error);
        }
    },

    // Sync offline orders from IDB to Server
    syncOfflineOrdersUp: async () => {
        try {
            if (!navigator.onLine) return;

            const offlineOrders = await dbService.getAll('offline_orders');
            if (!offlineOrders.length) return;

            console.log(`📤 Syncing ${offlineOrders.length} offline orders...`);

            for (const order of offlineOrders) {
                try {
                    const { tempId, ...orderData } = order;
                    const res = await orderAPI.createOrder(orderData);

                    if (res.success) {
                        await dbService.delete('offline_orders', tempId);
                        console.log(`✅ Offline order ${tempId} synced`);
                    } else {
                        console.error(`❌ Failed to sync order ${tempId}:`, res.message);
                    }
                } catch (error) {
                    console.error(`❌ Error syncing order ${order.tempId}:`, error);
                }
            }
        } catch (error) {
            console.error('❌ Offline order sync failed:', error);
        }
    }
};
