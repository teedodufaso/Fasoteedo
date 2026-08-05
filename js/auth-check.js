/* =============================================
   FASO TEEDO - VÉRIFICATION AUTHENTIFICATION
   Version 2.2 - Compatible hors-ligne TOTAL
   ============================================= */

(function() {
    'use strict';
    
    // Ne pas exécuter sur la page d'accueil (index.html) ni ventes.html
    const path = window.location.pathname;
    if (path.includes('index.html') || path === '/' || path.endsWith('/faso_teedo/')) {
        return;
    }
    
    // Ventes est en accès libre
    if (path.includes('ventes.html')) {
        console.log('🛡️ Ventes - Accès libre');
        return;
    }
    
    function verifierAuthentification() {
        // ✅ Vérifier la session locale (toujours disponible)
        if (!checkSession()) {
            console.warn('⚠️ Session invalide');
            redirigerAccueil('session_expired');
            return false;
        }
        
        // ✅ Toujours accepter si session valide (online ou offline)
        rafraichirSession();
        console.log('✅ Session valide');
        return true;
    }
    
    function rafraichirSession() {
        try {
            const sessionData = localStorage.getItem('faso_teedo_session');
            if (sessionData) {
                const session = JSON.parse(sessionData);
                session.expiration = Date.now() + (8 * 60 * 60 * 1000);
                localStorage.setItem('faso_teedo_session', JSON.stringify(session));
            }
        } catch (error) {
            console.error('Erreur rafraîchissement session:', error);
        }
    }
    
    function getPageName() {
        if (path.includes('pointage')) return 'Pointage';
        if (path.includes('admin')) return 'Administration';
        if (path.includes('dashboard')) return 'Tableau de bord';
        return 'Application';
    }
    
    function redirigerAccueil(raison) {
        const pageName = getPageName();
        const redirectUrl = `index.html?redirect=${encodeURIComponent(pageName)}&reason=${raison}`;
        setTimeout(function() {
            window.location.href = redirectUrl;
        }, 500);
    }
    
    function checkSession() {
        try {
            const sessionData = localStorage.getItem('faso_teedo_session');
            if (!sessionData) return false;
            const session = JSON.parse(sessionData);
            if (!session.expiration || Date.now() > session.expiration) {
                localStorage.removeItem('faso_teedo_session');
                return false;
            }
            return true;
        } catch (error) {
            return false;
        }
    }
    
    // === EXÉCUTION ===
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            verifierAuthentification();
        });
    } else {
        verifierAuthentification();
    }
    
    // Protection contre le retour en arrière
    window.addEventListener('pageshow', function(event) {
        if (event.persisted && !checkSession()) {
            window.location.href = 'index.html';
        }
    });
    
    console.log('🛡️ Auth-check V2.2 chargé');
})();
