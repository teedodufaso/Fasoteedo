/* =============================================
   FASO TEEDO - CONFIGURATION SUPABASE
   Version 17.0 - CORRECTION ENREGISTREMENT
   ============================================= */

const SUPABASE_URL = 'https://wapbnsjfdgekxrjytqme.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhcGJuc2pmZGdla3hyanl0cW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3OTQ1NzQsImV4cCI6MjEwMDM3MDU3NH0.yKHdqc-npNcDvmlfAsYHZEYvEJVSfdnncgiIDRGnm88';

let supabaseClient = null;
let configPromise = null;

// ==========================================
// 🌐 GESTION CONNEXION
// ==========================================
let isOnline = navigator.onLine;

function creerIndicateursUI() {
    if (document.getElementById('indicateurConnexion')) return;
    const indicateur = document.createElement('div');
    indicateur.id = 'indicateurConnexion';
    indicateur.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:99999;padding:4px 16px;border-radius:20px;font-size:0.75rem;font-weight:600;color:white;transition:all 0.3s;pointer-events:none;';
    document.body.appendChild(indicateur);
}

function mettreAJourIndicateurs() {
    const indicateur = document.getElementById('indicateurConnexion');
    if (indicateur) {
        indicateur.style.background = isOnline ? '#27ae60' : '#e74c3c';
        indicateur.textContent = isOnline ? '🟢 En ligne' : '🔴 Hors-ligne';
    }
}

window.addEventListener('online', () => { isOnline = true; mettreAJourIndicateurs(); });
window.addEventListener('offline', () => { isOnline = false; mettreAJourIndicateurs(); });

(function init() {
    isOnline = navigator.onLine;
    window.addEventListener('DOMContentLoaded', async () => {
        creerIndicateursUI();
        mettreAJourIndicateurs();
        if (isOnline) {
            await verifierBucketImages();
            await migrerPointages();
        }
    });
})();

// ==========================================
// FONCTIONS SUPABASE CORE
// ==========================================
function getSupabaseClient() {
    if (!supabaseClient) {
        try {
            if (typeof supabase === 'undefined') throw new Error('Supabase non chargé');
            supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
                global: { headers: { 'x-application-name': 'faso-teedo' } },
                db: { schema: 'public' }
            });
        } catch(e) { console.error('❌ Supabase:', e); throw e; }
    }
    return supabaseClient;
}

async function executeQuery(queryFn, options = {}) {
    const { maxRetries = 2 } = options;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try { 
            const { data, error } = await queryFn(); 
            if (error) throw error; 
            return { data, error: null }; 
        }
        catch(e) { 
            if (attempt === maxRetries) return { data: null, error: e }; 
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt))); 
        }
    }
}

function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getTodayDate() { return formatDate(new Date()); }
function getMonthStart() { const n = new Date(); return formatDate(new Date(n.getFullYear(), n.getMonth(), 1)); }
function getWeekStart() { const n = new Date(); const day = n.getDay(); const diff = n.getDate() - day + (day === 0 ? -6 : 1); return formatDate(new Date(n.setDate(diff))); }
function getYearStart() { const n = new Date(); return formatDate(new Date(n.getFullYear(), 0, 1)); }

// === STORAGE - VÉRIFICATION DU BUCKET ===
async function verifierBucketImages() {
    try {
        const client = getSupabaseClient();
        const { data, error } = await client.storage.getBucket('images');
        if (error && error.message && error.message.includes('does not exist')) {
            console.warn('⚠️ Bucket "images" non trouvé, tentative de création...');
            const { error: createError } = await client.storage.createBucket('images', { public: true });
            if (createError) {
                console.error('❌ Erreur création bucket:', createError.message);
                return false;
            }
            console.log('✅ Bucket "images" créé avec succès');
            return true;
        }
        if (error) {
            console.error('❌ Erreur vérification bucket:', error.message);
            return false;
        }
        console.log('✅ Bucket "images" existe');
        return true;
    } catch(e) {
        console.error('❌ Erreur vérification bucket:', e.message);
        return false;
    }
}

// === COMPTEUR COMMANDES ===
async function getNumeroCommandeSupabase() {
    if (isOnline) {
        const { data } = await executeQuery(() => getSupabaseClient().from('compteur_commandes').select('*').eq('id', 1).single());
        if (data) {
            const numero = data.lettre + String(data.nombre).padStart(4, '0');
            let nn = data.nombre + 1, nl = data.lettre;
            if (nn > 9999) { nn = 1; nl = String.fromCharCode(data.lettre.charCodeAt(0)+1); if (nl > 'Z') nl = 'C'; }
            await executeQuery(() => getSupabaseClient().from('compteur_commandes').update({ lettre: nl, nombre: nn }).eq('id', 1));
            return numero;
        }
    }
    let l = localStorage.getItem('faso_teedo_cmd_lettre') || 'C';
    let n = parseInt(localStorage.getItem('faso_teedo_cmd_nombre') || '1');
    if (isNaN(n) || n < 1) n = 1; if (!l || l < 'C' || l > 'Z') l = 'C';
    const numero = l + String(n).padStart(4, '0');
    n++; if (n > 9999) { n = 1; l = String.fromCharCode(l.charCodeAt(0)+1); if (l > 'Z') l = 'C'; }
    localStorage.setItem('faso_teedo_cmd_lettre', l); localStorage.setItem('faso_teedo_cmd_nombre', n.toString());
    return numero;
}

