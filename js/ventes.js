/* =============================================
   FASO TEEDO - SCRIPTS VENTES V6.1
   AVEC SYSTÈME DE LOT DE 3 - PRIX STANDARD = PRIX DU PRODUIT
   ============================================= */

'use strict';

let stockVenteActuel = [];
let clientsListe = [];
let clientSelectionne = null;
let panierPassage = [];
let panierFidele = [];
let modePaiementPassage = 'espece';
let modePaiementFidele = 'espece';
let totalGlobalActuel = 0;
let prixLotActif = false;
let prixLot = 5000; // Prix fixe pour un lot de 3

// ✅ Produits disponibles
let produitsDisponibles = [
    { value: 'caramel_simple', label: 'Caramel Simple' },
    { value: 'caramel_gingembre', label: 'Caramel Gingembre' },
    { value: 'morceaux', label: 'Morceaux (Casée) - kg' },
    { value: 'farine_kilo', label: 'Farine (Kilo)' }
];

document.addEventListener('DOMContentLoaded', async function() {
    try { await initialiserVentes(); } catch(e) { console.error('Erreur globale:', e); }
});

// ==========================================
// INITIALISATION
// ==========================================
async function initialiserVentes() {
    try {
        await chargerStockVente();
        await chargerClients();
        
        initialiserModeSelector();
        initialiserRechercheClient();
        initialiserFormulairePassage();
        initialiserFormulaireFidele();
        initialiserNouveauClient();
        await chargerHistoriqueVentes();
        console.log('✅ Ventes V6.1 initialisé');
    } catch (error) {
        console.error('❌ Erreur:', error);
        afficherToast('Erreur de chargement', 'error');
    }
}

// ==========================================
// STOCK VENTE
// ==========================================
async function chargerStockVente() {
    try {
        stockVenteActuel = await getStockVente();
        console.log('📦 Stock vente chargé:', stockVenteActuel.length, 'produits');
        afficherBandeauStock();
        remplirSelecteursProduits();
    } catch(e) {
        console.error('❌ Erreur chargement stock vente:', e);
        stockVenteActuel = [
            { type_produit: 'caramel_simple', quantite: 0, prix_unitaire: 100 },
            { type_produit: 'caramel_gingembre', quantite: 0, prix_unitaire: 100 },
            { type_produit: 'morceaux', quantite: 0, prix_unitaire: 500 },
            { type_produit: 'farine_kilo', quantite: 0, prix_unitaire: 1000 }
        ];
        afficherBandeauStock();
        remplirSelecteursProduits();
    }
}

function remplirSelecteursProduits() {
    const selects = ['passageProduit', 'fideleProduit'];
    selects.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        select.innerHTML = '<option value="">Sélectionnez</option>';
        produitsDisponibles.forEach(p => {
            const stock = getQuantiteStock(p.value);
            const unite = p.value === 'morceaux' ? 'kg' : 'u.';
            const label = stock > 0 ? `${p.label} (${stock} ${unite} dispo)` : `${p.label} (⚠️ rupture)`;
            select.innerHTML += `<option value="${p.value}">${label}</option>`;
        });
    });
}

function afficherBandeauStock() {
    const noms = {
        caramel_simple: 'stockCaramelSimple',
        caramel_gingembre: 'stockCaramelGingembre',
        morceaux: 'stockMorceaux',
        farine_kilo: 'stockFarineKilo'
    };
    if (!stockVenteActuel || stockVenteActuel.length === 0) {
        document.getElementById('stockCaramelSimple').textContent = '0 u.';
        document.getElementById('stockCaramelGingembre').textContent = '0 u.';
        document.getElementById('stockMorceaux').textContent = '0 kg';
        document.getElementById('stockFarineKilo').textContent = '0 kg';
        return;
    }
    stockVenteActuel.forEach(item => {
        const el = document.getElementById(noms[item.type_produit]);
        if (el) {
            const unite = item.type_produit === 'morceaux' ? 'kg' : 'u.';
            el.textContent = parseFloat(item.quantite).toFixed(1) + ' ' + unite;
        }
    });
}

// ✅ Le prix standard est celui du produit dans stock_vente
function getPrixStandard(typeProduit) {
    if (!stockVenteActuel || stockVenteActuel.length === 0) return 0;
    const p = stockVenteActuel.find(item => item.type_produit === typeProduit);
    return p ? Math.round(parseFloat(p.prix_unitaire) || 0) : 0;
}

function getQuantiteStock(typeProduit) {
    if (!stockVenteActuel || stockVenteActuel.length === 0) return 0;
    const p = stockVenteActuel.find(item => item.type_produit === typeProduit);
    return p ? parseFloat(p.quantite) || 0 : 0;
}

// ==========================================
// CALCUL AVEC LOT DE 3
// ==========================================
function calculerPrixAvecLot(quantite, prixUnitaire, appliquerLot) {
    if (!appliquerLot) {
        return Math.round(quantite * prixUnitaire);
    }
    
    const lotsComplets = Math.floor(quantite / 3);
    const reste = quantite % 3;
    const total = (lotsComplets * prixLot) + (reste * prixUnitaire);
    return Math.round(total);
}

