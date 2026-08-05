/* =============================================
   FASO TEEDO - SCRIPTS ADMINISTRATION V16.0
   Détails complets des ventes + Upload/Suppression corrigé
   ============================================= */

'use strict';

let configActuelle = {};
let tousEmployes = [];
let tousClientsAdmin = [];
let imprimanteBluetooth = null;
let serveurBluetooth = null;
let caracteristiqueImprimante = null;
let filtreVentesActif = 'today';
let filtreRecuActif = 'today';
let filtreHistoStockActif = 'today';
let resetDelaiTimer = null;
let resetDelaiSecondes = 15;
let stockVenteProduitsTemp = [];

let fichierPhotoCreation = null;
let fichierPhotoModification = null;
let fichierLogoUpload = null;
let fichierFondUpload = null;

const CACHE_BUSTER = Date.now();

const PHOTO_DEFAUT = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><rect fill="#e0e0e0" width="60" height="60" rx="30"/><circle cx="30" cy="22" r="10" fill="#999"/><ellipse cx="30" cy="52" rx="18" ry="14" fill="#999"/></svg>');
const PHOTO_DEFAUT_LARGE = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect fill="#e0e0e0" width="120" height="120" rx="60"/><circle cx="60" cy="44" r="20" fill="#999"/><ellipse cx="60" cy="104" rx="36" ry="28" fill="#999"/></svg>');

const NOMS_PRODUITS = {
    caramel_simple: 'Caramel Simple',
    caramel_gingembre: 'Caramel Gingembre',
    morceaux: 'Morceaux (Casée)',
    farine_kilo: 'Farine (Kilo)'
};

document.addEventListener('DOMContentLoaded', async function() {
    try { await initialiserAdministration(); } catch(e) { console.error('Erreur globale:', e); }
});

async function initialiserAdministration() {
    try {
        await chargerConfiguration();
        appliquerPersonnalisationGlobale();
        await verifierEtInitialiserStockVente();
        initialiserOnglets();
        await initialiserOngletEmployes();
        await initialiserOngletConfiguration();
        initialiserBluetooth();
        console.log('✅ Administration V16.0 initialisée');
    } catch (error) { afficherToast('Erreur de chargement.', 'error'); }
}

async function verifierEtInitialiserStockVente() { try { if ((await getStockVente()).length === 0) await initialiserStockVenteDefaut(); } catch(e) {} }

function appliquerPersonnalisationGlobale() {
    if (configActuelle.fond_url && configActuelle.fond_url.trim() !== '') {
        document.body.style.backgroundImage = `url(${configActuelle.fond_url}?v=${CACHE_BUSTER})`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundAttachment = 'fixed';
        document.body.style.backgroundRepeat = 'no-repeat';
        document.body.classList.add('fond-personnalise');
        localStorage.setItem('faso_teedo_fond', configActuelle.fond_url + '?v=' + CACHE_BUSTER);
    } else {
        document.body.style.backgroundImage = '';
        document.body.style.backgroundSize = '';
        document.body.style.backgroundPosition = '';
        document.body.style.backgroundAttachment = '';
        document.body.style.backgroundRepeat = '';
        document.body.classList.remove('fond-personnalise');
        localStorage.removeItem('faso_teedo_fond');
    }
    if (configActuelle.logo_url && configActuelle.logo_url.trim() !== '') {
        localStorage.setItem('faso_teedo_logo', configActuelle.logo_url + '?v=' + CACHE_BUSTER);
    } else {
        localStorage.removeItem('faso_teedo_logo');
    }
    if (configActuelle.footer_text) localStorage.setItem('faso_teedo_footer', configActuelle.footer_text);
    if (configActuelle.entreprise_nom) localStorage.setItem('faso_teedo_nom', configActuelle.entreprise_nom);
}

function initialiserOnglets() {
    const tabButtons = document.querySelectorAll('.tabs-nav .tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            tabButtons.forEach(btn => { btn.classList.remove('active'); btn.setAttribute('aria-selected', 'false'); });
            tabContents.forEach(content => content.classList.remove('active'));
            this.classList.add('active'); this.setAttribute('aria-selected', 'true');
            document.getElementById(targetTab).classList.add('active');
            if (targetTab === 'tab-employes') initialiserOngletEmployes();
            if (targetTab === 'tab-salaires') initialiserOngletSalaires();
            if (targetTab === 'tab-stock-inventaire') initialiserOngletStockInventaire();
            if (targetTab === 'tab-stock-vente') initialiserOngletStockVente();
            if (targetTab === 'tab-clients') initialiserOngletClients();
            if (targetTab === 'tab-ventes-admin') initialiserOngletVentesAdmin();
            if (targetTab === 'tab-recu') initialiserOngletRecu();
            if (targetTab === 'tab-config') initialiserOngletConfiguration();
            if (targetTab === 'tab-grille') initialiserOngletGrille();
            if (targetTab === 'tab-reset') initialiserOngletReset();
        });
    });
}

// ==========================================
// ONGLET 1 : EMPLOYÉS
// ==========================================
async function initialiserOngletEmployes() {
    try { await chargerListeEmployes(); initialiserFormulaireAjoutEmploye(); }
    catch(e) { document.getElementById('listeEmployes').innerHTML = '<div class="alert alert-danger">Erreur.</div>'; }
}

function initialiserFormulaireAjoutEmploye() {
    const photoInput = document.getElementById('employePhoto');
    const previewDiv = document.getElementById('previewPhotoEmploye');
    const previewImg = document.getElementById('previewImageEmploye');
    const btnAjouter = document.getElementById('btnAjouterEmploye');
    if (photoInput) {
        photoInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                if (file.size > 5*1024*1024) { afficherToast('Photo > 5 Mo', 'error'); this.value = ''; previewDiv.style.display = 'none'; fichierPhotoCreation = null; return; }
                fichierPhotoCreation = file;
                const reader = new FileReader();
                reader.onload = function(e) { previewImg.src = e.target.result; previewDiv.style.display = 'block'; };
                reader.readAsDataURL(file);
            } else { previewDiv.style.display = 'none'; fichierPhotoCreation = null; }
        });
    }
    if (btnAjouter) btnAjouter.addEventListener('click', async function(e) { e.preventDefault(); if (btnAjouter.disabled) return; await ajouterEmploye(); });
}

async function ajouterEmploye() {
    const nom = document.getElementById('employeNom').value.trim();
    if (!nom) { afficherToast('Nom requis', 'warning'); return; }
    const btnAjouter = document.getElementById('btnAjouterEmploye'); btnAjouter.disabled = true; btnAjouter.textContent = '⏳...';
    try {
        let photoUrl = null;
        if (fichierPhotoCreation) photoUrl = await uploadFile('images', `employes/${Date.now()}_${nom.replace(/\\s+/g,'_')}.jpg`, fichierPhotoCreation);
        const resultat = await addEmploye(nom, photoUrl);
        if (resultat) { afficherToast(`✅ ${nom} ajouté`, 'success'); document.getElementById('employeNom').value=''; document.getElementById('employePhoto').value=''; document.getElementById('previewPhotoEmploye').style.display='none'; fichierPhotoCreation=null; await chargerListeEmployes(); }
        else afficherToast('❌ Erreur', 'error');
    } catch(e) { afficherToast('Erreur', 'error'); }
    finally { btnAjouter.disabled = false; btnAjouter.textContent = "Ajouter l'employé"; }
}

async function chargerListeEmployes() {
    const c = document.getElementById('listeEmployes'); if (!c) return;
    c.innerHTML = '<div class="loader"><div class="spinner"></div><span>Chargement...</span></div>';
    tousEmployes = await getEmployes(false);
    if (tousEmployes.length === 0) { c.innerHTML = '<div class="etat-vide"><p>Aucun employé</p></div>'; return; }
    let h = '';
    tousEmployes.forEach(e => {
        h += `<div class="liste-employes-item"><img src="${e.photo_url || PHOTO_DEFAUT}" class="photo-employe photo-employe-petit" onerror="this.src='${PHOTO_DEFAUT}';"><div class="info"><strong>${e.nom_complet}</strong><br><small>${new Date(e.date_creation).toLocaleDateString('fr-FR')}</small></div><div class="actions"><button class="btn btn-outline btn-sm" onclick="ouvrirModifierEmploye(${e.id})">✏️</button><button class="btn btn-danger btn-sm" onclick="supprimerEmploye(${e.id},'${e.nom_complet.replace(/'/g,"\\'")}')">🗑️</button></div></div>`;
    });
    c.innerHTML = h;
}