async function reinitialiserCompteurCommandes() {
    if (isOnline) await executeQuery(() => getSupabaseClient().from('compteur_commandes').update({ lettre: 'C', nombre: 1 }).eq('id', 1));
    localStorage.setItem('faso_teedo_cmd_lettre', 'C'); localStorage.setItem('faso_teedo_cmd_nombre', '1');
}

// === CONFIG ===
async function getConfig() {
    if (isOnline) {
        try {
            const client = getSupabaseClient();
            const { data, error } = await client.from('config').select('*');
            
            if (error) {
                console.error('❌ Erreur config:', error.message);
            } else if (data && data.length > 0) {
                const config = {};
                data.forEach(item => { config[item.cle] = item.valeur; });
                console.log('✅ Config chargée depuis Supabase:', data.length, 'clés');
                localStorage.setItem('mirror_config', JSON.stringify(config));
                appliquerConfigLocale(config);
                return config;
            }
        } catch(e) {
            console.error('❌ Exception config:', e.message);
        }
    }
    const cached = localStorage.getItem('mirror_config');
    if (cached) {
        try {
            console.log('⚠️ Config depuis cache (hors-ligne uniquement)');
            return JSON.parse(cached);
        } catch(e) {}
    }
    console.log('⚠️ Config par défaut');
    const defaut = {
        entreprise_nom: 'FASO TEEDO',
        footer_text: '© ' + new Date().getFullYear() + ' FASO TEEDO - Tous droits réservés',
        mot_de_passe_admin: 'admin'
    };
    localStorage.setItem('mirror_config', JSON.stringify(defaut));
    return defaut;
}

function appliquerConfigLocale(config) {
    if (config.logo_url && config.logo_url.trim() !== '') {
        localStorage.setItem('faso_teedo_logo', config.logo_url);
        const logoDisplay = document.getElementById('logoDisplay');
        if (logoDisplay) {
            logoDisplay.classList.remove('logo-fallback');
            logoDisplay.innerHTML = `<img src="${config.logo_url}?t=${Date.now()}" alt="Logo" class="logo-accueil" style="background:transparent !important;">`;
        }
    } else {
        localStorage.removeItem('faso_teedo_logo');
        const logoDisplay = document.getElementById('logoDisplay');
        if (logoDisplay) {
            logoDisplay.classList.add('logo-fallback');
            logoDisplay.innerHTML = '🏭';
        }
    }
    if (config.fond_url && config.fond_url.trim() !== '') {
        localStorage.setItem('faso_teedo_fond', config.fond_url);
        if (document.body) {
            document.body.style.backgroundImage = `url(${config.fond_url}?t=${Date.now()})`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            document.body.style.backgroundAttachment = 'fixed';
            document.body.style.backgroundRepeat = 'no-repeat';
            document.body.classList.add('fond-personnalise');
        }
    } else {
        localStorage.removeItem('faso_teedo_fond');
        if (document.body) {
            document.body.style.backgroundImage = '';
            document.body.style.backgroundSize = '';
            document.body.style.backgroundPosition = '';
            document.body.style.backgroundAttachment = '';
            document.body.style.backgroundRepeat = '';
            document.body.classList.remove('fond-personnalise');
        }
    }
    if (config.entreprise_nom) {
        localStorage.setItem('faso_teedo_nom', config.entreprise_nom);
        const titleEl = document.getElementById('titreEntreprise');
        if (titleEl) titleEl.textContent = config.entreprise_nom;
        const footerNom = document.getElementById('footerNom');
        if (footerNom) footerNom.textContent = config.entreprise_nom;
        document.title = config.entreprise_nom + ' - Accueil';
    }
}

async function getConfigValue(cle) { const config = await getConfig(); return config[cle] || null; }

async function updateMultipleConfig(configs) {
    if (!isOnline) return false;
    const updates = Object.entries(configs).map(([cle, valeur]) => ({ cle, valeur }));
    const { error } = await executeQuery(() => getSupabaseClient().from('config').upsert(updates, { onConflict: 'cle' }));
    if (!error) {
        const currentConfig = JSON.parse(localStorage.getItem('mirror_config') || '{}');
        Object.assign(currentConfig, configs);
        localStorage.setItem('mirror_config', JSON.stringify(currentConfig));
        configPromise = null;
        appliquerConfigLocale(currentConfig);
    }
    return !error;
}

async function deleteConfig(cle) {
    if (!isOnline) return false;
    const { error } = await executeQuery(() => getSupabaseClient().from('config').delete().eq('cle', cle));
    if (!error) {
        const currentConfig = JSON.parse(localStorage.getItem('mirror_config') || '{}');
        delete currentConfig[cle];
        localStorage.setItem('mirror_config', JSON.stringify(currentConfig));
        configPromise = null;
        appliquerConfigLocale(currentConfig);
    }
    return !error;
}

// === EMPLOYÉS ===
async function getEmployes(actifSeulement = false) {
    if (isOnline) {
        try { 
            let query = getSupabaseClient().from('employes').select('*').order('nom_complet'); 
            if (actifSeulement) query = query.eq('actif', true); 
            const { data } = await query; 
            if (data) {
                localStorage.setItem('faso_teedo_cache_employes', JSON.stringify(data));
                console.log('✅ Employés chargés depuis Supabase:', data.length);
                return data;
            }
        } catch(e) {
            console.error('❌ Erreur chargement employés:', e.message);
        }
    }
    const cached = localStorage.getItem('faso_teedo_cache_employes'); 
    if (cached) {
        const data = JSON.parse(cached);
        if (actifSeulement) return data.filter(e => e.actif !== false); 
        return data;
    }
    return [];
}