function getDetailsLot(quantite, prixUnitaire, appliquerLot) {
    if (!appliquerLot) {
        return {
            total: Math.round(quantite * prixUnitaire),
            details: `${quantite} × ${prixUnitaire} F = ${Math.round(quantite * prixUnitaire).toLocaleString('fr-FR')} F`
        };
    }
    
    const lotsComplets = Math.floor(quantite / 3);
    const reste = quantite % 3;
    const total = (lotsComplets * prixLot) + (reste * prixUnitaire);
    
    let details = '';
    if (lotsComplets > 0) {
        details += `${lotsComplets} lot(s) de 3 × ${prixLot} F = ${(lotsComplets * prixLot).toLocaleString('fr-FR')} F`;
    }
    if (reste > 0) {
        if (lotsComplets > 0) details += ' + ';
        details += `${reste} × ${prixUnitaire} F = ${(reste * prixUnitaire).toLocaleString('fr-FR')} F`;
    }
    
    return {
        total: total,
        details: details || '0 F'
    };
}

// ==========================================
// CLIENTS
// ==========================================
async function chargerClients() {
    try {
        clientsListe = await getClients(true);
        console.log('👤 Clients chargés:', clientsListe.length);
    } catch(e) {
        console.error('❌ Erreur chargement clients:', e);
        clientsListe = [];
    }
}

async function rechercherClients(term) {
    if (!term || term.length < 1) {
        document.getElementById('resultatsRecherche').classList.remove('active');
        return;
    }
    try {
        const results = await searchClients(term);
        const container = document.getElementById('resultatsRecherche');
        container.innerHTML = '';
        if (!results || results.length === 0) {
            container.innerHTML = '<div class="resultat-item" style="color:#999;">Aucun client trouvé</div>';
            container.classList.add('active');
            return;
        }
        results.forEach(client => {
            const div = document.createElement('div');
            div.className = 'resultat-item';
            div.textContent = client.nom + (client.telephone ? ' - ' + client.telephone : '');
            div.addEventListener('click', () => selectionnerClient(client));
            container.appendChild(div);
        });
        container.classList.add('active');
    } catch(e) {
        console.warn('⚠️ Erreur recherche clients:', e);
    }
}

function selectionnerClient(client) {
    clientSelectionne = client;
    document.getElementById('resultatsRecherche').classList.remove('active');
    document.getElementById('rechercheClient').value = client.nom;
    document.getElementById('clientSelectionneNom').textContent = '⭐ ' + client.nom;
    document.getElementById('clientSelectionneInfo').classList.remove('hidden');
    document.getElementById('formFideleSection').style.display = 'block';
    afficherToast(`✅ Client sélectionné: ${client.nom}`, 'success');
    mettreAJourPrixFidele();
}

function deselectionnerClient() {
    clientSelectionne = null;
    document.getElementById('rechercheClient').value = '';
    document.getElementById('clientSelectionneInfo').classList.add('hidden');
    document.getElementById('formFideleSection').style.display = 'none';
    panierFidele = [];
    afficherPanierFidele();
}

// ==========================================
// MODE SELECTOR
// ==========================================
function initialiserModeSelector() {
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.mode-content').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            const mode = this.getAttribute('data-mode');
            const target = document.getElementById('mode' + mode.charAt(0).toUpperCase() + mode.slice(1));
            if (target) target.classList.add('active');
            
            if (mode === 'fidele') {
                if (clientSelectionne) {
                    document.getElementById('formFideleSection').style.display = 'block';
                } else {
                    document.getElementById('formFideleSection').style.display = 'none';
                    afficherToast('💡 Sélectionnez un client dans la recherche ci-dessus', 'info');
                }
            }
        });
    });
}

// ==========================================
// FORMULAIRE PASSAGE
// ==========================================
function initialiserFormulairePassage() {
    const select = document.getElementById('passageProduit');
    if (select) {
        select.addEventListener('change', function() {
            // ✅ Le prix standard = prix du produit dans stock_vente
            const prix = getPrixStandard(this.value);
            document.getElementById('passagePrixUnitaire').value = prix;
            calculerTotalLignePassage();
        });
    }
    
    document.getElementById('passageQuantite').addEventListener('input', calculerTotalLignePassage);
    document.getElementById('passagePrixUnitaire').addEventListener('input', calculerTotalLignePassage);
    
    // ✅ Option lot de 3
    document.getElementById('passageOptionLot').addEventListener('change', function() {
        prixLotActif = this.checked;
        calculerTotalLignePassage();
    });
    
    document.getElementById('btnAjouterPanierPassage').addEventListener('click', ajouterAuPanierPassage);
    document.getElementById('btnValiderPanierPassage').addEventListener('click', validerPanierPassage);
    
    document.getElementById('passageArgentRecu').addEventListener('input', calculerMonnaiePassage);
    document.getElementById('passageEspeceCombine').addEventListener('input', calculerMonnaieCombinePassage);
    document.getElementById('passageOrangeCombine').addEventListener('input', calculerMonnaieCombinePassage);
    
    document.getElementById('passageOrangeRecu').addEventListener('focus', function() {
        const total = totalGlobalActuel || parseInt(document.getElementById('montantTotalPassage').textContent.replace(/\s/g, '')) || 0;
        if (total > 0 && !this.value) {
            this.value = total;
            calculerMonnaiePassage();
        }
    });
}

