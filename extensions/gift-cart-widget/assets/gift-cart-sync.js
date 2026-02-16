/**
 * Gift Widget Cart Sync
 * Ensures that if a Gift Wrap is removed, the associated Main Product properties are cleaned up.
 */
(function () {
    const DEBUG = true;

    function log(...args) {
        if (DEBUG) console.log('GiftSync:', ...args);
    }

    // --- Core Logic ---

    async function checkCartConsistency() {
        try {
            const res = await fetch(window.Shopify.routes.root + 'cart.js');
            const cart = await res.json();

            if (!cart.items || cart.items.length === 0) return;

            const bundleMap = {};

            // 1. Map items by bundle_id
            cart.items.forEach((item, index) => {
                const props = item.properties || {};
                const bundleId = props['_bundle_id'];

                if (bundleId) {
                    if (!bundleMap[bundleId]) {
                        bundleMap[bundleId] = { main: [], gift: [] };
                    }

                    // Identify role based on properties
                    // Gift Wrapper has 'Gift For' (visible) or '_related_product' (legacy/hidden)
                    if (props['Gift For'] || props['_related_product']) {
                        bundleMap[bundleId].gift.push({ ...item, _index: index + 1 }); // 1-based index for API
                    } else {
                        bundleMap[bundleId].main.push({ ...item, _index: index + 1 });
                    }
                }
            });

            // 2. Identify Orphans (Main exists, Gift missing)
            const updates = {};
            let hasUpdates = false;

            for (const [bundleId, group] of Object.entries(bundleMap)) {
                // If we have Main item(s) but NO Gift item
                if (group.main.length > 0 && group.gift.length === 0) {
                    log(`Orphan detected for Bundle ${bundleId}. Cleaning properties...`);

                    group.main.forEach(item => {
                        // Mark for property cleanup
                        // To remove properties, valid way is to set them to null or empty string via /cart/change.js
                        // But /cart/update.js only updates quantities usually. 
                        // We must use /cart/change.js line-by-line or find a bulk update method for props.
                        // Actually, using /cart/change.js with 'properties' object updates them.
                        // We need to trigger this immediately.

                        hasUpdates = true;
                        updateItemProperties(item.key, {
                            'Gift Wrap': null,
                            'Gift Type': null,
                            'Gift Message': null,
                            'Digital Format': null,
                            '_bundle_id': null,
                            '_gift_type': null,
                            '_message': null,
                            '_digital_format': null
                        });
                    });
                }
            }

        } catch (err) {
            console.error('GiftSync: Error checking cart', err);
        }
    }

    async function updateItemProperties(lineKey, newProps) {
        try {
            await fetch(window.Shopify.routes.root + 'cart/change.js', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: lineKey,
                    properties: newProps
                })
            });
            log('Cleaned up item', lineKey);
            // Optionally reload if on Cart page to reflect changes? 
            // Better to just let it settle, or trigger a refresh event.
            // If we are in drawer, simple value update might not be visible immediately, but Order will be correct.
        } catch (e) {
            console.error('GiftSync: Failed to update item', e);
        }
    }

    // --- Interceptors ---
    // Watch for Cart API calls to trigger consistency check

    const originalFetch = window.fetch;
    window.fetch = function () {
        const promise = originalFetch.apply(this, arguments);
        const url = arguments[0];

        // Simple check if URL involves cart modification
        if (typeof url === 'string' && (
            url.includes('/cart/add') ||
            url.includes('/cart/change') ||
            url.includes('/cart/update') ||
            url.includes('/cart/clear')
        )) {
            promise.then((res) => {
                if (res.ok) {
                    // Give Shopify a moment to process, then check
                    setTimeout(checkCartConsistency, 500);
                }
            });
        }

        return promise;
    };

    // Also check on load
    document.addEventListener('DOMContentLoaded', checkCartConsistency);

})();