async function addEmploye(nomComplet, photoUrl = null) {
    if (!isOnline) return { offline: true, nom_complet: nomComplet, id: Date.now() };
    const { data, error } = await executeQuery(() => getSupabaseClient().from('employes').insert([{ nom_complet: nomComplet.trim(), photo_url: photoUrl, actif: true }]).select().single());
    if (error) return null;
    const cache = JSON.parse(localStorage.getItem('faso_teedo_cache_employes') || '[]');
    cache.push(data);
    localStorage.setItem('faso_teedo_cache_employes', JSON.stringify(cache));
    return data;
}

async function updateEmploye(id, updates) {
    if (!isOnline) return false;
    const clean = {}; 
    if (updates.nom_complet) clean.nom_complet = updates.nom_complet; 
    if (updates.photo_url !== undefined) clean.photo_url = updates.photo_url; 
    if (updates.actif !== undefined) clean.actif = updates.actif;
    const { error } = await executeQuery(() => getSupabaseClient().from('employes').update(clean).eq('id', id)); 
    if (!error) {
        const cache = JSON.parse(localStorage.getItem('faso_teedo_cache_employes') || '[]');
        const idx = cache.findIndex(e => e.id === id);
        if (idx !== -1) { cache[idx] = { ...cache[idx], ...clean }; localStorage.setItem('faso_teedo_cache_employes', JSON.stringify(cache)); }
    }
    return !error;
}

async function deleteEmploye(id) { 
    if (!isOnline) return false; 
    const { error } = await executeQuery(() => getSupabaseClient().from('employes').delete().eq('id', id)); 
    if (!error) { 
        const cache = JSON.parse(localStorage.getItem('faso_teedo_cache_employes') || '[]'); 
        localStorage.setItem('faso_teedo_cache_employes', JSON.stringify(cache.filter(e => e.id !== id))); 
    } 
    return !error; 
}

// === CONFIG JOURNÉE - CORRIGÉ ===
async function getConfigJournee(date) {
    const ds = date || getTodayDate();
    if (isOnline) { 
        try {
            const { data, error } = await executeQuery(() => getSupabaseClient().from('config_journee').select('*').eq('date', ds).single());
            if (data) { 
                localStorage.setItem('faso_teedo_cache_config_journee', JSON.stringify(data)); 
                return data; 
            }
            if (error && error.code !== 'PGRST116') {
                console.error('❌ Erreur getConfigJournee:', error);
            }
            return null;
        } catch(e) {
            console.error('❌ Exception getConfigJournee:', e);
            return null;
        }
    }
    const c = localStorage.getItem('faso_teedo_cache_config_journee'); 
    if (c) {
        const parsed = JSON.parse(c);
        if (parsed && parsed.date === ds) return parsed;
    }
    return null;
}

// ✅ CORRECTION PRINCIPALE - saveConfigJournee
async function saveConfigJournee(config) {
    console.log('📤 saveConfigJournee appelé avec:', config);
    
    // ✅ Vérifier les données
    if (!config || typeof config !== 'object') {
        console.error('❌ Config invalide:', config);
        return false;
    }
    
    const configToSave = {
        date: config.date || getTodayDate(),
        type_travail: config.type_travail || 'fabrication',
        nb_employes: parseInt(config.nb_employes) || 0,
        total_sacs: parseFloat(config.total_sacs) || 0,
        prix_par_personne: parseInt(config.prix_par_personne) || 0,
        presents: Array.isArray(config.presents) ? config.presents : [],
        pointages: Array.isArray(config.pointages) ? config.pointages : [],
        version: '2.0'
    };
    
    console.log('📤 Données à sauvegarder:', configToSave);
    
    // ✅ Si hors-ligne
    if (!isOnline) {
        console.log('⚠️ Hors-ligne, sauvegarde locale uniquement');
        try {
            localStorage.setItem('faso_teedo_cache_config_journee', JSON.stringify(configToSave));
            return true;
        } catch(e) {
            console.error('❌ Erreur sauvegarde locale:', e);
            return false;
        }
    }
    
    // ✅ En ligne - Sauvegarde Supabase
    try {
        const client = getSupabaseClient();
        console.log('🔗 Tentative de connexion à Supabase...');
        
        const { data, error } = await client
            .from('config_journee')
            .upsert(configToSave, { onConflict: 'date' })
            .select()
            .single();
        
        if (error) {
            console.error('❌ Erreur Supabase:', error);
            console.error('❌ Détails:', error.message, error.code, error.details);
            
            // ✅ Si la table n'existe pas ou colonnes manquantes
            if (error.code === '42P01' || error.code === '42703') {
                console.log('⚠️ Problème de structure de table. Tentative de migration...');
                await migrerPointages();
                // Réessayer une fois
                const { data: retryData, error: retryError } = await client
                    .from('config_journee')
                    .upsert(configToSave, { onConflict: 'date' })
                    .select()
                    .single();
                if (retryError) {
                    console.error('❌ Échec après migration:', retryError);
                    return false;
                }
                if (retryData) {
                    localStorage.setItem('faso_teedo_cache_config_journee', JSON.stringify(retryData));
                    console.log('✅ Config sauvegardée avec succès après migration');
                    return true;
                }
                return false;
            }
            return false;
        }
        
        if (data) {
            localStorage.setItem('faso_teedo_cache_config_journee', JSON.stringify(data));
            console.log('✅ Config sauvegardée avec succès:', data);
            return true;
        }
        
        console.log('⚠️ Aucune donnée retournée mais pas d\'erreur');
        return false;
        
    } catch(e) {
        console.error('❌ Exception saveConfigJournee:', e);
        console.error('❌ Stack:', e.stack);
        return false;
    }
}