function calculerTotalLignePassage() {
    const qte = parseFloat(document.getElementById('passageQuantite').value) || 0;
    const produit = document.getElementById('passageProduit').value;
    const prix = getPrixStandard(produit);
    const appliquerLot = document.getElementById('passageOptionLot').checked;
    
    // Mettre à jour le champ prix unitaire
    document.getElementById('passagePrixUnitaire').value = prix;
    
    const resultat = calculerPrixAvecLot(qte, prix, appliquerLot);
    const details = getDetailsLot(qte, prix, appliquerLot);
    
    document.getElementById('passageTotalLigne').textContent = `Total ligne : ${resultat.toLocaleString('fr-FR')} FCFA`;
    
    // Afficher les détails du lot
    const detailLot = document.getElementById('passageDetailLot');
    if (detailLot) {
        if (appliquerLot && qte >= 3) {
            detailLot.textContent = `📦 ${details.details}`;
            detailLot.style.display = 'block';
            detailLot.style.color = '#666';
        } else if (appliquerLot && qte > 0 && qte < 3) {
            detailLot.textContent = `⚠️ Moins de 3 unités, pas de lot appliqué`;
            detailLot.style.display = 'block';
            detailLot.style.color = '#e67e22';
        } else {
            detailLot.style.display = 'none';
        }
    }
}

function ajouterAuPanierPassage() {
    const produit = document.getElementById('passageProduit').value;
    const qte = parseFloat(document.getElementById('passageQuantite').value) || 0;
    const prix = getPrixStandard(produit);
    const appliquerLot = document.getElementById('passageOptionLot').checked;
    
    if (!produit) { afficherToast('Sélectionnez un produit', 'warning'); return; }
    if (qte <= 0) { afficherToast('Quantité invalide', 'warning'); return; }
    if (prix <= 0) { afficherToast('Prix invalide', 'warning'); return; }
    
    const stockDispo = getQuantiteStock(produit);
    if (stockDispo < qte) {
        afficherToast(`Stock insuffisant (${stockDispo} disponibles)`, 'error');
        return;
    }
    
    const nomProduit = produitsDisponibles.find(p => p.value === produit)?.label || produit;
    const total = calculerPrixAvecLot(qte, prix, appliquerLot);
    
    panierPassage.push({
        type_produit: produit,
        nom: nomProduit,
        quantite: qte,
        prix_unitaire: prix,
        total: total,
        appliquerLot: appliquerLot,
        detailsLot: getDetailsLot(qte, prix, appliquerLot).details
    });
    
    afficherPanierPassage();
    document.getElementById('passageQuantite').value = '';
    document.getElementById('passageOptionLot').checked = false;
    prixLotActif = false;
    document.getElementById('passageTotalLigne').textContent = 'Total ligne : 0 FCFA';
    document.getElementById('passageDetailLot').style.display = 'none';
    afficherToast(`✅ ${nomProduit} ajouté au panier`, 'success');
}

function afficherPanierPassage() {
    const container = document.getElementById('contenuPanierPassage');
    const totalContainer = document.getElementById('panierTotalPassage');
    const totalSpan = document.getElementById('montantTotalPassage');
    
    if (panierPassage.length === 0) {
        container.innerHTML = '<div class="panier-vide">Panier vide</div>';
        totalContainer.classList.add('hidden');
        document.getElementById('validationPassage').classList.add('hidden');
        return;
    }
    
    let html = '';
    let totalGlobal = 0;
    panierPassage.forEach((item, index) => {
        totalGlobal += item.total;
        const unite = item.type_produit === 'morceaux' ? 'kg' : 'u.';
        const lotBadge = item.appliquerLot ? ' 🏷️ Lot 3' : '';
        html += `<div class="panier-item">
            <div>
                <span class="produit-nom">${item.nom}</span> × ${item.quantite} ${unite} @ ${item.prix_unitaire.toLocaleString('fr-FR')} F${lotBadge}
                ${item.appliquerLot ? `<br><small style="color:#666;font-size:0.75rem;">${item.detailsLot || ''}</small>` : ''}
            </div>
            <div class="produit-total">${item.total.toLocaleString('fr-FR')} FCFA</div>
            <button class="btn-supprimer" onclick="supprimerItemPanierPassage(${index})">✕</button>
        </div>`;
    });
    
    container.innerHTML = html;
    totalGlobalActuel = totalGlobal;
    totalSpan.textContent = totalGlobal.toLocaleString('fr-FR');
    totalContainer.classList.remove('hidden');
    document.getElementById('validationPassage').classList.remove('hidden');
    
    const orangeInput = document.getElementById('passageOrangeRecu');
    if (orangeInput && modePaiementPassage === 'orange') {
        orangeInput.value = totalGlobal;
    }
    
    calculerMonnaiePassage();
}

function supprimerItemPanierPassage(index) {
    panierPassage.splice(index, 1);
    afficherPanierPassage();
}

function changerModePaiementPassage(mode) {
    modePaiementPassage = mode;
    document.querySelectorAll('#paiementSelectorPassage .paiement-option').forEach(el => {
        el.classList.toggle('active', el.getAttribute('data-mode') === mode);
    });
    
    document.getElementById('argentRecuSectionPassage').style.display = mode === 'combine' ? 'none' : 'block';
    document.getElementById('combineSectionPassage').classList.toggle('hidden', mode !== 'combine');
    document.getElementById('orangeSectionPassage').classList.toggle('hidden', mode !== 'orange');
    
    if (mode === 'orange') {
        const total = totalGlobalActuel || parseInt(document.getElementById('montantTotalPassage').textContent.replace(/\s/g, '')) || 0;
        document.getElementById('passageOrangeRecu').value = total;
    }
    
    calculerMonnaiePassage();
}

