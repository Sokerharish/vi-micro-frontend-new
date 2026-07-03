/* ============================================================
   Vi Microsystems — Shared Cart Engine
   Persistent cart using localStorage. No backend / no real
   payment processing — for demo / UI purposes only.
   ============================================================ */

(function (window) {
    'use strict';

    var STORAGE_KEY = 'vims_cart_v1';
    var CURRENCY_KEY = 'vims_currency_v1';
    var USD_RATE = 83; // approx INR per USD, used only for display conversion

    // Your live backend's address on Render — same one account.js uses.
    var API_BASE_URL = 'https://vi-microsystems-backend.onrender.com';

    /* ---------- Product Catalog ----------
       Single source of truth for name / price / image per product.
       price: number in INR, or null if "Price on Request" (cannot be added to cart).
       isPlaceholder: true means this price is a TEMPORARY stand-in and must be
       updated with the real price before going live. */
    var CATALOG = {
        'esp32': {
            name: 'MR Robo ESP32',
            price: 9999,
            isPlaceholder: true,
            img: 'robo esp32.png',
            url: 'products/esp32.html'
        },
        'unoq': {
            name: 'MR Robo UNO Q',
            price: 9999,
            isPlaceholder: true,
            img: 'robo uno.png',
            url: 'products/unoq.html'
        },
        'orin': {
            name: 'MR Robo Jetson Orin',
            price: 9999,
            isPlaceholder: true,
            img: 'Screenshot 2026-05-21 114115.png',
            url: 'products/orin.html'
        },
        'cobot': {
            name: 'ASYSTR 3C Cobot',
            price: 1457142,
            img: 'soker2.jpg',
            url: 'products/cobot.html'
        },
        'vilan': {
            name: 'Vi LaN-05 Trainer',
            price: 88660,
            img: 'soker3.png',
            url: 'products/vilan.html'
        },
        'dsp379d': {
            name: 'TMS320F28379D PWM Controller',
            price: 25234,
            img: 'soker5.png',
            url: 'products/dsp379d.html'
        },
        'llmchatbot': {
            name: 'Local LLM AI ChatBot Kit',
            price: 9999,
            isPlaceholder: true,
            img: 'SOKER HARISH.jpeg',
            url: 'products/llmchatbot.html'
        }
    };

    function readCart() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    function writeCart(cart) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
        } catch (e) { /* storage unavailable — fail silently */ }
        broadcastUpdate();
    }

    function getCurrency() {
        return localStorage.getItem(CURRENCY_KEY) || 'INR';
    }

    function setCurrency(code) {
        localStorage.setItem(CURRENCY_KEY, code);
        broadcastUpdate();
    }

    function formatPrice(inrAmount) {
        var currency = getCurrency();
        if (currency === 'USD') {
            var usd = inrAmount / USD_RATE;
            return '$' + usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        return '\u20B9 ' + Math.round(inrAmount).toLocaleString('en-IN');
    }

    function addItem(productId, qty) {
        qty = qty || 1;
        var product = CATALOG[productId];
        if (!product || product.price === null) return false; // can't cart an unpriced item
        var cart = readCart();
        cart[productId] = (cart[productId] || 0) + qty;
        writeCart(cart);
        return true;
    }

    function removeItem(productId) {
        var cart = readCart();
        delete cart[productId];
        writeCart(cart);
    }

    function setQty(productId, qty) {
        var cart = readCart();
        qty = parseInt(qty, 10);
        if (!qty || qty < 1) {
            delete cart[productId];
        } else {
            cart[productId] = qty;
        }
        writeCart(cart);
    }

    function clearCart() {
        writeCart({});
    }

    function getLines() {
        var cart = readCart();
        var lines = [];
        Object.keys(cart).forEach(function (id) {
            var product = CATALOG[id];
            if (!product) return;
            var qty = cart[id];
            lines.push({
                id: id,
                name: product.name,
                img: product.img,
                url: product.url,
                price: product.price,
                isPlaceholder: !!product.isPlaceholder,
                qty: qty,
                subtotal: product.price * qty
            });
        });
        return lines;
    }

    function getItemCount() {
        var cart = readCart();
        return Object.keys(cart).reduce(function (sum, id) { return sum + cart[id]; }, 0);
    }

    function getSubtotal() {
        return getLines().reduce(function (sum, line) { return sum + line.subtotal; }, 0);
    }

    function broadcastUpdate() {
        document.querySelectorAll('[data-cart-count]').forEach(function (el) {
            var n = getItemCount();
            el.textContent = n + (n === 1 ? ' item' : ' items');
        });
        var evt = new CustomEvent('cart:updated');
        window.dispatchEvent(evt);
    }

    function submitOrder(customerInfo) {
        var lines = getLines();
        if (lines.length === 0) {
            return Promise.resolve({ ok: false, error: 'Your cart is empty.' });
        }
        if (!customerInfo || !customerInfo.name || !customerInfo.email) {
            return Promise.resolve({ ok: false, error: 'Name and email are required to place an order.' });
        }

        var items = lines.map(function (line) {
            return {
                productId: line.id,
                productName: line.name,
                unitPriceInr: line.price,
                quantity: line.qty
            };
        });

        var headers = { 'Content-Type': 'application/json' };
        
        // Dynamic evaluation utilizing the global unified ViAccount helper instance
        try {
            if (window.ViAccount && window.ViAccount.isLoggedIn()) {
                var token = window.ViAccount.getToken();
                if (token) {
                    headers['Authorization'] = 'Bearer ' + token;
                }
            }
        } catch (e) { /* fallback as guest if state window drops */ }

        return fetch(API_BASE_URL + '/api/orders', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                customerName: customerInfo.name,
                customerEmail: customerInfo.email,
                customerPhone: customerInfo.phone || null,
                shippingAddress: customerInfo.address || null,
                currency: getCurrency(),
                items: items
            })
        })
            .then(function (res) { return res.json().then(function (data) { return { status: res.status, data: data }; }); })
            .then(function (result) {
                if (result.status >= 400) {
                    return { ok: false, error: result.data.error || 'Could not place order.' };
                }
                clearCart(); // empty the cart now that the order is placed
                return { ok: true, order: result.data.order };
            })
            .catch(function () {
                return { ok: false, error: 'Could not reach the server. Please check your internet connection and try again.' };
            });
    }

    document.addEventListener('DOMContentLoaded', broadcastUpdate);

    window.ViCart = {
        CATALOG: CATALOG,
        addItem: addItem,
        removeItem: removeItem,
        setQty: setQty,
        clearCart: clearCart,
        getLines: getLines,
        getItemCount: getItemCount,
        getSubtotal: getSubtotal,
        formatPrice: formatPrice,
        getCurrency: getCurrency,
        setCurrency: setCurrency,
        submitOrder: submitOrder
    };

})(window);