async function resetConfigJournee() {
    const today = getTodayDate();
    if (isOnline) { 
        try {
            await executeQuery(() => getSupabaseClient().from('config_journee').delete().eq('date', today));
            await executeQuery(() => getSupabaseClient().from('pointages').delete().eq('date', today));
        } catch(e) {
            console.error('❌ Erreur reset:', e);
        }
    }
    localStorage.removeItem('faso_teedo_cache_config_journee'); 
    return true;
}

// === POINTAGES ===
async function hasPointedAtDate(eid, d) { 
    if (!isOnline) return false; 
    const { data } = await executeQuery(() => getSupabaseClient().from('pointages').select('id').eq('employe_id', eid).eq('date', d).single()); 
    return !!data; 
}

async function hasPointedToday(eid) { return await hasPointedAtDate(eid, getTodayDate()); }

async function getPointagesToday() { 
    if (!isOnline) return []; 
    const { data } = await executeQuery(() => getSupabaseClient().from('pointages').select('*').eq('date', getTodayDate())); 
    return data || []; 
}

async function addPointageDirect(data) {
    if (!isOnline) {
        console.log('⚠️ Hors-ligne, pointage en attente');
        return false;
    }
    const today = getTodayDate();
    try {
        // Vérifier si déjà pointé
        const { data: existing } = await executeQuery(() => getSupabaseClient().from('pointages').select('id').eq('employe_id', data.employe_id).eq('date', today).single());
        if (existing) {
            console.log('⚠️ Employé déjà pointé');
            return false;
        }
    } catch(e) {}
    
    const pointage = {
        employe_id: data.employe_id,
        date: today,
        type_travail: data.type_travail || 'fabrication',
        signature_data: data.signature_data || null,
        paye: false,
        statut: 'present',
        salaire_estime: data.salaire_estime || 0,
        sacs_faits: data.sacs_faits || 0
    };
    
    const { error } = await executeQuery(() => getSupabaseClient().from('pointages').insert([pointage]));
    if (error) {
        console.error('❌ Erreur addPointageDirect:', error);
        return false;
    }
    return true;
}

async function getPointagesNonPayes() { 
    if (!isOnline) return []; 
    const { data } = await executeQuery(() => getSupabaseClient().from('pointages').select('*, employes(nom_complet)').eq('paye', false).order('date')); 
    return data || []; 
}

async function payerEmploye(eid) { 
    if (!isOnline) return false; 
    const { error } = await executeQuery(() => getSupabaseClient().from('pointages').update({ paye: true }).eq('employe_id', eid).eq('paye', false)); 
    return !error; 
}

// === GRILLE DE PRIX ===
async function getGrillePrix(tt) {
    if (isOnline) { 
        try { 
            let q = getSupabaseClient().from('grille_prix').select('*').order('nb_personnes_min'); 
            if (tt) q = q.eq('type_travail', tt); 
            const { data } = await q; 
            if (data) localStorage.setItem('faso_teedo_cache_grille_prix', JSON.stringify(data)); 
            return data || []; 
        } catch(e) {} 
    }
    const c = localStorage.getItem('faso_teedo_cache_grille_prix'); 
    if (c) {
        const parsed = JSON.parse(c);
        return tt ? parsed.filter(g => g.type_travail === tt) : parsed;
    }
    return [];
}

async function saveGrillePrix(g) { 
    if (!isOnline) return false; 
    const { error } = await executeQuery(() => getSupabaseClient().from('grille_prix').upsert(g, { onConflict: 'id' })); 
    if (!error) localStorage.removeItem('faso_teedo_cache_grille_prix'); 
    return !error; 
}

async function deleteGrillePrix(id) { 
    if (!isOnline) return false; 
    const { error } = await executeQuery(() => getSupabaseClient().from('grille_prix').delete().eq('id', id)); 
    if (!error) localStorage.removeItem('faso_teedo_cache_grille_prix'); 
    return !error; 
}

function getPrixParPersonne(nb, g) { 
    for (const x of g) { 
        if (nb >= x.nb_personnes_min && nb <= x.nb_personnes_max) return x.prix_par_personne; 
    } 
    return g.length > 0 ? g[g.length-1].prix_par_personne : 1000; 
}