function calculerMonnaiePassage() {
    const total = totalGlobalActuel || parseInt(document.getElementById('montantTotalPassage').textContent.replace(/\s/g, '')) || 0;
    
    if (modePaiementPassage === 'combine') {
        calculerMonnaieCombinePassage();
        return;
    }
    
    if (modePaiementPassage === 'orange') {
        const recu = parseFloat(document.getElementById('passageOrangeRecu').value) || 0;
        const monnaie = Math.max(0, recu - total);
        document.getElementById('passageMonnaie').textContent = `Monnaie : ${monnaie.toLocaleString('fr-FR')} FCFA`;
        return;
    }
    
    const recu = parseFloat(document.getElementById('passageArgentRecu').value) || 0;
    const monnaie = Math.max(0, recu - total);
    document.getElementById('passageMonnaie').textContent = `Monnaie : ${monnaie.toLocaleString('fr-FR')} FCFA`;
}

function calculerMonnaieCombinePassage() {
    const total = totalGlobalActuel || parseInt(document.getElementById('montantTotalPassage').textContent.replace(/\s/g, '')) || 0;
    const espece = parseFloat(document.getElementById('passageEspeceCombine').value) || 0;
    const orange = parseFloat(document.getElementById('passageOrangeCombine').value) || 0;
    const totalRecu = espece + orange;
    const monnaie = Math.max(0, totalRecu - total);
    document.getElementById('passageMonnaieCombine').textContent = `Monnaie : ${monnaie.toLocaleString('fr-FR')} FCFA`;
}

async function validerPanierPassage() {
    if (panierPassage.length === 0) { afficherToast('Panier vide', 'warning'); return; }
    
    const clientNom = document.getElementById('passageClientNom').value.trim();
    if (!clientNom) { afficherToast('Nom du client requis', 'warning'); return; }
    
    const caissier = document.getElementById('passageCaissier').value.trim();
    if (!caissier) { afficherToast('Nom du caissier requis', 'warning'); return; }
    
    const totalGlobal = panierPassage.reduce((sum, item) => sum + item.total, 0);
    let argentRecu = 0;
    let detailsPaiement = null;
    
    if (modePaiementPassage === 'combine') {
        const espece = parseFloat(document.getElementById('passageEspeceCombine').value) || 0;
        const orange = parseFloat(document.getElementById('passageOrangeCombine').value) || 0;
        argentRecu = espece + orange;
        if (argentRecu < totalGlobal) { afficherToast('Montant insuffisant', 'error'); return; }
        detailsPaiement = { espece, orange };
    } else if (modePaiementPassage === 'orange') {
        argentRecu = parseFloat(document.getElementById('passageOrangeRecu').value) || 0;
        if (argentRecu < totalGlobal) { afficherToast('Montant insuffisant', 'error'); return; }
    } else {
        argentRecu = parseFloat(document.getElementById('passageArgentRecu').value) || 0;
        if (argentRecu < totalGlobal) { afficherToast('Montant insuffisant', 'error'); return; }
    }
    
    const btn = document.getElementById('btnValiderPanierPassage');
    btn.disabled = true; btn.textContent = '⏳...';
    
    try {
        const numero = await getNumeroCommandeSupabase();
        const details = JSON.stringify(panierPassage);
        
        const cmd = {
            date_vente: new Date().toISOString(),
            type_produit: 'PANIER',
            client_nom: clientNom,
            quantite: panierPassage.reduce((s, i) => s + i.quantite, 0),
            prix_unitaire_applique: 0,
            total_vente: totalGlobal,
            argent_recu: argentRecu,
            caissier_nom: caissier,
            numero_commande: numero,
            details: details,
            mode_paiement: modePaiementPassage,
            details_paiement: detailsPaiement ? JSON.stringify(detailsPaiement) : null
        };
        
        const result = await addVente(cmd);
        if (result) {
            afficherToast(`✅ Vente #${numero} validée !`, 'success');
            await imprimerTicket(panierPassage, totalGlobal, clientNom, caissier, numero);
            panierPassage = [];
            afficherPanierPassage();
            document.getElementById('passageClientNom').value = '';
            document.getElementById('passageArgentRecu').value = '';
            document.getElementById('passageOrangeRecu').value = '';
            document.getElementById('passageCaissier').value = '';
            await chargerStockVente();
            await chargerHistoriqueVentes();
        } else {
            afficherToast('❌ Erreur lors de la validation', 'error');
        }
    } catch(e) {
        afficherToast('Erreur: ' + e.message, 'error');
    } finally {
        btn.disabled = false; btn.textContent = '✅ Valider et imprimer';
    }
}