function ouvrirModifierEmploye(id) {
    const e = tousEmployes.find(x => x.id === id); if (!e) return;
    document.getElementById('modifierEmployeId').value = e.id;
    document.getElementById('modifierEmployeNom').value = e.nom_complet;
    document.getElementById('modifierPreviewPhoto').src = e.photo_url || PHOTO_DEFAUT_LARGE;
    document.getElementById('modifierEmployePhoto').value = '';
    fichierPhotoModification = null;
    document.getElementById('modalModifierEmploye').classList.remove('hidden');
    initFormModifEmploye();
}
function fermerModalModifierEmploye() { document.getElementById('modalModifierEmploye').classList.add('hidden'); fichierPhotoModification = null; }
function initFormModifEmploye() {
    const btnModifier = document.getElementById('btnModifierEmploye');
    const photoInput = document.getElementById('modifierEmployePhoto');
    if (photoInput) photoInput.onchange = function() { const file = this.files[0]; if (file && file.size <= 5*1024*1024) { fichierPhotoModification = file; const reader = new FileReader(); reader.onload = e => document.getElementById('modifierPreviewPhoto').src = e.target.result; reader.readAsDataURL(file); } else fichierPhotoModification = null; };
    if (btnModifier) btnModifier.onclick = async function(e) { e.preventDefault(); if (btnModifier.disabled) return; await modifierEmploye(); };
}
async function modifierEmploye() {
    const id = parseInt(document.getElementById('modifierEmployeId').value);
    const nom = document.getElementById('modifierEmployeNom').value.trim();
    if (!nom) { afficherToast('Nom requis', 'warning'); return; }
    const btn = document.getElementById('btnModifierEmploye'); btn.disabled = true; btn.textContent = '⏳...';
    try {
        const updates = { nom_complet: nom };
        if (fichierPhotoModification) { const url = await uploadFile('images', `employes/${Date.now()}_${nom.replace(/\\s+/g,'_')}.jpg`, fichierPhotoModification); if (url) updates.photo_url = url; }
        const ok = await updateEmploye(id, updates);
        if (ok) { afficherToast(`✅ ${nom} modifié`, 'success'); fermerModalModifierEmploye(); fichierPhotoModification = null; await chargerListeEmployes(); }
        else afficherToast('❌ Erreur', 'error');
    } catch(e) { afficherToast('Erreur', 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Enregistrer'; }
}
async function supprimerEmploye(id, nom) {
    if (!confirm(`Supprimer "${nom}" ?`) || !confirm('CONFIRMATION')) return;
    if (await deleteEmploye(id)) { afficherToast(`✅ ${nom} supprimé`, 'success'); await chargerListeEmployes(); }
    else afficherToast('Erreur', 'error');
}

// ==========================================
// ONGLET 2 : SALAIRES
// ==========================================
async function initialiserOngletSalaires() {
    const c = document.getElementById('tableauSalaires'); if (!c) return;
    c.innerHTML = '<div class="loader"><div class="spinner"></div><span>Calcul des salaires...</span></div>';
    try {
        const pointages = await getPointagesNonPayes();
        if (pointages.length === 0) { c.innerHTML = '<div class="etat-vide"><p>Aucun pointage non payé</p></div>'; return; }
        
        const parEmploye = {};
        for (const p of pointages) {
            const eid = p.employe_id;
            if (!parEmploye[eid]) parEmploye[eid] = { nom: p.employes?.nom_complet || `Employé #${eid}`, pointages: [] };
            parEmploye[eid].pointages.push(p);
        }
        
        let totalGen = 0;
        let h = '<div class="table-container"><table><thead><tr><th>Employé</th><th>Détail</th><th>Jours</th><th>Salaire</th><th>Action</th></tr></thead><tbody>';
        
        for (const [eid, data] of Object.entries(parEmploye)) {
            let totalEmp = 0;
            let detailStr = '';
            
            for (const p of data.pointages) {
                if (p.salaire_estime && p.salaire_estime > 0) {
                    totalEmp += p.salaire_estime;
                    detailStr += `${new Date(p.date).toLocaleDateString('fr-FR')}: ${p.type_travail}, estimé = ${p.salaire_estime.toLocaleString('fr-FR')} F | `;
                } else {
                    const configJour = await getConfigJournee(p.date);
                    if (configJour) {
                        const estime = calculerSalaireEstime(parseInt(eid), configJour);
                        totalEmp += estime;
                        detailStr += `${new Date(p.date).toLocaleDateString('fr-FR')}: ${p.type_travail}, ${estime.toLocaleString('fr-FR')} F | `;
                    } else {
                        detailStr += `${new Date(p.date).toLocaleDateString('fr-FR')}: ${p.type_travail} | `;
                    }
                }
            }
            
            totalGen += totalEmp;
            h += `<tr>
                <td><strong>${data.nom}</strong></td>
                <td><small>${detailStr.slice(0, -3)}</small></td>
                <td>${data.pointages.length} j.</td>
                <td><strong>${totalEmp.toLocaleString('fr-FR')} FCFA</strong></td>
                <td><button class="btn btn-primaire btn-sm" onclick="payerEmployeIndividuel(${eid},'${data.nom.replace(/'/g,"\\'")}',${totalEmp})">💳 Payer</button></td>
            </tr>`;
        }
        
        h += `<tr style="background:#f0f7f3;font-weight:bold;"><td colspan="3">TOTAL GÉNÉRAL</td><td><strong>${totalGen.toLocaleString('fr-FR')} FCFA</strong></td><td></td></tr></tbody></table></div>`;
        c.innerHTML = h;
    } catch(e) { c.innerHTML = '<div class="alert alert-danger">Erreur de calcul</div>'; console.error(e); }
}

async function payerEmployeIndividuel(eid, nom, total) {
    if (!confirm(`Payer ${total.toLocaleString('fr-FR')} FCFA à ${nom} ?`)) return;
    try {
        await addAchat({ categorie: 'salaires', total_achat: total, description: `Salaire - ${nom}`, fournisseur: '' });
        await payerEmploye(eid);
        afficherToast(`✅ ${nom} payé !`, 'success');
        await initialiserOngletSalaires();
    } catch(e) { afficherToast('Erreur lors du paiement', 'error'); }
}

// ==========================================
// ONGLET 3 : STOCK INVENTAIRE
// ==========================================
async function initialiserOngletStockInventaire() { await chargerStockInventaire(); initFormStockInv(); }
function initFormStockInv() {
    const qi = document.getElementById('stockQuantite'), pi = document.getElementById('stockPrixUnitaire'), td = document.getElementById('totalStock');
    if (qi && pi) { qi.addEventListener('input', () => td.textContent = `Total : ${Math.round((parseFloat(qi.value)||0)*(parseFloat(pi.value)||0)).toLocaleString('fr-FR')} FCFA`); pi.addEventListener('input', () => qi.dispatchEvent(new Event('input'))); }
    const btn = document.getElementById('btnAjouterStock'); if (btn) btn.addEventListener('click', async function(e) { e.preventDefault(); if (btn.disabled) return; await ajouterStockInv(); });
}
async function ajouterStockInv() {
    const nom = document.getElementById('stockNom').value.trim(); if (!nom) { afficherToast('Nom requis', 'warning'); return; }
    const btn = document.getElementById('btnAjouterStock'); btn.disabled = true; btn.textContent = '⏳...';
    try { if (await addStockInventaire({ nom_produit: nom, unite_mesure: document.getElementById('stockUnite').value, quantite: document.getElementById('stockQuantite').value, prix_unitaire: document.getElementById('stockPrixUnitaire').value })) { afficherToast(`✅ ${nom} ajouté`, 'success'); document.getElementById('stockNom').value=''; document.getElementById('stockQuantite').value=''; document.getElementById('stockPrixUnitaire').value=''; document.getElementById('totalStock').textContent='Total : 0 FCFA'; await chargerStockInventaire(); } else afficherToast('Erreur','error'); }
    catch(e) { afficherToast('Erreur','error'); } finally { btn.disabled = false; btn.textContent = 'Ajouter au stock'; }
}
async function chargerStockInventaire() {
    const c = document.getElementById('listeStockInventaire'); if (!c) return; c.innerHTML = '<div class="loader"><div class="spinner"></div><span>...</span></div>';
    const p = await getStockInventaire(); if (p.length===0) { c.innerHTML = '<div class="etat-vide"><p>Stock vide</p></div>'; return; }
    let h = '<div class="table-container"><table><thead><tr><th>Produit</th><th>Unité</th><th>Qté</th><th>Prix</th><th>Total</th><th></th></tr></thead><tbody>';
    p.forEach(x => { const t = Math.round((parseFloat(x.quantite)||0)*(parseFloat(x.prix_unitaire)||0)); h += `<tr><td>${x.nom_produit}</td><td>${x.unite_mesure}</td><td>${x.quantite}</td><td>${Math.round(parseFloat(x.prix_unitaire)||0).toLocaleString('fr-FR')}</td><td><strong>${t.toLocaleString('fr-FR')}</strong></td><td><button class="btn btn-danger btn-sm" onclick="supprimerStockInv(${x.id},'${x.nom_produit.replace(/'/g,"\\'")}')">🗑️</button></td></tr>`; });
    h += '</tbody></table></div>'; c.innerHTML = h;
}
async function supprimerStockInv(id,nom) { if(!confirm(`Supprimer "${nom}" ?`))return; if(await deleteStockInventaire(id)){afficherToast(`✅ ${nom} supprimé`,'success');await chargerStockInventaire();} }

// ==========================================
// ONGLET 4 : STOCK VENTE
// ==========================================
async function initialiserOngletStockVente() { await chargerStockVente(); await chargerHistoriqueStockVente(filtreHistoStockActif); initialiserFiltresHistoriqueStock(); initFormAjoutStockVente(); }
function initFormAjoutStockVente() {
    const btn = document.getElementById('btnAjouterStockVente'); if (btn) { const nb = btn.cloneNode(true); btn.parentNode.replaceChild(nb, btn); nb.addEventListener('click', async function(e) { e.preventDefault(); if (nb.disabled) return; await ajouterStockVenteProduit(); }); }
    const qte = document.getElementById('svQuantite'), prix = document.getElementById('svPrixUnitaire'), total = document.getElementById('svTotal');
    if (qte && prix && total) { const calc = () => { total.textContent = `Total : ${Math.round((parseFloat(qte.value)||0)*(parseFloat(prix.value)||0)).toLocaleString('fr-FR')} FCFA`; }; qte.addEventListener('input', calc); prix.addEventListener('input', calc); }
}
async function ajouterStockVenteProduit() {
    const tp = document.getElementById('svTypeProduit').value, q = parseFloat(document.getElementById('svQuantite').value), p = parseFloat(document.getElementById('svPrixUnitaire').value);
    if (!tp) { afficherToast('Sélectionnez un produit', 'warning'); return; } if (!q||q<=0) { afficherToast('Quantité invalide', 'warning'); return; } if (!p||p<0) { afficherToast('Prix invalide', 'warning'); return; }
    const btn = document.getElementById('btnAjouterStockVente'); btn.disabled = true; btn.textContent = '⏳...';
    try { if (await addStockVente({ type_produit: tp, quantite: q, prix_unitaire: p })) { afficherToast(`✅ ${q} ajouté(s) !`, 'success'); document.getElementById('svQuantite').value=''; document.getElementById('svPrixUnitaire').value=''; document.getElementById('svTotal').textContent='Total : 0 FCFA'; await chargerStockVente(); await chargerHistoriqueStockVente(filtreHistoStockActif); } else afficherToast('Erreur', 'error'); }
    catch(e) { afficherToast('Erreur', 'error'); } finally { btn.disabled = false; btn.textContent = 'Ajouter au stock'; }
}
function initialiserFiltresHistoriqueStock() {
    document.querySelectorAll('.filtre-histo-btn').forEach(b => { const nb = b.cloneNode(true); b.parentNode.replaceChild(nb, b); });
    document.querySelectorAll('.filtre-histo-btn').forEach(b => b.addEventListener('click', function() { document.querySelectorAll('.filtre-histo-btn').forEach(x => x.classList.remove('active')); this.classList.add('active'); filtreHistoStockActif = this.getAttribute('data-filtre'); chargerHistoriqueStockVente(filtreHistoStockActif); }));
    const bfd = document.getElementById('btnFiltrerHistoDate'); if (bfd) { const nb = bfd.cloneNode(true); bfd.parentNode.replaceChild(nb, bfd); nb.addEventListener('click', () => { const dd = document.getElementById('histoDateDebut').value, df = document.getElementById('histoDateFin').value; if (dd && df) { document.querySelectorAll('.filtre-histo-btn').forEach(x => x.classList.remove('active')); chargerHistoriqueStockVente('custom', dd, df); } else afficherToast('Sélectionnez les deux dates', 'warning'); }); }
}
async function chargerStockVente() {
    const c = document.getElementById('tableauStockVente'); if (!c) return; c.innerHTML = '<div class="loader"><div class="spinner"></div><span>...</span></div>';
    const p = await getStockVente(); stockVenteProduitsTemp = p;
    if (p.length === 0) { c.innerHTML = '<div class="etat-vide"><p>Aucun produit</p></div>'; const bi = document.createElement('button'); bi.className = 'btn btn-primaire btn-block mt-2'; bi.textContent = '🔄 Initialiser'; bi.onclick = async function() { bi.disabled = true; await initialiserStockVenteDefaut(); await chargerStockVente(); await chargerHistoriqueStockVente(filtreHistoStockActif); }; c.appendChild(bi); return; }
    let h = '<div class="table-container"><table><thead><tr><th>Produit</th><th>Qté</th><th>Prix</th><th></th></tr></thead><tbody>';
    p.forEach(x => { const nom = NOMS_PRODUITS[x.type_produit] || x.type_produit; h += `<tr><td><strong>${nom}</strong></td><td><input type="number" id="qte_${x.type_produit}" class="form-control" value="${x.quantite}" step="0.01" min="0" style="width:120px;"></td><td><input type="number" id="prix_${x.type_produit}" class="form-control" value="${x.prix_unitaire}" step="1" min="0" style="width:150px;"></td><td><button class="btn btn-primaire btn-sm" onclick="modifierStockVente('${x.type_produit}')">💾</button></td></tr>`; });
    h += '</tbody></table></div>'; c.innerHTML = h;
}
async function modifierStockVente(tp) {
    const q = parseFloat(document.getElementById(`qte_${tp}`).value), p = Math.round(parseFloat(document.getElementById(`prix_${tp}`).value));
    if (isNaN(q)||isNaN(p)) { afficherToast('Valeurs invalides', 'warning'); return; }
    if (await updateStockVente(tp, q, p)) {
        afficherToast('✅ Mis à jour', 'success'); await chargerStockVente(); await chargerHistoriqueStockVente(filtreHistoStockActif);
    } else afficherToast('Erreur', 'error');
}
async function chargerHistoriqueStockVente(filtre, dateDebut, dateFin) {
    const c = document.getElementById('historiqueStockVente'); if (!c) return; c.innerHTML = '<div class="loader"><div class="spinner"></div><span>...</span></div>';
    try {
        const hh = await getHistoriqueStockVente(filtre||'today', dateDebut, dateFin, 100);
        if (!hh||hh.length===0) { c.innerHTML = '<div class="etat-vide"><p>Aucun mouvement</p></div>'; return; }
        let ht = '<div class="table-container"><table><thead><tr><th>Date</th><th>Type</th><th>Produit</th><th>Avant</th><th>Ajouté</th><th>Après</th><th>Prix</th><th>Commentaire</th></tr></thead><tbody>';
        hh.forEach(m => { 
            const d = new Date(m.date_mouvement), cl = m.quantite_ajoutee>=0?'color:#27ae60;':'color:#e74c3c;'; 
            const nom = NOMS_PRODUITS[m.type_produit] || m.type_produit;
            const unite = m.type_produit === 'morceaux' ? 'kg' : 'u.';
            const typeAff = m.type_mouvement === 'ajout' ? '➕ Ajout' : (m.type_mouvement === 'retrait' ? '➖ Retrait' : '✏️ Modif');
            ht += `<tr><td><small>${d.toLocaleDateString('fr-FR')}<br>${d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</small></td><td>${typeAff}</td><td><strong>${nom}</strong></td><td>${m.ancienne_quantite} ${unite}</td><td style="${cl}">${m.quantite_ajoutee>=0?'+':''}${m.quantite_ajoutee} ${unite}</td><td>${m.nouvelle_quantite} ${unite}</td><td>${m.nouveau_prix} F</td><td><small>${m.commentaire||'-'}</small></td></tr>`; 
        });
        ht += '</tbody></table></div>'; c.innerHTML = ht;
    } catch(e) { c.innerHTML = '<div class="alert alert-danger">Erreur</div>'; }
}

// ==========================================
// ONGLET 5 : CLIENTS
// ==========================================
async function initialiserOngletClients() { await chargerListeClientsAdmin(); initFormAjoutClient(); }
function initFormAjoutClient() { const ba = document.getElementById('btnAjouterClient'); if (ba) ba.addEventListener('click', async function(e) { e.preventDefault(); if (ba.disabled) return; await ajouterClientAvecPrix(); }); }
async function ajouterClientAvecPrix() {
    const nom = document.getElementById('clientNom').value.trim(); if (!nom) { afficherToast('Nom requis', 'warning'); return; }
    const btn = document.getElementById('btnAjouterClient'); btn.disabled = true; btn.textContent = '⏳...';
    try {
        const cl = await addClient(nom, document.getElementById('clientTelephone').value.trim()); if (!cl) { afficherToast('Erreur', 'error'); btn.disabled = false; btn.textContent = 'Ajouter'; return; }
        const prods = ['caramel_simple','caramel_gingembre','morceaux','farine_kilo'];
        const pfx = ['CaramelSimple','CaramelGingembre','Morceaux','FarineKilo'];
        for (let i=0;i<4;i++) { const pu=document.getElementById(`prix${pfx[i]}`)?.value, ql=document.getElementById(`lot${pfx[i]}`)?.value, pl=document.getElementById(`prixLot${pfx[i]}`)?.value; if (pu||(ql&&pl)) await setClientPrix({ client_id:cl.id, type_produit:prods[i], prix_unitaire:pu?Math.round(parseFloat(pu)):null, quantite_lot:ql?parseInt(ql):null, prix_lot:pl?Math.round(parseFloat(pl)):null }); }
        afficherToast(`✅ ${nom} ajouté`, 'success'); document.getElementById('clientNom').value=''; document.getElementById('clientTelephone').value=''; pfx.forEach(x=>{document.getElementById(`prix${x}`).value='';document.getElementById(`lot${x}`).value='';document.getElementById(`prixLot${x}`).value='';}); await chargerListeClientsAdmin();
    } catch(e) { afficherToast('Erreur', 'error'); } finally { btn.disabled = false; btn.textContent = 'Ajouter le client'; }
}
async function chargerListeClientsAdmin() {
    const c = document.getElementById('listeClients'); if (!c) return; c.innerHTML = '<div class="loader"><div class="spinner"></div><span>...</span></div>';
    tousClientsAdmin = await getClients(false); if (tousClientsAdmin.length===0) { c.innerHTML = '<div class="etat-vide"><p>Aucun client</p></div>'; return; }
    let h = '<div class="table-container"><table><thead><tr><th>Nom</th><th>Tél</th><th>Date</th><th>Actions</th></tr></thead><tbody>';
    tousClientsAdmin.forEach(cl => h += `<tr><td><strong>${cl.nom}</strong></td><td>${cl.telephone||'-'}</td><td>${new Date(cl.date_inscription).toLocaleDateString('fr-FR')}</td><td><button class="btn btn-outline btn-sm" onclick="ouvrirDetailClient(${cl.id})">✏️</button> <button class="btn btn-danger btn-sm" onclick="supprimerClientDefinitif(${cl.id},'${cl.nom.replace(/'/g,"\\'")}')">🗑️</button></td></tr>`);
    h += '</tbody></table></div>'; c.innerHTML = h;
}
async function ouvrirDetailClient(id) {
    const cl = tousClientsAdmin.find(x=>x.id===id); if (!cl) return;
    document.getElementById('detailClientId').value=cl.id; document.getElementById('detailClientNom').value=cl.nom; document.getElementById('detailClientTelephone').value=cl.telephone||'';
    ['CaramelSimple','CaramelGingembre','Morceaux','FarineKilo'].forEach(x=>{document.getElementById(`detailPrix${x}`).value='';document.getElementById(`detailLot${x}`).value='';document.getElementById(`detailPrixLot${x}`).value='';});
    const prix = await getClientPrix(id); prix.forEach(p=>{const pf={caramel_simple:'CaramelSimple',caramel_gingembre:'CaramelGingembre',morceaux:'Morceaux',farine_kilo:'FarineKilo'}[p.type_produit]; if(p.prix_unitaire)document.getElementById(`detailPrix${pf}`).value=p.prix_unitaire; if(p.quantite_lot)document.getElementById(`detailLot${pf}`).value=p.quantite_lot; if(p.prix_lot)document.getElementById(`detailPrixLot${pf}`).value=p.prix_lot;});
    document.getElementById('btnSupprimerClientDetail').onclick=async()=>{await supprimerClientDefinitif(id,cl.nom);fermerModalDetailClient();};
    const bm=document.getElementById('btnModifierClient'); if(bm)bm.onclick=async function(e){e.preventDefault();if(bm.disabled)return;await modifierClientDepuisDetail(id);};
    document.getElementById('modalDetailClient').classList.remove('hidden');
}
function fermerModalDetailClient() { document.getElementById('modalDetailClient').classList.add('hidden'); }
async function modifierClientDepuisDetail(id) {
    const nom=document.getElementById('detailClientNom').value.trim(); if(!nom){afficherToast('Nom requis','warning');return;}
    const btn=document.getElementById('btnModifierClient');btn.disabled=true;btn.textContent='⏳...';
    try { await getSupabaseClient().from('clients').update({nom,telephone:document.getElementById('detailClientTelephone').value.trim()}).eq('id',id); const prods=['caramel_simple','caramel_gingembre','morceaux','farine_kilo'],pfx=['CaramelSimple','CaramelGingembre','Morceaux','FarineKilo']; for(let i=0;i<4;i++){const pu=document.getElementById(`detailPrix${pfx[i]}`)?.value,ql=document.getElementById(`detailLot${pfx[i]}`)?.value,pl=document.getElementById(`detailPrixLot${pfx[i]}`)?.value;if(pu||(ql&&pl))await setClientPrix({client_id:id,type_produit:prods[i],prix_unitaire:pu?Math.round(parseFloat(pu)):null,quantite_lot:ql?parseInt(ql):null,prix_lot:pl?Math.round(parseFloat(pl)):null});} afficherToast(`✅ ${nom} modifié`,'success');fermerModalDetailClient();await chargerListeClientsAdmin(); }
    catch(e){afficherToast('Erreur','error');}finally{btn.disabled=false;btn.textContent='💾 Enregistrer';}
}
async function supprimerClientDefinitif(id,nom) { if(!confirm(`Supprimer "${nom}" ?`)||!confirm('CONFIRMATION'))return; try{await getSupabaseClient().from('clients').delete().eq('id',id);afficherToast(`✅ ${nom} supprimé`,'success');await chargerListeClientsAdmin();}catch(e){afficherToast('Erreur','error');} }

// ==========================================
// ONGLET 6 : VENTES (ADMIN)
// ==========================================
async function initialiserOngletVentesAdmin() {
    document.querySelectorAll('.filtre-vente-btn').forEach(b=>{const nb=b.cloneNode(true);b.parentNode.replaceChild(nb,b);});
    document.querySelectorAll('.filtre-vente-btn').forEach(b=>b.addEventListener('click',function(){document.querySelectorAll('.filtre-vente-btn').forEach(x=>x.classList.remove('active'));this.classList.add('active');filtreVentesActif=this.getAttribute('data-filtre');chargerVentesAdmin(filtreVentesActif);}));
    const bfd=document.getElementById('btnFiltrerDate');if(bfd){const nb=bfd.cloneNode(true);bfd.parentNode.replaceChild(nb,bfd);nb.addEventListener('click',()=>{const dd=document.getElementById('filtreDateDebut').value,df=document.getElementById('filtreDateFin').value;if(dd&&df){document.querySelectorAll('.filtre-vente-btn').forEach(x=>x.classList.remove('active'));chargerVentesAdmin('custom',dd,df);}else afficherToast('Sélectionnez les deux dates','warning');});}
    await chargerVentesAdmin('today');
}
async function chargerVentesAdmin(filtre,ddc,dfc) {
    const c=document.getElementById('tableauVentesAdmin');if(!c)return;c.innerHTML='<div class="loader"><div class="spinner"></div><span>...</span></div>';
    const aujourdHui=getTodayDate();let dd,df;
    if(filtre==='today'){dd=aujourdHui;df=aujourdHui;}else if(filtre==='yesterday'){const h=new Date();h.setDate(h.getDate()-1);dd=formatDate(h);df=dd;}else if(filtre==='all'){dd='2024-01-01';df=aujourdHui;}else{dd=ddc;df=dfc;}
    const ventes=await getVentesPeriode(dd,df);if(!ventes||ventes.length===0){c.innerHTML='<div class="etat-vide"><p>Aucune vente</p></div>';return;}
    let totalGen=0;
    let h='<div class="table-container"><table><thead><tr><th>N°</th><th>Date/Heure</th><th>Client</th><th>NB</th><th>Total</th><th>Reçu</th><th>Paiement</th><th>Caissier</th><th>Statut</th><th>Actions</th></tr></thead><tbody>';
    ventes.forEach(v=>{
        const estAnnule=v.statut==='annule';if(!estAnnule)totalGen+=Math.round(parseFloat(v.total_vente)||0);
        const d=new Date(v.date_vente);
        const numero=v.numero_commande||('C'+String(v.id).padStart(4,'0'));
        const mp=(v.mode_paiement||'espece')==='orange'?'📱 OM':(v.mode_paiement==='combine'?'💵+📱':'💵 Espèce');
        const badge=estAnnule?'<span style="background:#e74c3c;color:white;padding:2px 8px;border-radius:10px;">ANNULÉ</span>':'<span style="background:#27ae60;color:white;padding:2px 8px;border-radius:10px;">Actif</span>';
        const ba=!estAnnule?`<button class="btn btn-danger btn-sm" onclick="annulerCommandeAdmin(${v.id},'${numero}')">✕</button>`:'';
        
        let nbProduits = 0;
        let qteTotale = 0;
        let detailsHtml = '';
        if (v.details) {
            try {
                const details = JSON.parse(v.details);
                nbProduits = details.reduce((s, item) => s + (parseFloat(item.quantite) || 0), 0);
                qteTotale = nbProduits;
                details.forEach(item => {
                    const nom = NOMS_PRODUITS[item.type_produit] || item.nom || item.type_produit;
                    const unite = item.type_produit === 'morceaux' ? 'kg' : 'u.';
                    detailsHtml += `<div style="font-size:0.75rem;color:#666;">${nom}: ${item.quantite} ${unite} × ${item.prix_unitaire} F = ${item.total} F</div>`;
                });
            } catch(e) {}
        }
        if (!detailsHtml) {
            const nom = NOMS_PRODUITS[v.type_produit] || v.type_produit || 'PANIER';
            const unite = v.type_produit === 'morceaux' ? 'kg' : 'u.';
            nbProduits = parseFloat(v.quantite) || 0;
            qteTotale = nbProduits;
            detailsHtml = `<div style="font-size:0.75rem;color:#666;">${nom}: ${v.quantite} ${unite}</div>`;
        }
        
        const recu = Math.round(parseFloat(v.total_vente)||0);
        
        h+=`<tr style="${estAnnule?'opacity:0.6;text-decoration:line-through;':''}">
            <td><strong>#${numero}</strong></td>
            <td><small>${d.toLocaleDateString('fr-FR')}<br>${d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</small></td>
            <td><strong>${v.client_nom||'Client'}</strong></td>
            <td><details><summary>${nbProduits}</summary>${detailsHtml}</details></td>
            <td>${qteTotale}</td>
            <td><strong>${recu.toLocaleString('fr-FR')} FCFA</strong></td>
            <td>${mp}</td>
            <td>${v.caissier_nom}</td>
            <td>${badge}</td>
            <td>${ba}</td>
        </tr>`;
    });
    h+=`<tr style="background:#f0f7f3;font-weight:bold;"><td colspan="5">TOTAL GÉNÉRAL</td><td><strong>${totalGen.toLocaleString('fr-FR')} FCFA</strong></td><td></td><td></td><td></td><td></td></tr></tbody></table></div>`;
    c.innerHTML = h;
}
async function annulerCommandeAdmin(venteId,numero) { if(!confirm(`⚠️ Annuler #${numero} ?`))return;if(!confirm('CONFIRMATION'))return;try{const r=await annulerVente(venteId);if(r){afficherToast(`✅ #${numero} annulée`,'success');await chargerVentesAdmin(filtreVentesActif);await chargerStockVente();}else afficherToast('❌ Erreur','error');}catch(e){afficherToast('Erreur','error');} }

// ==========================================
// ONGLET 7 : REÇUS
// ==========================================
async function initialiserOngletRecu() {
    document.querySelectorAll('.filtre-recu-btn').forEach(b=>{const nb=b.cloneNode(true);b.parentNode.replaceChild(nb,b);});
    document.querySelectorAll('.filtre-recu-btn').forEach(b=>b.addEventListener('click',function(){document.querySelectorAll('.filtre-recu-btn').forEach(x=>x.classList.remove('active'));this.classList.add('active');filtreRecuActif=this.getAttribute('data-filtre');chargerRecus(filtreRecuActif);}));
    const bfd=document.getElementById('btnFiltrerRecuDate');if(bfd){const nb=bfd.cloneNode(true);bfd.parentNode.replaceChild(nb,bfd);nb.addEventListener('click',()=>{const dd=document.getElementById('recuDateDebut').value,df=document.getElementById('recuDateFin').value;if(dd&&df){document.querySelectorAll('.filtre-recu-btn').forEach(x=>x.classList.remove('active'));chargerRecus('custom',dd,df);}else afficherToast('Sélectionnez les deux dates','warning');});}
    await chargerRecus('today');
}
async function chargerRecus(filtre,ddc,dfc) {
    const c=document.getElementById('tableauRecus');if(!c)return;c.innerHTML='<div class="loader"><div class="spinner"></div><span>...</span></div>';
    const aujourdHui=getTodayDate();let dd,df;
    if(filtre==='today'){dd=aujourdHui;df=aujourdHui;}else if(filtre==='yesterday'){const h=new Date();h.setDate(h.getDate()-1);dd=formatDate(h);df=dd;}else if(filtre==='all'){dd='2024-01-01';df=aujourdHui;}else{dd=ddc;df=dfc;}
    const ventes=await getVentesPeriode(dd,df);if(!ventes||ventes.length===0){c.innerHTML='<div class="etat-vide"><p>Aucun ticket</p></div>';return;}
    let h='<div class="table-container"><table><thead><tr><th>N°</th><th>Date/Heure</th><th>Client</th><th>NB</th><th>Total</th><th>Reçu</th><th>Paiement</th><th>Caissier</th><th>Statut</th><th>Actions</th></tr></thead><tbody>';
    ventes.forEach(v=>{
        const d=new Date(v.date_vente);
        const numero=v.numero_commande||('C'+String(v.id).padStart(4,'0'));
        const mp=(v.mode_paiement||'espece')==='orange'?'📱 OM':(v.mode_paiement==='combine'?'💵+📱':'💵 Espèce');
        const estAnnule=v.statut==='annule';
        const badge=estAnnule?'<span style="background:#e74c3c;color:white;padding:2px 8px;border-radius:10px;">ANNULÉ</span>':'<span style="background:#27ae60;color:white;padding:2px 8px;border-radius:10px;">Actif</span>';
        const ba=!estAnnule?`<button class="btn btn-danger btn-sm" onclick="annulerCommandeRecu(${v.id},'${numero}')">✕</button>`:'';
        
        let nbProduits = 0;
        let qteTotale = 0;
        let detailsHtml = '';
        if (v.details) {
            try {
                const details = JSON.parse(v.details);
                nbProduits = details.reduce((s, item) => s + (parseFloat(item.quantite) || 0), 0);
                qteTotale = nbProduits;
                details.forEach(item => {
                    const nom = NOMS_PRODUITS[item.type_produit] || item.nom || item.type_produit;
                    const unite = item.type_produit === 'morceaux' ? 'kg' : 'u.';
                    detailsHtml += `<div style="font-size:0.7rem;color:#666;">${nom}: ${item.quantite} ${unite} × ${item.prix_unitaire} F = ${item.total} F</div>`;
                });
            } catch(e) {}
        }
        if (!detailsHtml) {
            const nom = NOMS_PRODUITS[v.type_produit] || v.type_produit || 'PANIER';
            const unite = v.type_produit === 'morceaux' ? 'kg' : 'u.';
            nbProduits = parseFloat(v.quantite) || 0;
            qteTotale = nbProduits;
            detailsHtml = `<div style="font-size:0.7rem;color:#666;">${nom}: ${v.quantite} ${unite}</div>`;
        }
        
        const recu = Math.round(parseFloat(v.total_vente)||0);
        
        h+=`<tr style="${estAnnule?'opacity:0.6;':''}">
            <td><strong>#${numero}</strong></td>
            <td><small>${d.toLocaleDateString('fr-FR')}<br>${d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</small></td>
            <td><strong>${v.client_nom||'Client'}</strong></td>
            <td><details><summary>${nbProduits}</summary>${detailsHtml}</details></td>
            <td>${qteTotale}</td>
            <td><strong>${recu.toLocaleString('fr-FR')} FCFA</strong></td>
            <td>${mp}</td>
            <td>${v.caissier_nom}</td>
            <td>${badge}</td>
            <td style="display:flex;gap:0.25rem;flex-wrap:wrap;">${ba}<button class="btn btn-outline btn-sm" onclick="imprimerTicketRecu(${v.id})">🖨️</button><button class="btn btn-outline btn-sm" onclick="telechargerTicketRecu(${v.id})">📥</button></td>
        </tr>`;
    });
    h+='</tbody></table></div>';c.innerHTML=h;window._recusVentes=ventes;
}
async function annulerCommandeRecu(venteId,numero) { if(!confirm(`⚠️ Annuler #${numero} ?`))return;if(!confirm('CONFIRMATION'))return;try{const r=await annulerVente(venteId);if(r){afficherToast(`✅ #${numero} annulée`,'success');await chargerRecus(filtreRecuActif);await chargerStockVente();}else afficherToast('❌ Erreur','error');}catch(e){afficherToast('Erreur','error');} }
async function imprimerTicketRecu(venteId) {
    const ventes=window._recusVentes||[];const vente=ventes.find(v=>v.id===venteId);if(!vente)return;
    const config=await getConfig();const nomE=config.entreprise_nom||'FASO TEEDO';const msg=config.ticket_message||'Merci';const logo=config.logo_url||'';
    const d=new Date(vente.date_vente);const tv=Math.round(parseFloat(vente.total_vente)||0);const numero=vente.numero_commande||('C'+String(vente.id).padStart(4,'0'));
    let panier=[];if(vente.details){try{panier=JSON.parse(vente.details);}catch(e){}}if(panier.length===0)panier=[{nom:vente.type_produit,quantite:vente.quantite,total:tv,prix_unitaire:vente.prix_unitaire_applique}];
    let lignes='';panier.forEach(item=>{
        const unite = item.type_produit === 'morceaux' ? 'kg' : 'u.';
        const nom = NOMS_PRODUITS[item.type_produit] || item.nom || item.type_produit || 'Produit';
        lignes+=`<p style="margin:2px 0;"><strong>${nom}:</strong> ${item.quantite} ${unite} × ${item.prix_unitaire||vente.prix_unitaire_applique||0} F</p><p style="text-align:right;margin:2px 0 8px;"><strong>${Math.round(item.total).toLocaleString('fr-FR')} FCFA</strong></p>`;
    });
    const html=`<div style="font-family:'Courier New',monospace;max-width:350px;margin:20px auto;padding:20px;border:2px dashed #ccc;background:white;text-align:center;">${logo?`<div><img src="${logo}" style="max-height:60px;background:transparent;"></div>`:''}<div style="border-bottom:1px dashed #000;"><h3>${nomE}</h3><p>${d.toLocaleDateString('fr-FR')} - ${d.toLocaleTimeString('fr-FR')}</p><p><strong>Client: ${vente.client_nom||'Client'}</strong></p><p>#${numero}</p></div><div>${lignes}</div><div style="border-top:1px dashed #000;"><p style="font-size:1.2rem;font-weight:bold;">TOTAL: ${tv.toLocaleString('fr-FR')} FCFA</p><p>${msg}</p><p>Caissier: ${vente.caissier_nom}</p></div></div>`;
    const w=window.open('','_blank','width=400,height=600');w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>#${numero}</title><style>body{font-family:'Courier New',monospace;padding:10px;}@media print{body{width:80mm;}}</style></head><body>${html}<script>window.onload=function(){window.print();};<\/script></body></html>`);w.document.close();
}
async function telechargerTicketRecu(venteId) {
    const ventes=window._recusVentes||[];const vente=ventes.find(v=>v.id===venteId);if(!vente)return;
    const config=await getConfig();const nomE=config.entreprise_nom||'FASO TEEDO';const msg=config.ticket_message||'Merci';
    const d=new Date(vente.date_vente);const tv=Math.round(parseFloat(vente.total_vente)||0);const numero=vente.numero_commande||('C'+String(vente.id).padStart(4,'0'));
    let panier=[];if(vente.details){try{panier=JSON.parse(vente.details);}catch(e){}}if(panier.length===0)panier=[{nom:vente.type_produit,quantite:vente.quantite,total:tv}];
    let lignes=['================================','        '+nomE,'================================','Date : '+d.toLocaleDateString('fr-FR')+' '+d.toLocaleTimeString('fr-FR'),'Client : '+(vente.client_nom||'Client'),'Commande #'+numero,'--------------------------------'];
    panier.forEach(item=>{
        const unite = item.type_produit === 'morceaux' ? 'kg' : 'u.';
        const nom = NOMS_PRODUITS[item.type_produit] || item.nom || item.type_produit || 'Produit';
        lignes.push(`${nom}: ${item.quantite} ${unite} × ${item.prix_unitaire||vente.prix_unitaire_applique||0} F = ${item.total} F`);
    });
    lignes.push('--------------------------------','TOTAL : '+tv+' FCFA','--------------------------------',msg,'Caissier : '+vente.caissier_nom,'================================');
    const blob=new Blob(['\uFEFF'+lignes.join('\n')],{type:'text/plain'});const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='ticket_'+numero+'.txt';document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
    afficherToast('✅ Ticket téléchargé','success');
}

// ==========================================
// ONGLET 8 : CONFIGURATION
// ==========================================
async function initialiserOngletConfiguration() { 
    await chargerChampsConfiguration(); 
    initFormConfig(); 
    await chargerNumerosEntreprise(); 
    initAjoutNumero(); 
}
async function chargerConfiguration() { configActuelle = await getConfig(); }
async function chargerChampsConfiguration() {
    document.getElementById('configEntrepriseNom').value = configActuelle.entreprise_nom || '';
    document.getElementById('configEntrepriseTelephone').value = configActuelle.entreprise_telephone || '';
    document.getElementById('configEntrepriseEmail').value = configActuelle.entreprise_email || '';
    document.getElementById('configEntrepriseAdresse').value = configActuelle.entreprise_adresse || '';
    document.getElementById('configTicketMessage').value = configActuelle.ticket_message || '';
    document.getElementById('configFooterText').value = configActuelle.footer_text || '';
    
    const previewLogo = document.getElementById('previewImageLogo');
    const btnSupprLogo = document.getElementById('btnSupprimerLogo');
    if (configActuelle.logo_url && configActuelle.logo_url.trim() !== '') {
        previewLogo.src = configActuelle.logo_url + '?t=' + Date.now();
        previewLogo.style.display = 'block';
        if (btnSupprLogo) btnSupprLogo.style.display = 'inline-block';
    } else {
        previewLogo.style.display = 'none';
        if (btnSupprLogo) btnSupprLogo.style.display = 'none';
    }
    
    const previewFond = document.getElementById('previewImageFond');
    const btnSupprFond = document.getElementById('btnSupprimerFond');
    if (configActuelle.fond_url && configActuelle.fond_url.trim() !== '') {
        previewFond.src = configActuelle.fond_url + '?t=' + Date.now();
        previewFond.style.display = 'block';
        if (btnSupprFond) btnSupprFond.style.display = 'inline-block';
    } else {
        previewFond.style.display = 'none';
        if (btnSupprFond) btnSupprFond.style.display = 'none';
    }
}

function initFormConfig() {
    document.getElementById('configLogo').addEventListener('change', function() { 
        const f = this.files[0]; 
        if (f && f.size <= 2*1024*1024) {
            fichierLogoUpload = f;
            const reader = new FileReader();
            reader.onload = function(e) {
                const preview = document.getElementById('previewImageLogo');
                preview.src = e.target.result;
                preview.style.display = 'block';
                document.getElementById('btnSupprimerLogo').style.display = 'inline-block';
            };
            reader.readAsDataURL(f);
        } else if (f) {
            afficherToast('Le logo ne doit pas dépasser 2 Mo', 'warning');
            this.value = '';
        }
    });
    
    document.getElementById('configFond').addEventListener('change', function() { 
        const f = this.files[0]; 
        if (f && f.size <= 5*1024*1024) {
            fichierFondUpload = f;
            const reader = new FileReader();
            reader.onload = function(e) {
                const preview = document.getElementById('previewImageFond');
                preview.src = e.target.result;
                preview.style.display = 'block';
                document.getElementById('btnSupprimerFond').style.display = 'inline-block';
            };
            reader.readAsDataURL(f);
        } else if (f) {
            afficherToast('L\'image de fond ne doit pas dépasser 5 Mo', 'warning');
            this.value = '';
        }
    });
    
    document.getElementById('btnSupprimerLogo').addEventListener('click', async function() {
        if (!confirm('Supprimer le logo ?')) return;
        document.getElementById('previewImageLogo').style.display = 'none';
        document.getElementById('previewImageLogo').src = '';
        document.getElementById('configLogo').value = '';
        fichierLogoUpload = null;
        this.style.display = 'none';
        await sauvegarderConfigurationAvecSuppression('logo_url');
        afficherToast('✅ Logo supprimé', 'success');
    });
    
    document.getElementById('btnSupprimerFond').addEventListener('click', async function() {
        if (!confirm('Supprimer l\'image de fond ?')) return;
        document.getElementById('previewImageFond').style.display = 'none';
        document.getElementById('previewImageFond').src = '';
        document.getElementById('configFond').value = '';
        fichierFondUpload = null;
        this.style.display = 'none';
        await sauvegarderConfigurationAvecSuppression('fond_url');
        afficherToast('✅ Fond supprimé', 'success');
    });
    
    const bs = document.getElementById('btnSauvegarderConfig');
    if (bs) bs.addEventListener('click', async function(e) {
        e.preventDefault();
        if (bs.disabled) return;
        await sauvegarderConfiguration();
    });
}

async function sauvegarderConfigurationAvecSuppression(cle) {
    if (!isOnline) { afficherToast('Hors-ligne, impossible de supprimer', 'error'); return; }
    const c = {};
    c[cle] = '';
    const ok = await updateMultipleConfig(c);
    if (ok) {
        configActuelle[cle] = '';
        if (cle === 'logo_url') {
            localStorage.removeItem('faso_teedo_logo');
            const logoDisplay = document.getElementById('logoDisplay');
            if (logoDisplay) {
                logoDisplay.classList.add('logo-fallback');
                logoDisplay.innerHTML = '🏭';
            }
            document.getElementById('previewImageLogo').style.display = 'none';
            document.getElementById('btnSupprimerLogo').style.display = 'none';
        } else if (cle === 'fond_url') {
            localStorage.removeItem('faso_teedo_fond');
            document.body.style.backgroundImage = '';
            document.body.style.backgroundSize = '';
            document.body.style.backgroundPosition = '';
            document.body.style.backgroundAttachment = '';
            document.body.style.backgroundRepeat = '';
            document.body.classList.remove('fond-personnalise');
            document.getElementById('previewImageFond').style.display = 'none';
            document.getElementById('btnSupprimerFond').style.display = 'none';
        }
    }
}

async function sauvegarderConfiguration() {
    const btn = document.getElementById('btnSauvegarderConfig');
    btn.disabled = true;
    btn.textContent = '⏳...';
    
    try {
        const c = {};
        c.entreprise_nom = document.getElementById('configEntrepriseNom').value.trim();
        c.entreprise_telephone = document.getElementById('configEntrepriseTelephone').value.trim();
        c.entreprise_email = document.getElementById('configEntrepriseEmail').value.trim();
        c.entreprise_adresse = document.getElementById('configEntrepriseAdresse').value.trim();
        c.ticket_message = document.getElementById('configTicketMessage').value.trim();
        c.footer_text = document.getElementById('configFooterText').value.trim();
        
        const mdp = document.getElementById('configMotDePasse').value.trim();
        if (mdp) c.mot_de_passe_admin = mdp;
        
        if (fichierLogoUpload) {
            const url = await uploadFile('images', `logo/logo_${Date.now()}.png`, fichierLogoUpload);
            if (url) {
                c.logo_url = url;
                fichierLogoUpload = null;
            }
        }
        
        if (fichierFondUpload) {
            const url = await uploadFile('images', `fond/fond_${Date.now()}.jpg`, fichierFondUpload);
            if (url) {
                c.fond_url = url;
                fichierFondUpload = null;
            }
        }
        
        const ok = await updateMultipleConfig(c);
        if (ok) {
            afficherToast('✅ Config sauvegardée !', 'success');
            configActuelle = { ...configActuelle, ...c };
            
            if (c.logo_url) {
                localStorage.setItem('faso_teedo_logo', c.logo_url);
                const preview = document.getElementById('previewImageLogo');
                preview.src = c.logo_url + '?t=' + Date.now();
                preview.style.display = 'block';
                document.getElementById('btnSupprimerLogo').style.display = 'inline-block';
            }
            if (c.fond_url) {
                document.body.style.backgroundImage = `url(${c.fond_url}?t=${Date.now()})`;
                document.body.style.backgroundSize = 'cover';
                document.body.style.backgroundPosition = 'center';
                document.body.style.backgroundAttachment = 'fixed';
                document.body.style.backgroundRepeat = 'no-repeat';
                document.body.classList.add('fond-personnalise');
                localStorage.setItem('faso_teedo_fond', c.fond_url);
                const preview = document.getElementById('previewImageFond');
                preview.src = c.fond_url + '?t=' + Date.now();
                preview.style.display = 'block';
                document.getElementById('btnSupprimerFond').style.display = 'inline-block';
            }
            
            document.getElementById('configMotDePasse').value = '';
            document.getElementById('configLogo').value = '';
            document.getElementById('configFond').value = '';
            
            await chargerConfiguration();
        } else {
            afficherToast('Erreur lors de la sauvegarde', 'error');
        }
    } catch(e) {
        afficherToast('Erreur: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '💾 SAUVEGARDER';
    }
}

async function chargerNumerosEntreprise() { const c=document.getElementById('listeNumeros');const n=await getNumerosEntreprise();if(n.length===0){c.innerHTML='<p style="color:#999;">Aucun numéro</p>';return;}let h='<div style="display:flex;flex-wrap:wrap;gap:0.5rem;">';n.forEach(x=>h+=`<span style="display:inline-flex;align-items:center;gap:0.5rem;background:#f0f0f0;padding:0.5rem 1rem;border-radius:20px;">${x.numero}<button style="width:24px;height:24px;background:#e74c3c;color:white;border:none;border-radius:50%;cursor:pointer;" onclick="supprimerNumero(${x.id},'${x.numero}')">✕</button></span>`);h+='</div>';c.innerHTML=h; }
function initAjoutNumero() { const b=document.getElementById('btnAjouterNumero'),i=document.getElementById('configNumero');b.addEventListener('click',async()=>{const n=i.value.trim();if(!n){afficherToast('Numéro requis','warning');return;}if(await addNumeroEntreprise(n)){afficherToast('✅ Ajouté','success');i.value='';await chargerNumerosEntreprise();}});i.addEventListener('keypress',e=>{if(e.key==='Enter')b.click();}); }
async function supprimerNumero(id,n) { if(!confirm(`Supprimer ${n} ?`))return;if(await deleteNumeroEntreprise(id)){afficherToast('✅ Supprimé','success');await chargerNumerosEntreprise();} }

// ==========================================
// ONGLET 9 : GRILLE DE PRIX
// ==========================================
async function initialiserOngletGrille() { await chargerGrillePrix(); initFormGrillePrix(); }
async function chargerGrillePrix() {
    const c = document.getElementById('tableauGrillePrix'); if (!c) return;
    c.innerHTML = '<div class="loader"><div class="spinner"></div><span>...</span></div>';
    try {
        const grille = await getGrillePrix();
        if (grille.length === 0) { c.innerHTML = '<div class="etat-vide"><p>Aucune grille</p></div>'; return; }
        let h = '<div class="table-container"><table><thead><tr><th>Type</th><th>Min</th><th>Max</th><th>Prix/pers</th><th>Actions</th></tr></thead><tbody>';
        grille.forEach(g => { h += `<tr><td>${g.type_travail==='fabrication'?'🏭 Fab':'📦 Emb'}</td><td>${g.nb_personnes_min}</td><td>${g.nb_personnes_max}</td><td><strong>${g.prix_par_personne.toLocaleString('fr-FR')} FCFA</strong></td><td><button class="btn btn-danger btn-sm" onclick="supprimerGrillePrix(${g.id})">🗑️</button></td></tr>`; });
        h += '</tbody></table></div>'; c.innerHTML = h;
    } catch(e) { c.innerHTML = '<div class="alert alert-danger">Erreur</div>'; }
}
function initFormGrillePrix() { const btn = document.getElementById('btnAjouterGrille'); if (btn) btn.addEventListener('click', async function(e) { e.preventDefault(); if (btn.disabled) return; await ajouterGrillePrix(); }); }
async function ajouterGrillePrix() {
    const type = document.getElementById('grilleType').value;
    const min = parseInt(document.getElementById('grilleMin').value);
    const max = parseInt(document.getElementById('grilleMax').value);
    const prix = parseInt(document.getElementById('grillePrix').value);
    if (!type||isNaN(min)||isNaN(max)||isNaN(prix)) { afficherToast('Tous les champs requis', 'warning'); return; }
    const btn = document.getElementById('btnAjouterGrille'); btn.disabled = true; btn.textContent = '⏳...';
    try { if (await saveGrillePrix({ nb_personnes_min: min, nb_personnes_max: max, prix_par_personne: prix, type_travail: type })) { afficherToast('✅ Grille ajoutée', 'success'); document.getElementById('grilleMin').value='';document.getElementById('grilleMax').value='';document.getElementById('grillePrix').value=''; await chargerGrillePrix(); } else afficherToast('Erreur', 'error'); }
    catch(e) { afficherToast('Erreur', 'error'); } finally { btn.disabled = false; btn.textContent = 'Ajouter'; }
}
async function supprimerGrillePrix(id) { if (!confirm('Supprimer ?')) return; if (await deleteGrillePrix(id)) { afficherToast('✅ Supprimée', 'success'); await chargerGrillePrix(); } }

// ==========================================
// ONGLET 10 : RÉINITIALISATION
// ==========================================
async function initialiserOngletReset() {
    document.getElementById('btnLancerReset').addEventListener('click',function(){
        document.getElementById('resetSteps').classList.remove('hidden');
        document.getElementById('resetStep1').classList.remove('hidden');
        document.getElementById('resetStep2').classList.add('hidden');
        document.getElementById('resetStep3').classList.add('hidden');
        document.getElementById('resetMdp').value='';
        document.getElementById('resetTexte').value='';
        document.getElementById('btnLancerReset').classList.add('hidden');
    });
    
    document.getElementById('btnResetStep1').addEventListener('click',async function(){
        const m=document.getElementById('resetMdp').value.trim();
        if(!m){afficherToast('Mot de passe requis','warning');return;}
        if(!await verifyPassword(m)){afficherToast('Mot de passe incorrect','error');return;}
        document.getElementById('resetStep1').classList.add('hidden');
        document.getElementById('resetStep2').classList.remove('hidden');
        document.getElementById('resetTexte').focus();
    });
    
    document.getElementById('btnResetStep2').addEventListener('click',function(){
        if(document.getElementById('resetTexte').value.trim()!=='Réinitialiser Teedo_du_faso'){
            afficherToast('Texte incorrect','error');
            return;
        }
        document.getElementById('resetStep2').classList.add('hidden');
        document.getElementById('resetStep3').classList.remove('hidden');
        lancerDelaiReset();
    });
    
    document.getElementById('btnResetStep3').addEventListener('click',async function(){
        clearInterval(resetDelaiTimer);
        await executerReinitialisation();
    });
    
    document.getElementById('btnResetAnnuler').addEventListener('click',function(){
        clearInterval(resetDelaiTimer);
        afficherToast('❌ ANNULÉ','info');
        resetUI();
    });
    
    document.getElementById('btnRestaurer').addEventListener('click',async function(){
        const s=await getDerniereSauvegarde();
        if(!s){afficherToast('Aucune sauvegarde','warning');return;}
        if(!confirm('Restaurer la sauvegarde du ' + new Date(s.date_sauvegarde).toLocaleString('fr-FR') + ' ?')) return;
        await restaurerDonnees(s);
    });
    
    await afficherInfoSauvegarde();
}

function lancerDelaiReset() {
    resetDelaiSecondes=15;
    document.getElementById('resetDelai').textContent='15';
    document.getElementById('resetDelaiBar').style.width='100%';
    clearInterval(resetDelaiTimer);
    resetDelaiTimer=setInterval(()=>{
        resetDelaiSecondes--;
        document.getElementById('resetDelai').textContent=resetDelaiSecondes;
        document.getElementById('resetDelaiBar').style.width=(resetDelaiSecondes/15*100)+'%';
        if(resetDelaiSecondes<=0){
            clearInterval(resetDelaiTimer);
            executerReinitialisation();
        }
    },1000);
}

function resetUI() {
    clearInterval(resetDelaiTimer);
    document.getElementById('resetSteps').classList.add('hidden');
    document.getElementById('btnLancerReset').classList.remove('hidden');
}

async function executerReinitialisation() {
    clearInterval(resetDelaiTimer);
    const tables=[];
    document.querySelectorAll('.reset-cb:checked').forEach(cb=>tables.push(cb.getAttribute('data-table')));
    if(tables.length===0){afficherToast('Aucune table','warning');resetUI();return;}
    
    afficherToast('💾 Création de la sauvegarde...', 'info');
    const donnees={};
    for(const t of tables){
        try{
            const { data } = await getSupabaseClient().from(t).select('*');
            if(data && data.length > 0) donnees[t]=data;
        } catch(e){}
    }
    
    const dateSauvegarde = new Date().toLocaleString('fr-FR');
    await addSauvegarde(donnees, `Réinitialisation du ${dateSauvegarde}`);
    afficherToast('✅ Sauvegarde créée', 'success');
    
    try{
        for(const t of tables){
            await getSupabaseClient().from(t).delete().neq('id',0);
        }
        if(tables.includes('stock_vente')) await initialiserStockVenteDefaut();
        await reinitialiserCompteurCommandes();
        afficherToast('✅ Réinitialisation terminée !', 'success');
        resetUI();
        await afficherInfoSauvegarde();
        setTimeout(()=>location.reload(), 1500);
    } catch(e){
        afficherToast('Erreur lors de la réinitialisation', 'error');
        resetUI();
    }
}

async function afficherInfoSauvegarde() {
    const info=document.getElementById('restoreInfo');
    const btn=document.getElementById('btnRestaurer');
    info.innerHTML='<p>Chargement...</p>';
    try{
        const ss=await getSauvegardes(5);
        if(!ss || ss.length===0){
            info.innerHTML='<div class="etat-vide"><p>Aucune sauvegarde disponible</p></div>';
            btn.classList.add('hidden');
            return;
        }
        let h='';
        ss.forEach((s,i)=>{
            const d=new Date(s.date_sauvegarde || s.date);
            const isLatest = i === 0 ? ' style="background:#eaf2f8;border-left:4px solid #2980b9;"' : '';
            h += `<div${isLatest} style="padding:0.5rem;border-bottom:1px solid #eee;">
                <strong>📅 ${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR')}</strong>
                <br><small style="color:#666;">${s.commentaire || 'Sauvegarde automatique'}</small>
                ${i === 0 ? ' <span style="background:#27ae60;color:white;padding:1px 8px;border-radius:10px;font-size:0.7rem;">Dernière</span>' : ''}
            </div>`;
        });
        info.innerHTML = h;
        btn.classList.remove('hidden');
    } catch(e){
        info.innerHTML='<div class="etat-vide"><p>Erreur chargement sauvegardes</p></div>';
        btn.classList.add('hidden');
    }
}

async function restaurerDonnees(s) {
    try{
        for(const [t, d] of Object.entries(s.donnees)){
            if(d && d.length > 0){
                await getSupabaseClient().from(t).delete().neq('id', 0);
                await getSupabaseClient().from(t).insert(d);
            }
        }
        afficherToast('✅ Restauration terminée !', 'success');
        setTimeout(()=>location.reload(), 1500);
    } catch(e){
        afficherToast('Erreur lors de la restauration', 'error');
    }
}

// ==========================================
// BLUETOOTH
// ==========================================
function initialiserBluetooth() { document.getElementById('btnRechercherImprimante').addEventListener('click',rechercherImprimanteBluetooth);document.getElementById('btnDeconnecterImprimante').addEventListener('click',deconnecterImprimante);document.getElementById('btnTesterImpression').addEventListener('click',testerImpression); }
async function rechercherImprimanteBluetooth() { if(!navigator.bluetooth){afficherToast('Bluetooth non supporté','error');return;}const btn=document.getElementById('btnRechercherImprimante');btn.disabled=true;btn.textContent='🔍...';try{const p=await navigator.bluetooth.requestDevice({acceptAllDevices:true,optionalServices:['00001101-0000-1000-8000-00805f9b34fb']});imprimanteBluetooth=p;p.addEventListener('gattserverdisconnected',()=>{mettreAJourStatusImprimante(false);});serveurBluetooth=await p.gatt.connect();const services=await serveurBluetooth.getPrimaryServices();let carac=null;for(const s of services){const caracs=await s.getCharacteristics();for(const c of caracs){if(c.properties.write||c.properties.writeWithoutResponse){carac=c;break;}}if(carac)break;}if(!carac)carac=(await services[0].getCharacteristics())[0];caracteristiqueImprimante=carac;mettreAJourStatusImprimante(true,p.name||'Imprimante');afficherToast('✅ Connectée !','success');}catch(e){mettreAJourStatusImprimante(false);afficherToast('❌ Erreur','error');}finally{btn.disabled=false;btn.textContent='🔍 Rechercher';} }
function mettreAJourStatusImprimante(ok,nom) { const d=document.getElementById('imprimanteStatus'),t=document.getElementById('imprimanteStatusTexte'),b=document.getElementById('btnDeconnecterImprimante');if(ok){d.className='imprimante-status connectee';t.textContent=`✅ ${nom||'Connectée'}`;b.classList.remove('hidden');}else{d.className='imprimante-status deconnectee';t.textContent='Non connectée';b.classList.add('hidden');} }
async function deconnecterImprimante() { if(imprimanteBluetooth?.gatt.connected)await imprimanteBluetooth.gatt.disconnect();mettreAJourStatusImprimante(false); }
async function testerImpression() { if(!caracteristiqueImprimante){afficherToast('Pas d\'imprimante','warning');return;}try{await caracteristiqueImprimante.writeValue(new TextEncoder().encode('\x1B\x40\x1B\x61\x01FASO TEEDO\nTEST\n\n\n\n\x1D\x56\x41'));afficherToast('✅ Imprimé !','success');}catch(e){afficherToast('Erreur','error');} }
window.imprimerTicketBluetooth = async function(texte) { if(!caracteristiqueImprimante)return false;try{await caracteristiqueImprimante.writeValue(new TextEncoder().encode('\x1B\x40\x1B\x61\x01'+texte+'\n\n\n\n\x1D\x56\x41'));return true;}catch(e){return false;} };

function afficherToast(message, type) { const c=document.getElementById('toastContainer');if(!c)return;const t=document.createElement('div');t.className=`toast toast-${type}`;t.innerHTML=`<span>${type==='success'?'✅':type==='error'?'❌':type==='warning'?'⚠️':'ℹ️'}</span> ${message}`;c.appendChild(t);setTimeout(()=>{t.style.animation='slideInRight 0.3s ease reverse';setTimeout(()=>t.remove(),300);},4000); }
document.addEventListener('keydown', e => { if (e.key==='Escape') { fermerModalModifierEmploye(); fermerModalDetailClient(); } });
console.log('⚙️ Admin V16.0 prêt');