// === FONCTIONS DE MIGRATION ===
async function migrerPointages() {
    try {
        console.log('🔧 Vérification de la structure des tables...');
        const client = getSupabaseClient();
        
        // Vérifier et ajouter les colonnes à config_journee
        const columnsToAdd = [
            { name: 'nb_employes', type: 'INTEGER DEFAULT 0' },
            { name: 'total_sacs', type: 'NUMERIC(10,2) DEFAULT 0' },
            { name: 'prix_par_personne', type: 'INTEGER DEFAULT 0' },
            { name: 'presents', type: 'JSONB DEFAULT \'[]\'::jsonb' },
            { name: 'pointages', type: 'JSONB DEFAULT \'[]\'::jsonb' },
            { name: 'version', type: 'VARCHAR(10) DEFAULT \'2.0\'' }
        ];
        
        for (const col of columnsToAdd) {
            try {
                await client.rpc('exec_sql', {
                    sql: `ALTER TABLE config_journee ADD COLUMN IF NOT EXISTS ${col.name} ${col.type};`
                });
                console.log(`✅ Colonne ${col.name} vérifiée/ajoutée`);
            } catch(e) {
                console.log(`⚠️ Impossible d'ajouter ${col.name}, peut-être déjà présente`);
            }
        }
        
        // Vérifier sacs_faits dans pointages
        try {
            await client.rpc('exec_sql', {
                sql: 'ALTER TABLE pointages ADD COLUMN IF NOT EXISTS sacs_faits NUMERIC(10,2) DEFAULT 0;'
            });
            console.log('✅ Colonne sacs_faits vérifiée/ajoutée');
        } catch(e) {
            console.log('⚠️ Colonne sacs_faits peut-être déjà présente');
        }
        
        console.log('✅ Migration terminée');
        return true;
    } catch(e) {
        console.error('❌ Erreur migration:', e);
        return false;
    }
}

// === STOCKS ===
async function getStockInventaire() { 
    if (isOnline) { 
        try { 
            const { data } = await getSupabaseClient().from('stock_inventaire').select('*').order('date_ajout', { ascending: false }); 
            if (data) localStorage.setItem('faso_teedo_cache_stock_inv', JSON.stringify(data)); 
            return data || []; 
        } catch(e) {} 
    } 
    const cached = localStorage.getItem('faso_teedo_cache_stock_inv');
    return cached ? JSON.parse(cached) : [];
}

async function addStockInventaire(p) { 
    if (!isOnline) return { offline: true }; 
    const { data } = await executeQuery(() => getSupabaseClient().from('stock_inventaire').insert([{ nom_produit: p.nom_produit.trim(), unite_mesure: p.unite_mesure, quantite: parseFloat(p.quantite)||0, prix_unitaire: parseFloat(p.prix_unitaire)||0 }]).select().single()); 
    if (data) localStorage.removeItem('faso_teedo_cache_stock_inv'); 
    return data || null; 
}

async function deleteStockInventaire(id) { 
    if (!isOnline) return false; 
    const { error } = await executeQuery(() => getSupabaseClient().from('stock_inventaire').delete().eq('id', id)); 
    return !error; 
}

async function getStockVente() {
    if (isOnline) { 
        try { 
            const { data } = await getSupabaseClient().from('stock_vente').select('*').order('type_produit'); 
            if (data) {
                localStorage.setItem('faso_teedo_cache_stock_vente', JSON.stringify(data));
                return data;
            }
        } catch(e) {}
    }
    const cached = localStorage.getItem('faso_teedo_cache_stock_vente');
    if (cached) return JSON.parse(cached);
    return [
        { type_produit: 'caramel_simple', quantite: 0, prix_unitaire: 100 },
        { type_produit: 'caramel_gingembre', quantite: 0, prix_unitaire: 100 },
        { type_produit: 'morceaux', quantite: 0, prix_unitaire: 500 },
        { type_produit: 'farine_kilo', quantite: 0, prix_unitaire: 1000 }
    ];
}

async function addStockVente(p) { 
    if (!isOnline) return { offline: true }; 
    return await addStockVenteDirect(p); 
}

async function addStockVenteDirect(p) { 
    const { data: ex } = await executeQuery(() => getSupabaseClient().from('stock_vente').select('*').eq('type_produit', p.type_produit).single()); 
    const qa = parseFloat(p.quantite)||0, pa = Math.round(parseFloat(p.prix_unitaire)||0); 
    if (ex) { 
        const aq = parseFloat(ex.quantite)||0, nq = aq+qa; 
        const { error } = await executeQuery(() => getSupabaseClient().from('stock_vente').update({ quantite: nq, prix_unitaire: pa||ex.prix_unitaire }).eq('type_produit', p.type_produit)); 
        if (!error) { 
            localStorage.removeItem('faso_teedo_cache_stock_vente');
            await addHistoriqueStockVente({
                type_produit: p.type_produit,
                ancienne_quantite: aq,
                nouvelle_quantite: nq,
                quantite_ajoutee: qa,
                ancien_prix: ex.prix_unitaire,
                nouveau_prix: pa||ex.prix_unitaire,
                type_mouvement: 'ajout',
                commentaire: `Achat de ${qa}`
            });
            return { ...ex, quantite: nq }; 
        } 
    } else { 
        const { data } = await executeQuery(() => getSupabaseClient().from('stock_vente').insert([{ type_produit: p.type_produit, quantite: qa, prix_unitaire: pa }]).select().single()); 
        if (data) { 
            localStorage.removeItem('faso_teedo_cache_stock_vente');
            await addHistoriqueStockVente({
                type_produit: p.type_produit,
                ancienne_quantite: 0,
                nouvelle_quantite: qa,
                quantite_ajoutee: qa,
                ancien_prix: 0,
                nouveau_prix: pa,
                type_mouvement: 'ajout',
                commentaire: `Achat initial de ${qa}`
            });
            return data; 
        } 
    } 
    return null; 
}