// ==========================================
// FORMULAIRE FIDÈLE
// ==========================================
function initialiserFormulaireFidele() {
    const select = document.getElementById('fideleProduit');
    if (select) {
        select.addEventListener('change', function() {
            mettreAJourPrixFidele();
        });
    }
    
    document.getElementById('fideleQuantite').addEventListener('input', calculerTotalLigneFidele);
    
    document.getElementById('fideleOptionLot').addEventListener('change', function() {
        prixLotActif = this.checked;
        calculerTotalLigneFidele();
    });
    
    document.getElementById('btnAjouterPanierFidele').addEventListener('click', ajouterAuPanierFidele);
    document.getElementById('btnValiderPanierFidele').addEventListener('click', validerPanierFidele);
    
    document.getElementById('fideleArgentRecu').addEventListener('input', calculerMonnaieFidele);
    document.getElementById('fideleEspeceCombine').addEventListener('input', calculerMonnaieCombineFidele);
    document.getElementById('fideleOrangeCombine').addEventListener('input', calculerMonnaieCombineFidele);
    
    document.getElementById('fideleOrangeRecu').addEventListener('focus', function() {
        const total = totalGlobalActuel || parseInt(document.getElementById('montantTotalFidele').textContent.replace(/\s/g, '')) || 0;
        if (total > 0 && !this.value) {
            this.value = total;
            calculerMonnaieFidele();
        }
    });
}

async function mettreAJourPrixFidele() {
    const produit = document.getElementById('fideleProduit').value;
    if (!produit) {
        document.getElementById('fidelePrixApplique').value = '';
        return;
    }
    
    // ✅ Prix standard = prix du produit dans stock_vente
    let prix = getPrixStandard(produit);
    let prixFinal = prix;
    
    if (clientSelectionne) {
        try {
            const prixSpeciaux = await getClientPrix(clientSelectionne.id);
            const spec = prixSpeciaux.find(p => p.type_produit === produit);
            if (spec && spec.prix_unitaire) {
                prixFinal = spec.prix_unitaire;
                document.getElementById('fidelePrixApplique').value = prixFinal + ' F (⭐ Prix spécial)';
            } else {
                document.getElementById('fidelePrixApplique').value = prixFinal + ' F (Prix public)';
            }
        } catch(e) {
            document.getElementById('fidelePrixApplique').value = prixFinal + ' F';
        }
    } else {
        document.getElementById('fidelePrixApplique').value = prixFinal + ' F';
    }
    
    calculerTotalLigneFidele();
}

function calculerTotalLigneFidele() {
    const qte = parseFloat(document.getElementById('fideleQuantite').value) || 0;
    const produit = document.getElementById('fideleProduit').value;
    const prixText = document.getElementById('fidelePrixApplique').value;
    const prixMatch = prixText.match(/^(\d+)/);
    const prix = prixMatch ? parseInt(prixMatch[0]) : getPrixStandard(produit);
    const appliquerLot = document.getElementById('fideleOptionLot').checked;
    
    const resultat = calculerPrixAvecLot(qte, prix, appliquerLot);
    const details = getDetailsLot(qte, prix, appliquerLot);
    
    document.getElementById('fideleTotalLigne').textContent = `Total ligne : ${resultat.toLocaleString('fr-FR')} FCFA`;
    
    const detailLot = document.getElementById('fideleDetailLot');
    if (detailLot) {
        if (appliquerLot && qte >= 3) {
            detailLot.textContent = `📦 ${details.details}`;
            detailLot.style.display = 'block';
            detailLot.style.color = '#666';
        } else if (appliquerLot && qte > 0 && qte < 3) {
            detailLot.textContent = `⚠️ Moins de 3 unités, pas de lot appliqué`;
            detailLot.style.display = 'block';
            detailLot.style.color = '#e67e22';
        } else {
            detailLot.style.display = 'none';
        }
    }
}

function ajouterAuPanierFidele() {
    if (!clientSelectionne) { afficherToast('Sélectionnez un client', 'warning'); return; }
    
    const produit = document.getElementById('fideleProduit').value;
    const qte = parseFloat(document.getElementById('fideleQuantite').value) || 0;
    const prixText = document.getElementById('fidelePrixApplique').value;
    const prixMatch = prixText.match(/^(\d+)/);
    const prix = prixMatch ? parseInt(prixMatch[0]) : getPrixStandard(produit);
    const appliquerLot = document.getElementById('fideleOptionLot').checked;
    
    if (!produit) { afficherToast('Sélectionnez un produit', 'warning'); return; }
    if (qte <= 0) { afficherToast('Quantité invalide', 'warning'); return; }
    if (prix <= 0) { afficherToast('Prix invalide', 'warning'); return; }
    
    const stockDispo = getQuantiteStock(produit);
    if (stockDispo < qte) {
        afficherToast(`Stock insuffisant (${stockDispo} disponibles)`, 'error');
        return;
    }
    
    const nomProduit = produitsDisponibles.find(p => p.value === produit)?.label || produit;
    const total = calculerPrixAvecLot(qte, prix, appliquerLot);
    
    panierFidele.push({
        type_produit: produit,
        nom: nomProduit,
        quantite: qte,
        prix_unitaire: prix,
        total: total,
        appliquerLot: appliquerLot,
        detailsLot: getDetailsLot(qte, prix, appliquerLot).details
    });
    
    afficherPanierFidele();
    document.getElementById('fideleQuantite').value = '';
    document.getElementById('fideleOptionLot').checked = false;
    prixLotActif = false;
    document.getElementById('fideleTotalLigne').textContent = 'Total ligne : 0 FCFA';
    document.getElementById('fideleDetailLot').style.display = 'none';
    afficherToast(`✅ ${nomProduit} ajouté au panier`, 'success');
}

