/* ============================================================
   Vi Microsystems — Shared Account Engine (REAL BACKEND VERSION)
   Talks to the real server running at API_BASE_URL below.
   The login "session" (a token) is still kept in localStorage —
   that part is normal and safe; it's just remembering "this
   browser is logged in," the same way every real website does.
   What changed from before: passwords are now actually checked
   by the server with proper hashing, and accounts are stored in
   a real database that works across devices/browsers, not just
   the one browser that created them.
   ============================================================ */

(function (window) {
    'use strict';

    // Your live backend's address on Render.
    var API_BASE_URL = 'https://vi-microsystems-backend.onrender.com';

    var SESSION_KEY = 'vims_session_v1'; // { token, user: { id, name, email } }

    function getSession() {
        try {
            var raw = localStorage.getItem(SESSION_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function setSession(session) {
        try {
            if (session) {
                localStorage.setItem(SESSION_KEY, JSON.stringify(session));
            } else {
                localStorage.removeItem(SESSION_KEY);
            }
        } catch (e) { /* storage unavailable */ }
        broadcastUpdate();
    }

    function getToken() {
        var session = getSession();
        return session ? session.token : null;
    }

    // register() and login() are now ASYNC (they return a Promise),
    // because talking to a real server takes a moment over the network —
    // unlike the old version, which was instant since it never left the browser.
    function register(name, email, password) {
        return fetch(API_BASE_URL + '/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, email: email, password: password })
        })
            .then(function (res) { return res.json().then(function (data) { return { status: res.status, data: data }; }); })
            .then(function (result) {
                if (result.status >= 400) {
                    return { ok: false, error: result.data.error || 'Registration failed.' };
                }
                setSession({ token: result.data.token, user: result.data.user });
                return { ok: true };
            })
            .catch(function () {
                return { ok: false, error: 'Could not reach the server. Please check your internet connection and try again.' };
            });
    }

    function login(email, password) {
        return fetch(API_BASE_URL + '/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, password: password })
        })
            .then(function (res) { return res.json().then(function (data) { return { status: res.status, data: data }; }); })
            .then(function (result) {
                if (result.status >= 400) {
                    return { ok: false, error: result.data.error || 'Login failed.' };
                }
                setSession({ token: result.data.token, user: result.data.user });
                return { ok: true };
            })
            .catch(function () {
                return { ok: false, error: 'Could not reach the server. Please check your internet connection and try again.' };
            });
    }

    function logout() {
        setSession(null);
    }

    function isLoggedIn() {
        return !!getSession();
    }

    // getSessionForDisplay() returns just the { name, email } shape that the
    // rest of the site expects (account.html reads session.name / session.email).
    function getSessionForDisplay() {
        var session = getSession();
        if (!session || !session.user) return null;
        return { name: session.user.name, email: session.user.email };
    }

    function broadcastUpdate() {
        var display = getSessionForDisplay();
        document.querySelectorAll('[data-account-name]').forEach(function (el) {
            el.textContent = display ? display.name : 'Sign In';
        });
        document.querySelectorAll('[data-account-link]').forEach(function (el) {
            el.href = 'account.html';
        });
        var evt = new CustomEvent('account:updated');
        window.dispatchEvent(evt);
    }

    document.addEventListener('DOMContentLoaded', broadcastUpdate);

    window.ViAccount = {
        register: register,
        login: login,
        logout: logout,
        isLoggedIn: isLoggedIn,
        getSession: getSessionForDisplay,
        getToken: getToken,
        API_BASE_URL: API_BASE_URL
    };

})(window);