async function updateStockVente(tp, q, pu) { 
    if (!isOnline) return false; 
    const { error } = await executeQuery(() => getSupabaseClient().from('stock_vente').update({ quantite: parseFloat(q)||0, prix_unitaire: parseFloat(pu)||0 }).eq('type_produit', tp)); 
    if (!error) localStorage.removeItem('faso_teedo_cache_stock_vente'); 
    return !error; 
}

async function decrementerStock(tp, qv) { 
    if (!isOnline) return false; 
    const { data: p } = await executeQuery(() => getSupabaseClient().from('stock_vente').select('quantite').eq('type_produit', tp).single()); 
    if (!p) return false; 
    const nq = Math.max(0, (p.quantite||0)-qv); 
    const { error } = await executeQuery(() => getSupabaseClient().from('stock_vente').update({ quantite: nq }).eq('type_produit', tp)); 
    if (!error) localStorage.removeItem('faso_teedo_cache_stock_vente'); 
    return !error; 
}

async function incrementerStock(tp, q) { 
    if (!isOnline) return false; 
    const { data: p } = await executeQuery(() => getSupabaseClient().from('stock_vente').select('quantite').eq('type_produit', tp).single()); 
    if (!p) return false; 
    const nq = (parseFloat(p.quantite)||0)+q; 
    const { error } = await executeQuery(() => getSupabaseClient().from('stock_vente').update({ quantite: nq }).eq('type_produit', tp)); 
    if (!error) localStorage.removeItem('faso_teedo_cache_stock_vente'); 
    return !error; 
}

async function initialiserStockVenteDefaut() { 
    if (!isOnline) return false; 
    const ps = [
        { type_produit: 'caramel_simple', quantite: 0, prix_unitaire: 100 },
        { type_produit: 'caramel_gingembre', quantite: 0, prix_unitaire: 100 },
        { type_produit: 'morceaux', quantite: 0, prix_unitaire: 500 },
        { type_produit: 'farine_kilo', quantite: 0, prix_unitaire: 1000 }
    ]; 
    for (const p of ps) { 
        const { data: ex } = await executeQuery(() => getSupabaseClient().from('stock_vente').select('type_produit').eq('type_produit', p.type_produit).single()); 
        if (!ex) await executeQuery(() => getSupabaseClient().from('stock_vente').insert([p])); 
    } 
    localStorage.removeItem('faso_teedo_cache_stock_vente'); 
    return true; 
}

// === HISTORIQUE ===
async function addHistoriqueStockVente(m) { 
    if (!isOnline) return null; 
    try { 
        const { data } = await executeQuery(() => getSupabaseClient().from('historique_stock_vente').insert([{ 
            type_produit: m.type_produit, 
            ancienne_quantite: parseFloat(m.ancienne_quantite)||0, 
            nouvelle_quantite: parseFloat(m.nouvelle_quantite)||0, 
            quantite_ajoutee: parseFloat(m.quantite_ajoutee)||0, 
            ancien_prix: Math.round(parseFloat(m.ancien_prix)||0), 
            nouveau_prix: Math.round(parseFloat(m.nouveau_prix)||0), 
            date_mouvement: new Date().toISOString(), 
            type_mouvement: m.type_mouvement||'modification', 
            commentaire: m.commentaire||'' 
        }]).select().single()); 
        return data || null; 
    } catch(e) { return null; } 
}

async function getHistoriqueStockVente(f, dd, df, lim = 100) { 
    if (!isOnline) return []; 
    let q = getSupabaseClient().from('historique_stock_vente').select('*').order('date_mouvement', { ascending: false }); 
    const ah = getTodayDate(); 
    if (f === 'today') q = q.gte('date_mouvement', ah+'T00:00:00').lte('date_mouvement', ah+'T23:59:59'); 
    else if (f === 'yesterday') { const h = new Date(); h.setDate(h.getDate()-1); const s = formatDate(h); q = q.gte('date_mouvement', s+'T00:00:00').lte('date_mouvement', s+'T23:59:59'); } 
    else if (f === 'custom' && dd && df) q = q.gte('date_mouvement', dd+'T00:00:00').lte('date_mouvement', df+'T23:59:59'); 
    q = q.limit(lim); 
    const { data } = await executeQuery(() => q); 
    return data || []; 
}

// === SAUVEGARDES ===
async function addSauvegarde(d, c) { 
    if (isOnline) { 
        try { await executeQuery(() => getSupabaseClient().from('sauvegardes').insert([{ date_sauvegarde: new Date().toISOString(), donnees: d, commentaire: c||'' }]).select().single()); } catch(e) {} 
    } 
    return { local: true }; 
}

async function getSauvegardes(lim = 10) { 
    if (isOnline) { 
        try { 
            const { data } = await executeQuery(() => getSupabaseClient().from('sauvegardes').select('*').order('date_sauvegarde', { ascending: false }).limit(lim)); 
            if (data && data.length > 0) return data; 
        } catch(e) {} 
    } 
    return []; 
}

async function getDerniereSauvegarde() { 
    if (isOnline) { 
        const { data } = await executeQuery(() => getSupabaseClient().from('sauvegardes').select('*').order('date_sauvegarde', { ascending: false }).limit(1).single()); 
        return data || null; 
    } 
    return null; 
}