function afficherPanierFidele() {
    const container = document.getElementById('contenuPanierFidele');
    const totalContainer = document.getElementById('panierTotalFidele');
    const totalSpan = document.getElementById('montantTotalFidele');
    
    if (panierFidele.length === 0) {
        container.innerHTML = '<div class="panier-vide">Panier vide</div>';
        totalContainer.classList.add('hidden');
        document.getElementById('validationFidele').classList.add('hidden');
        return;
    }
    
    let html = '';
    let totalGlobal = 0;
    panierFidele.forEach((item, index) => {
        totalGlobal += item.total;
        const unite = item.type_produit === 'morceaux' ? 'kg' : 'u.';
        const lotBadge = item.appliquerLot ? ' 🏷️ Lot 3' : '';
        html += `<div class="panier-item">
            <div>
                <span class="produit-nom">${item.nom}</span> × ${item.quantite} ${unite} @ ${item.prix_unitaire.toLocaleString('fr-FR')} F${lotBadge}
                ${item.appliquerLot ? `<br><small style="color:#666;font-size:0.75rem;">${item.detailsLot || ''}</small>` : ''}
            </div>
            <div class="produit-total">${item.total.toLocaleString('fr-FR')} FCFA</div>
            <button class="btn-supprimer" onclick="supprimerItemPanierFidele(${index})">✕</button>
        </div>`;
    });
    
    container.innerHTML = html;
    totalGlobalActuel = totalGlobal;
    totalSpan.textContent = totalGlobal.toLocaleString('fr-FR');
    totalContainer.classList.remove('hidden');
    document.getElementById('validationFidele').classList.remove('hidden');
    
    const orangeInput = document.getElementById('fideleOrangeRecu');
    if (orangeInput && modePaiementFidele === 'orange') {
        orangeInput.value = totalGlobal;
    }
    
    calculerMonnaieFidele();
}

function supprimerItemPanierFidele(index) {
    panierFidele.splice(index, 1);
    afficherPanierFidele();
}

function changerModePaiementFidele(mode) {
    modePaiementFidele = mode;
    document.querySelectorAll('#paiementSelectorFidele .paiement-option').forEach(el => {
        el.classList.toggle('active', el.getAttribute('data-mode') === mode);
    });
    
    document.getElementById('argentRecuSectionFidele').style.display = mode === 'combine' ? 'none' : 'block';
    document.getElementById('combineSectionFidele').classList.toggle('hidden', mode !== 'combine');
    document.getElementById('orangeSectionFidele').classList.toggle('hidden', mode !== 'orange');
    
    if (mode === 'orange') {
        const total = totalGlobalActuel || parseInt(document.getElementById('montantTotalFidele').textContent.replace(/\s/g, '')) || 0;
        document.getElementById('fideleOrangeRecu').value = total;
    }
    
    calculerMonnaieFidele();
}

function calculerMonnaieFidele() {
    const total = totalGlobalActuel || parseInt(document.getElementById('montantTotalFidele').textContent.replace(/\s/g, '')) || 0;
    
    if (modePaiementFidele === 'combine') {
        calculerMonnaieCombineFidele();
        return;
    }
    
    if (modePaiementFidele === 'orange') {
        const recu = parseFloat(document.getElementById('fideleOrangeRecu').value) || 0;
        const monnaie = Math.max(0, recu - total);
        document.getElementById('fideleMonnaie').textContent = `Monnaie : ${monnaie.toLocaleString('fr-FR')} FCFA`;
        return;
    }
    
    const recu = parseFloat(document.getElementById('fideleArgentRecu').value) || 0;
    const monnaie = Math.max(0, recu - total);
    document.getElementById('fideleMonnaie').textContent = `Monnaie : ${monnaie.toLocaleString('fr-FR')} FCFA`;
}

function calculerMonnaieCombineFidele() {
    const total = totalGlobalActuel || parseInt(document.getElementById('montantTotalFidele').textContent.replace(/\s/g, '')) || 0;
    const espece = parseFloat(document.getElementById('fideleEspeceCombine').value) || 0;
    const orange = parseFloat(document.getElementById('fideleOrangeCombine').value) || 0;
    const totalRecu = espece + orange;
    const monnaie = Math.max(0, totalRecu - total);
    document.getElementById('fideleMonnaieCombine').textContent = `Monnaie : ${monnaie.toLocaleString('fr-FR')} FCFA`;
}