// === CLIENTS ===
async function getClients(a = false) { 
    if (isOnline) { 
        try { 
            let q = getSupabaseClient().from('clients').select('*').order('nom'); 
            if (a) q = q.eq('actif', true); 
            const { data } = await q; 
            if (data) {
                localStorage.setItem('faso_teedo_cache_clients', JSON.stringify(data));
                return data;
            }
        } catch(e) {}
    }
    const cached = localStorage.getItem('faso_teedo_cache_clients');
    if (cached) {
        const data = JSON.parse(cached);
        if (a) return data.filter(x => x.actif !== false);
        return data;
    }
    return [];
}

async function searchClients(r) { 
    if (!r || !r.trim()) return []; 
    if (isOnline) { 
        try { 
            const { data } = await getSupabaseClient().from('clients').select('*').ilike('nom', `%${r.trim()}%`).eq('actif', true).order('nom').limit(10); 
            if (data) return data; 
        } catch(e) {} 
    } 
    const cached = localStorage.getItem('faso_teedo_cache_clients');
    if (cached) {
        const data = JSON.parse(cached);
        const t = r.toLowerCase(); 
        return data.filter(x => x.nom.toLowerCase().includes(t)).slice(0, 10);
    }
    return [];
}

async function addClient(n, tel = '') { 
    if (!isOnline) return null; 
    const { data } = await executeQuery(() => getSupabaseClient().from('clients').insert([{ nom: n.trim(), telephone: tel.trim(), actif: true }]).select().single()); 
    if (data) {
        const cache = JSON.parse(localStorage.getItem('faso_teedo_cache_clients') || '[]');
        cache.push(data);
        localStorage.setItem('faso_teedo_cache_clients', JSON.stringify(cache));
    }
    return data || null; 
}

async function deleteClient(id) { 
    if (!isOnline) return false; 
    const { error } = await executeQuery(() => getSupabaseClient().from('clients').delete().eq('id', id)); 
    if (!error) { 
        const cache = JSON.parse(localStorage.getItem('faso_teedo_cache_clients') || '[]'); 
        localStorage.setItem('faso_teedo_cache_clients', JSON.stringify(cache.filter(c => c.id !== id))); 
    } 
    return !error; 
}

async function getClientPrix(cid) { 
    if (isOnline) { 
        try { 
            const { data } = await getSupabaseClient().from('clients_prix').select('*').eq('client_id', cid); 
            if (data) { 
                const ap = JSON.parse(localStorage.getItem('faso_teedo_cache_clients_prix') || '[]'); 
                localStorage.setItem('faso_teedo_cache_clients_prix', JSON.stringify([...ap.filter(p => p.client_id !== cid), ...data])); 
                return data; 
            } 
        } catch(e) {} 
    } 
    const cached = localStorage.getItem('faso_teedo_cache_clients_prix');
    if (cached) {
        const data = JSON.parse(cached);
        return data.filter(p => p.client_id === cid);
    }
    return [];
}

async function setClientPrix(p) { 
    if (!isOnline) return false; 
    const { error } = await executeQuery(() => getSupabaseClient().from('clients_prix').upsert({ client_id: p.client_id, type_produit: p.type_produit, prix_unitaire: p.prix_unitaire||null, quantite_lot: p.quantite_lot||null, prix_lot: p.prix_lot||null }, { onConflict: 'client_id,type_produit' })); 
    if (!error) { 
        const ap = JSON.parse(localStorage.getItem('faso_teedo_cache_clients_prix') || '[]'); 
        const fl = ap.filter(x => !(x.client_id === p.client_id && x.type_produit === p.type_produit)); 
        fl.push({ client_id: p.client_id, type_produit: p.type_produit, prix_unitaire: p.prix_unitaire, quantite_lot: p.quantite_lot, prix_lot: p.prix_lot }); 
        localStorage.setItem('faso_teedo_cache_clients_prix', JSON.stringify(fl)); 
    } 
    return !error; 
}

async function deleteClientPrix(id) { 
    if (!isOnline) return false; 
    const { error } = await executeQuery(() => getSupabaseClient().from('clients_prix').delete().eq('id', id)); 
    if (!error) localStorage.removeItem('faso_teedo_cache_clients_prix'); 
    return !error; 
}

// === VENTES ===
async function addVente(cmd) { 
    if (!isOnline) { return { offline: true, numero_commande: cmd.numero_commande }; } 
    return await addVenteDirect(cmd); 
}

async function addVenteDirect(cmd) { 
    const tv = Math.round(parseFloat(cmd.total_vente)||0); 
    const ar = Math.round(parseFloat(cmd.argent_recu)||0); 
    let mp = (cmd.mode_paiement||'espece').toLowerCase().trim(); 
    if (!['espece','orange','combine'].includes(mp)) mp = 'espece'; 
    const vd = { 
        date_vente: cmd.date_vente||new Date().toISOString(), 
        type_produit: cmd.type_produit||'PANIER', 
        client_id: cmd.client_id||null, 
        client_nom: cmd.client_nom||'Client', 
        quantite: parseFloat(cmd.quantite)||0, 
        prix_unitaire_applique: Math.round(parseFloat(cmd.prix_unitaire_applique)||0), 
        total_vente: tv, 
        argent_recu: ar, 
        monnaie_rendue: ar-tv>0?ar-tv:0, 
        caissier_nom: cmd.caissier_nom?.trim()||'Inconnu', 
        numero_commande: cmd.numero_commande, 
        details: cmd.details||null, 
        mode_paiement: mp, 
        details_paiement: cmd.details_paiement||null, 
        statut: 'actif' 
    }; 
    const { data, error } = await executeQuery(() => getSupabaseClient().from('ventes').insert([vd]).select().single()); 
    if (error||!data) return null; 
    if (cmd.details) { 
        try { 
            for (const it of JSON.parse(cmd.details)) { 
                await decrementerStock(it.type_produit, parseFloat(it.quantite)||0); 
            } 
        } catch(e) {} 
    } 
    return data; 
}