async function validerPanierFidele() {
    if (panierFidele.length === 0) { afficherToast('Panier vide', 'warning'); return; }
    if (!clientSelectionne) { afficherToast('Client non sélectionné', 'warning'); return; }
    
    const caissier = document.getElementById('fideleCaissier').value.trim();
    if (!caissier) { afficherToast('Nom du caissier requis', 'warning'); return; }
    
    const totalGlobal = panierFidele.reduce((sum, item) => sum + item.total, 0);
    let argentRecu = 0;
    let detailsPaiement = null;
    
    if (modePaiementFidele === 'combine') {
        const espece = parseFloat(document.getElementById('fideleEspeceCombine').value) || 0;
        const orange = parseFloat(document.getElementById('fideleOrangeCombine').value) || 0;
        argentRecu = espece + orange;
        if (argentRecu < totalGlobal) { afficherToast('Montant insuffisant', 'error'); return; }
        detailsPaiement = { espece, orange };
    } else if (modePaiementFidele === 'orange') {
        argentRecu = parseFloat(document.getElementById('fideleOrangeRecu').value) || 0;
        if (argentRecu < totalGlobal) { afficherToast('Montant insuffisant', 'error'); return; }
    } else {
        argentRecu = parseFloat(document.getElementById('fideleArgentRecu').value) || 0;
        if (argentRecu < totalGlobal) { afficherToast('Montant insuffisant', 'error'); return; }
    }
    
    const btn = document.getElementById('btnValiderPanierFidele');
    btn.disabled = true; btn.textContent = '⏳...';
    
    try {
        const numero = await getNumeroCommandeSupabase();
        const details = JSON.stringify(panierFidele);
        
        const cmd = {
            date_vente: new Date().toISOString(),
            type_produit: 'PANIER',
            client_id: clientSelectionne.id,
            client_nom: clientSelectionne.nom,
            quantite: panierFidele.reduce((s, i) => s + i.quantite, 0),
            prix_unitaire_applique: 0,
            total_vente: totalGlobal,
            argent_recu: argentRecu,
            caissier_nom: caissier,
            numero_commande: numero,
            details: details,
            mode_paiement: modePaiementFidele,
            details_paiement: detailsPaiement ? JSON.stringify(detailsPaiement) : null
        };
        
        const result = await addVente(cmd);
        if (result) {
            afficherToast(`✅ Vente #${numero} validée !`, 'success');
            await imprimerTicket(panierFidele, totalGlobal, clientSelectionne.nom, caissier, numero);
            panierFidele = [];
            afficherPanierFidele();
            document.getElementById('fideleCaissier').value = '';
            document.getElementById('fideleArgentRecu').value = '';
            document.getElementById('fideleOrangeRecu').value = '';
            await chargerStockVente();
            await chargerHistoriqueVentes();
        } else {
            afficherToast('❌ Erreur lors de la validation', 'error');
        }
    } catch(e) {
        afficherToast('Erreur: ' + e.message, 'error');
    } finally {
        btn.disabled = false; btn.textContent = '✅ Valider et imprimer';
    }
}