async function annulerVente(vid) { 
    if (!isOnline) return { offline: true }; 
    return await annulerVenteDirect(vid); 
}

async function annulerVenteDirect(vid) { 
    const { data: v } = await executeQuery(() => getSupabaseClient().from('ventes').select('*').eq('id', vid).single()); 
    if (!v||v.statut==='annule') return null; 
    await executeQuery(() => getSupabaseClient().from('ventes').update({ statut: 'annule' }).eq('id', vid)); 
    if (v.details) { 
        try { 
            for (const it of JSON.parse(v.details)) { 
                await incrementerStock(it.type_produit, parseFloat(it.quantite)||0); 
            } 
        } catch(e) {} 
    } 
    return v; 
}

async function getVentesToday() { 
    if (!isOnline) return []; 
    const t = getTodayDate(); 
    const tm = formatDate(new Date(Date.now()+86400000)); 
    const { data } = await executeQuery(() => getSupabaseClient().from('ventes').select('*').gte('date_vente', t).lt('date_vente', tm).order('date_vente', { ascending: false })); 
    return data || []; 
}

async function getVentesPeriode(dd, df) { 
    if (!isOnline) return []; 
    const { data } = await executeQuery(() => getSupabaseClient().from('ventes').select('*').gte('date_vente', dd).lte('date_vente', df+' 23:59:59').order('date_vente', { ascending: false })); 
    return data || []; 
}

// === ACHATS ===
async function addAchat(a) { 
    if (!isOnline) return null; 
    const { data } = await executeQuery(() => getSupabaseClient().from('achats').insert([{ date_achat: new Date().toISOString(), categorie: a.categorie, total_achat: Math.round(parseFloat(a.total_achat)||0), description: a.description||'', fournisseur: a.fournisseur||'' }]).select().single()); 
    return data || null; 
}

async function getAchatsPeriode(dd, df) { 
    if (!isOnline) return []; 
    const { data } = await executeQuery(() => getSupabaseClient().from('achats').select('*').gte('date_achat', dd).lte('date_achat', df+' 23:59:59').order('date_achat', { ascending: false })); 
    return data || []; 
}

// === NUMÉROS ===
async function getNumerosEntreprise() { 
    if (!isOnline) return []; 
    const { data } = await executeQuery(() => getSupabaseClient().from('numeros_entreprise').select('*').order('id')); 
    return data || []; 
}

async function addNumeroEntreprise(n) { 
    if (!isOnline) return null; 
    const { data } = await executeQuery(() => getSupabaseClient().from('numeros_entreprise').insert([{ numero: n.trim() }]).select().single()); 
    return data || null; 
}

async function deleteNumeroEntreprise(id) { 
    if (!isOnline) return false; 
    const { error } = await executeQuery(() => getSupabaseClient().from('numeros_entreprise').delete().eq('id', id)); 
    return !error; 
}

// === STORAGE ===
async function uploadFile(bucket, chemin, fichier) { 
    if (fichier.size > 5*1024*1024 || !isOnline) return null; 
    try { 
        const cl = getSupabaseClient(); 
        const { error } = await cl.storage.from(bucket).upload(chemin, fichier, { cacheControl: 'no-cache', upsert: true, contentType: fichier.type||'image/jpeg' }); 
        if (error) return null; 
        await new Promise(r => setTimeout(r, 3000)); 
        const { data: urlData } = cl.storage.from(bucket).getPublicUrl(chemin); 
        const url = urlData?.publicUrl || null;
        if (url) return url + '?t=' + Date.now();
        return url;
    } catch(e) { return null; } 
}

async function deleteFile(bucket, chemin) { 
    if (!isOnline) return false; 
    const { error } = await executeQuery(() => getSupabaseClient().storage.from(bucket).remove([chemin])); 
    return !error; 
}

// === AUTH ===
async function verifyPassword(mdp) {
    if (mdp === 'admin') return true;
    try { 
        const config = await getConfig(); 
        if (config.mot_de_passe_admin === mdp) return true; 
    } catch(e) {}
    return false;
}

function createSession() { 
    const s = { timestamp: Date.now(), expiration: Date.now()+28800000, token: btoa(Date.now().toString()+Math.random().toString()) }; 
    localStorage.setItem('faso_teedo_session', JSON.stringify(s)); 
    return s; 
}

function checkSession() { 
    try { 
        const d = localStorage.getItem('faso_teedo_session'); 
        if (!d) return false; 
        const s = JSON.parse(d); 
        if (!s.expiration || Date.now() > s.expiration) { 
            localStorage.removeItem('faso_teedo_session'); 
            return false; 
        } 
        return true; 
    } catch(e) { return false; } 
}

function logout() { localStorage.removeItem('faso_teedo_session'); }

console.log('✅ Supabase config V17.0 - CORRECTION ENREGISTREMENT');