// ==========================================
// IMPRESSION TICKET
// ==========================================
async function imprimerTicket(panier, total, client, caissier, numero) {
    const config = await getConfig();
    const nomE = config.entreprise_nom || 'FASO TEEDO';
    const msg = config.ticket_message || 'Merci pour votre achat';
    const logo = config.logo_url || '';
    const footer = config.footer_text || '';
    
    let lignes = '';
    panier.forEach(item => {
        const unite = item.type_produit === 'morceaux' ? 'kg' : 'u.';
        const lotInfo = item.appliquerLot ? ` (Lot 3 - ${item.detailsLot || ''})` : '';
        lignes += `<p style="margin:2px 0;"><strong>${item.nom}:</strong> ${item.quantite} ${unite} × ${item.prix_unitaire.toLocaleString('fr-FR')} F${lotInfo}</p>
        <p style="text-align:right;margin:2px 0 8px;"><strong>${item.total.toLocaleString('fr-FR')} FCFA</strong></p>`;
    });
    
    const html = `<div style="font-family:'Courier New',monospace;max-width:350px;margin:20px auto;padding:20px;border:2px dashed #ccc;background:white;text-align:center;">
        ${logo ? `<div><img src="${logo}" style="max-height:60px;margin-bottom:10px;background:transparent;"></div>` : ''}
        <div style="border-bottom:1px dashed #000;padding-bottom:10px;margin-bottom:10px;">
            <h3 style="margin:0;">${nomE}</h3>
            <p style="margin:2px 0;">${new Date().toLocaleDateString('fr-FR')} - ${new Date().toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'})}</p>
            <p style="margin:2px 0;"><strong>Client: ${client}</strong></p>
            <p style="margin:2px 0;">#${numero}</p>
        </div>
        <div style="text-align:left;">${lignes}</div>
        <div style="border-top:1px dashed #000;padding-top:10px;margin-top:10px;">
            <p style="font-size:1.2rem;font-weight:bold;margin:4px 0;">TOTAL: ${total.toLocaleString('fr-FR')} FCFA</p>
            <p style="margin:4px 0;">${msg}</p>
            <p style="margin:4px 0;font-size:0.85rem;">Caissier: ${caissier}</p>
            ${footer ? `<p style="font-size:0.75rem;color:#666;margin:4px 0;">${footer}</p>` : ''}
        </div>
    </div>`;
    
    // Impression Bluetooth
    const texteImprimante = `${nomE}\n${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR')}\nClient: ${client}\n#${numero}\n--------------------------------\n`;
    let lignesBluetooth = '';
    panier.forEach(item => {
        const unite = item.type_produit === 'morceaux' ? 'kg' : 'u.';
        lignesBluetooth += `${item.nom}: ${item.quantite}${unite} × ${item.prix_unitaire} = ${item.total} FCFA\n`;
    });
    lignesBluetooth += `--------------------------------\nTOTAL: ${total} FCFA\n${msg}\nCaissier: ${caissier}\n${footer}\n`;
    
    const imprimerBluetooth = window.imprimerTicketBluetooth;
    if (imprimerBluetooth && typeof imprimerBluetooth === 'function') {
        try {
            await imprimerBluetooth(texteImprimante + lignesBluetooth);
        } catch(e) {}
    }
    
    const w = window.open('', '_blank', 'width=400,height=600');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ticket #${numero}</title>
        <style>body{font-family:'Courier New',monospace;padding:10px;}@media print{body{width:80mm;margin:0;padding:5px;}}
        p{margin:2px 0;}</style></head><body>${html}
        <script>
            setTimeout(function(){
                window.print();
                setTimeout(function(){ window.close(); }, 1000);
            }, 500);
        <\/script>
    </body></html>`);
    w.document.close();
}

// ==========================================
// RECHERCHE CLIENT
// ==========================================
function initialiserRechercheClient() {
    const input = document.getElementById('rechercheClient');
    let timeout = null;
    input.addEventListener('input', function() {
        clearTimeout(timeout);
        const term = this.value.trim();
        if (term.length < 1) {
            document.getElementById('resultatsRecherche').classList.remove('active');
            return;
        }
        timeout = setTimeout(() => rechercherClients(term), 300);
    });
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.recherche-client-container')) {
            document.getElementById('resultatsRecherche').classList.remove('active');
        }
    });
}

// ==========================================
// NOUVEAU CLIENT
// ==========================================
function initialiserNouveauClient() {
    document.getElementById('btnNouveauClient').addEventListener('click', function() {
        document.getElementById('modalNouveauClient').classList.remove('hidden');
    });
    document.getElementById('formNouveauClient').addEventListener('submit', async function(e) {
        e.preventDefault();
        await ajouterNouveauClient();
    });
}

function fermerModalNouveauClient() {
    document.getElementById('modalNouveauClient').classList.add('hidden');
}

async function ajouterNouveauClient() {
    const nom = document.getElementById('newClientNom').value.trim();
    if (!nom) { afficherToast('Nom requis', 'warning'); return; }
    
    const btn = document.querySelector('#formNouveauClient .btn-primaire');
    btn.disabled = true; btn.textContent = '⏳...';
    
    try {
        const client = await addClient(nom, document.getElementById('newClientTelephone').value.trim());
        if (client) {
            const prods = ['caramel_simple','caramel_gingembre','morceaux','farine_kilo'];
            const pfx = ['CaramelSimple','CaramelGingembre','Morceaux','FarineKilo'];
            for (let i = 0; i < 4; i++) {
                const pu = document.getElementById(`newPrix${pfx[i]}`).value;
                if (pu) {
                    await setClientPrix({
                        client_id: client.id,
                        type_produit: prods[i],
                        prix_unitaire: Math.round(parseFloat(pu))
                    });
                }
            }
            afficherToast(`✅ Client ${nom} ajouté`, 'success');
            fermerModalNouveauClient();
            document.getElementById('newClientNom').value = '';
            document.getElementById('newClientTelephone').value = '';
            pfx.forEach(p => document.getElementById(`newPrix${p}`).value = '');
            await chargerClients();
            selectionnerClient(client);
        } else {
            afficherToast('❌ Erreur lors de l\'ajout', 'error');
        }
    } catch(e) {
        afficherToast('Erreur: ' + e.message, 'error');
    } finally {
        btn.disabled = false; btn.textContent = 'Ajouter';
    }
}

// ==========================================
// HISTORIQUE VENTES
// ==========================================
async function chargerHistoriqueVentes() {
    const container = document.getElementById('historiqueVentes');
    if (!container) return;
    container.innerHTML = '<div class="loader"><div class="spinner"></div><span>Chargement...</span></div>';
    
    try {
        const ventes = await getVentesToday();
        if (!ventes || ventes.length === 0) {
            container.innerHTML = '<div class="etat-vide"><p>Aucune vente aujourd\'hui</p></div>';
            return;
        }
        
        let html = '<div class="table-container"><table><thead><tr><th>N°</th><th>Client</th><th>NB</th><th>Total</th><th>Reçu</th><th>Paiement</th><th>Heure</th></tr></thead><tbody>';
        ventes.slice(0, 20).forEach(v => {
            if (v.statut === 'annule') return;
            const d = new Date(v.date_vente);
            const numero = v.numero_commande || ('C' + String(v.id).padStart(4, '0'));
            const mp = (v.mode_paiement || 'espece') === 'orange' ? '📱 OM' : 
                       (v.mode_paiement === 'combine' ? '💵+📱' : '💵');
            
            let nbProduits = 0;
            if (v.details) {
                try {
                    const details = JSON.parse(v.details);
                    nbProduits = details.reduce((s, item) => s + (parseFloat(item.quantite) || 0), 0);
                } catch(e) {}
            }
            if (nbProduits === 0) {
                nbProduits = parseFloat(v.quantite) || 0;
            }
            
            const total = nbProduits;
            const recu = Math.round(parseFloat(v.total_vente)||0);
            
            html += `<tr>
                <td><strong>#${numero}</strong></td>
                <td>${v.client_nom || 'Client'}</td>
                <td>${nbProduits}</td>
                <td>${total}</td>
                <td><strong>${recu.toLocaleString('fr-FR')} FCFA</strong></td>
                <td>${mp}</td>
                <td>${d.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}</td>
            </tr>`;
        });
        html += '</tbody></table></div>';
        container.innerHTML = html;
    } catch(e) {
        console.warn('⚠️ Erreur historique ventes:', e);
        container.innerHTML = '<div class="etat-vide"><p>Impossible de charger l\'historique</p></div>';
    }
}

// ==========================================
// TOAST
// ==========================================
function afficherToast(message, type) {
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span> ${message}`;
    c.appendChild(t);
    setTimeout(() => {
        t.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => t.remove(), 300);
    }, 4000);
}

console.log('💰 Ventes V6.1 complet - Prix standard = prix du produit dans stock_vente');
