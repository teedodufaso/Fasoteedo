/* =============================================
   FASO TEEDO - SCRIPTS POINTAGE V8.1
   NOUVEAU SYSTÈME - Pointage par nombre de sacs
   CORRIGÉ - Bouton enregistrer fonctionnel
   ============================================= */

'use strict';

let employes = [];
let pointagesDuJour = [];
let configJournee = null;
let employesPointes = [];
let employesSelectionnes = [];
let signatureCanvas = null;
let signatureContext = null;
let signatureEnCours = false;
let signatureData = null;
let employeEnCours = null;

document.addEventListener('DOMContentLoaded', async function() {
    await initialiserPointage();
});

async function initialiserPointage() {
    try {
        initialiserOnglets();
        await chargerEmployes();
        await chargerConfigEtPointages();
        initialiserSignatureCanvas();
        initialiserBoutonReset();
        initialiserBoutonEnregistrer();
        console.log('✅ Pointage V8.1 initialisé');
    } catch (error) {
        console.error('❌ Erreur:', error);
        afficherToast('Erreur de chargement.', 'error');
    }
}

// ==========================================
// INITIALISATION BOUTON ENREGISTRER
// ==========================================
function initialiserBoutonEnregistrer() {
    const btn = document.getElementById('btnEnregistrerConfig');
    if (btn) {
        // Supprimer les anciens écouteurs
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            enregistrerConfiguration();
        });
        console.log('✅ Bouton enregistrer initialisé');
    }
}

// ==========================================
// ONGLETS
// ==========================================
function initialiserOnglets() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const onglet = this.getAttribute('data-onglet');
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content-pointage').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            document.getElementById(onglet).classList.add('active');
            if (onglet === 'onglet-signatures' && !configJournee) {
                afficherToast('⚠️ Configurez d\'abord la journée !', 'warning');
                document.querySelector('.tab-btn[data-onglet="onglet-config"]').click();
            }
            if (onglet === 'onglet-config') rafraichirVueConfig();
            if (onglet === 'onglet-signatures') {
                chargerListePointageSelection();
                afficherEmployes();
                afficherResumePointage();
            }
        });
    });
}

function initialiserBoutonReset() {
    const btn = document.getElementById('btnResetConfig');
    if (btn) {
        btn.addEventListener('click', async function() {
            if (!confirm('⚠️ Réinitialiser la configuration du jour ?\n\nLes pointages du jour seront également supprimés.')) return;
            if (!confirm('CONFIRMATION FINALE')) return;
            await resetConfigJournee();
            configJournee = null;
            document.getElementById('typeTravailTexte').textContent = 'NON CONFIGURÉ';
            document.getElementById('banniereTravail').classList.add('non-defini');
            document.getElementById('resumeConfig').style.display = 'none';
            document.getElementById('configInfo').style.display = 'none';
            document.getElementById('btnEnregistrerConfig').textContent = '✅ Enregistrer la configuration';
            document.querySelector('.tab-btn[data-onglet="onglet-config"]').click();
            viderFormulaireConfig();
            await chargerPointagesDuJour();
            afficherEmployes();
            afficherResumePointage();
            afficherToast('✅ Configuration réinitialisée', 'success');
        });
    }
}

function viderFormulaireConfig() {
    document.getElementById('configTypeTravail').value = '';
    document.getElementById('configTotalSacs').value = '';
    document.getElementById('listeEmployesConfig').innerHTML = '';
    document.getElementById('configInfo').style.display = 'none';
    document.getElementById('resumeConfig').style.display = 'none';
    document.getElementById('listePointage').innerHTML = '';
    document.getElementById('totalSacsPointes').textContent = '0';
    document.getElementById('totalSalaires').textContent = '0';
    document.getElementById('infoPrixParPersonne').textContent = '';
    const msg = document.getElementById('infoEmployesMsg');
    if (msg) msg.style.display = 'none';
}

// ==========================================
// CONFIG + POINTAGES
// ==========================================
async function chargerConfigEtPointages() {
    const today = getTodayDate();
    configJournee = await getConfigJournee(today);
    
    if (configJournee) {
        document.getElementById('typeTravailTexte').textContent = (configJournee.type_travail || 'fabrication').toUpperCase();
        document.getElementById('banniereTravail').classList.remove('non-defini');
        
        const resume = document.getElementById('resumeConfig');
        resume.style.display = 'block';
        const nbEmployes = configJournee.nb_employes || 0;
        const totalSacs = configJournee.total_sacs || 0;
        const prixParPers = configJournee.prix_par_personne || 0;
        
        resume.innerHTML = `👥 <strong>${nbEmployes}</strong> personnes | 📦 <strong>${totalSacs}</strong> sac(s) | 💰 <strong>${prixParPers.toLocaleString('fr-FR')}</strong> FCFA/personne`;
        
        document.getElementById('configInfo').style.display = 'block';
        document.getElementById('configInfoText').textContent = `Journée configurée : ${nbEmployes} personnes, ${totalSacs} sac(s)`;
        document.getElementById('btnEnregistrerConfig').textContent = '🔄 Mettre à jour';
        
        await chargerPointagesDuJour();
        chargerListePointageSelection();
        afficherEmployes();
        afficherResumePointage();
    } else {
        document.getElementById('typeTravailTexte').textContent = 'NON CONFIGURÉ';
        document.getElementById('banniereTravail').classList.add('non-defini');
        document.getElementById('resumeConfig').style.display = 'none';
        document.getElementById('configInfo').style.display = 'none';
        document.getElementById('btnEnregistrerConfig').textContent = '✅ Enregistrer la configuration';
    }
}

async function rafraichirVueConfig() {
    const tousEmployes = await getEmployes(true);
    if (configJournee) {
        document.getElementById('configTypeTravail').value = configJournee.type_travail || '';
        document.getElementById('configTotalSacs').value = configJournee.total_sacs || '';
    }
    chargerListeEmployesConfig(tousEmployes);
}

// ==========================================
// LISTES EMPLOYÉS
// ==========================================
async function chargerListeEmployesConfig(tousEmployesParam) {
    const container = document.getElementById('listeEmployesConfig');
    if (!container) return;
    const tousEmployes = tousEmployesParam || await getEmployes(true);
    if (tousEmployes.length === 0) { 
        container.innerHTML = '<p style="color:#999;">Aucun employé</p>'; 
        return; 
    }
    
    let html = '<p style="color:#666;margin-bottom:0.5rem;font-weight:600;">Sélectionnez les personnes présentes :</p>';
    tousEmployes.forEach(emp => {
        const checked = configJournee?.presents?.some(p => p.employe_id === emp.id) ? 'checked' : '';
        html += `<label style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem;border:1px solid #ddd;border-radius:8px;margin-bottom:0.25rem;cursor:pointer;">
            <input type="checkbox" class="cb-present" value="${emp.id}" data-nom="${emp.nom_complet.replace(/"/g,'&quot;')}" ${checked} onchange="verifierNbPersonnes()">
            <span>${emp.nom_complet}</span>
        </label>`;
    });
    container.innerHTML = html;
    verifierNbPersonnes();
}

function verifierNbPersonnes() {
    const nbSelected = document.querySelectorAll('.cb-present:checked').length;
    let msg = document.getElementById('infoEmployesMsg');
    if (!msg) {
        msg = document.createElement('p');
        msg.id = 'infoEmployesMsg';
        msg.style.cssText = 'font-size:0.85rem;margin-top:0.5rem;padding:0.5rem;border-radius:8px;border-left:3px solid;';
        const container = document.getElementById('listeEmployesConfig');
        if (container && container.parentNode) {
            container.parentNode.insertBefore(msg, container.nextSibling);
        }
    }
    if (msg) {
        if (nbSelected > 0) {
            msg.textContent = `👥 ${nbSelected} personne(s) sélectionnée(s)`;
            msg.style.display = 'block';
            msg.style.color = '#2980b9';
            msg.style.background = '#d6eaf8';
            msg.style.borderLeftColor = '#2980b9';
        } else {
            msg.textContent = '⚠️ Sélectionnez au moins une personne';
            msg.style.display = 'block';
            msg.style.color = '#e67e22';
            msg.style.background = '#fef9e7';
            msg.style.borderLeftColor = '#e67e22';
        }
    }
}

// ==========================================
// LISTE POINTAGE SÉLECTION
// ==========================================
function chargerListePointageSelection() {
    const container = document.getElementById('listePointageSelection');
    if (!container) return;
    
    let employesAAfficher = employes;
    if (configJournee && configJournee.presents) {
        const presentsIds = configJournee.presents.map(p => p.employe_id);
        if (presentsIds.length > 0) {
            employesAAfficher = employes.filter(e => presentsIds.includes(e.id));
        }
    }
    
    if (employesAAfficher.length === 0) {
        container.innerHTML = '<p style="color:#999;">Aucun employé disponible</p>';
        return;
    }
    
    let html = '';
    employesAAfficher.forEach(emp => {
        const dejaPointe = pointagesDuJour.some(p => p.employe_id === emp.id);
        const disabled = dejaPointe ? 'disabled' : '';
        const checked = employesSelectionnes.some(e => e.id === emp.id) ? 'checked' : '';
        html += `<label style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0.5rem;border-bottom:1px solid #f0f0f0;cursor:${dejaPointe ? 'not-allowed' : 'pointer'};opacity:${dejaPointe ? '0.5' : '1'};">
            <input type="checkbox" class="cb-pointage" value="${emp.id}" ${checked} ${disabled} onchange="toggleEmployeSelection(this)">
            <span>${emp.nom_complet}</span>
            ${dejaPointe ? '<span style="margin-left:auto;color:#27ae60;font-size:0.8rem;">✅ Pointé</span>' : ''}
        </label>`;
    });
    container.innerHTML = html;
    mettreAJourSelection();
}

function toggleEmployeSelection(checkbox) {
    const id = parseInt(checkbox.value);
    if (checkbox.checked) {
        const emp = employes.find(e => e.id === id);
        if (emp && !employesSelectionnes.find(e => e.id === id)) {
            employesSelectionnes.push(emp);
        }
    } else {
        employesSelectionnes = employesSelectionnes.filter(e => e.id !== id);
    }
    mettreAJourSelection();
}

function mettreAJourSelection() {
    const nb = employesSelectionnes.length;
    document.getElementById('nbSelectionnes').textContent = nb;
    document.getElementById('btnPointageGroupe').disabled = nb === 0;
    document.getElementById('btnAnnulerSelection').disabled = nb === 0;
}

function annulerSelection() {
    document.querySelectorAll('.cb-pointage:checked').forEach(cb => {
        if (!cb.disabled) cb.checked = false;
    });
    employesSelectionnes = [];
    mettreAJourSelection();
}

// ==========================================
// ENREGISTRER CONFIGURATION - CORRIGÉ
// ==========================================
async function enregistrerConfiguration() {
    console.log('🔍 Enregistrement de la configuration...');
    
    const typeTravail = document.getElementById('configTypeTravail').value;
    if (!typeTravail) { 
        afficherToast('Sélectionnez le type de travail', 'warning'); 
        console.log('❌ Type de travail manquant');
        return; 
    }
    
    const presents = [];
    document.querySelectorAll('.cb-present:checked').forEach(cb => {
        presents.push({ 
            employe_id: parseInt(cb.value), 
            employe_nom: cb.getAttribute('data-nom') 
        });
    });
    
    if (presents.length === 0) { 
        afficherToast('Sélectionnez au moins une personne présente', 'warning'); 
        console.log('❌ Aucun employé sélectionné');
        return; 
    }
    
    const totalSacs = parseFloat(document.getElementById('configTotalSacs').value) || 0;
    if (totalSacs <= 0) { 
        afficherToast('Entrez le nombre de sacs', 'warning'); 
        console.log('❌ Nombre de sacs invalide');
        return; 
    }
    
    // ✅ Calcul du prix par personne selon la grille
    console.log('📊 Calcul du prix par personne...');
    const grille = await getGrillePrix(typeTravail);
    const prixParPers = getPrixParPersonne(presents.length, grille);
    console.log(`👥 ${presents.length} personnes → ${prixParPers} FCFA/personne`);
    
    const config = {
        date: getTodayDate(),
        type_travail: typeTravail,
        nb_employes: presents.length,
        total_sacs: totalSacs,
        prix_par_personne: prixParPers,
        presents: presents,
        pointages: []
    };
    
    const btn = document.getElementById('btnEnregistrerConfig');
    btn.disabled = true; 
    btn.textContent = '⏳...';
    
    try {
        console.log('💾 Sauvegarde de la configuration...');
        const ok = await saveConfigJournee(config);
        if (ok) {
            configJournee = config;
            afficherToast('✅ Journée configurée !', 'success');
            console.log('✅ Configuration enregistrée avec succès');
            await chargerConfigEtPointages();
            document.querySelector('.tab-btn[data-onglet="onglet-signatures"]').click();
        } else {
            afficherToast('❌ Erreur lors de l\'enregistrement', 'error');
            console.log('❌ Erreur: saveConfigJournee a retourné false');
        }
    } catch(e) {
        afficherToast('Erreur: ' + e.message, 'error');
        console.error('❌ Exception:', e);
    } finally {
        btn.disabled = false;
        btn.textContent = '✅ Enregistrer la configuration';
    }
}

// ==========================================
// POINTAGE
// ==========================================
async function chargerEmployes() {
    try {
        employes = await getEmployes(true);
    } catch(e) {
        console.warn('⚠️ Erreur chargement employés:', e);
        employes = [];
    }
    const etatVide = document.getElementById('etatVide');
    if (employes.length === 0 && etatVide) etatVide.classList.remove('hidden');
    else if (etatVide) etatVide.classList.add('hidden');
}

async function chargerPointagesDuJour() {
    try {
        pointagesDuJour = await getPointagesToday();
    } catch(e) {
        console.warn('⚠️ Erreur chargement pointages:', e);
        pointagesDuJour = [];
    }
    const idsPointes = new Set(pointagesDuJour.map(p => p.employe_id));
    employes.forEach(e => { e.aPointe = idsPointes.has(e.id); });
    employes.forEach(e => {
        const p = pointagesDuJour.find(p => p.employe_id === e.id);
        e.salaire = p ? p.salaire_estime : 0;
        e.sacs_faits = p ? p.sacs_faits : 0;
    });
}

function afficherEmployes() {
    const grille = document.getElementById('grilleEmployes');
    if (!grille) return;
    grille.innerHTML = '';
    if (!employes || employes.length === 0) {
        document.getElementById('etatVide').classList.remove('hidden');
        return;
    }
    document.getElementById('etatVide').classList.add('hidden');
    
    let employesAAfficher = employes;
    if (configJournee && configJournee.presents) {
        const presentsIds = configJournee.presents.map(p => p.employe_id);
        if (presentsIds.length > 0) {
            employesAAfficher = employes.filter(e => presentsIds.includes(e.id));
        }
    }
    
    if (employesAAfficher.length === 0) {
        grille.innerHTML = '<div class="etat-vide"><p>Aucun employé à pointer aujourd\'hui</p></div>';
        return;
    }
    
    employesAAfficher.forEach(employe => {
        grille.appendChild(creerCarteEmploye(employe));
    });
}

function creerCarteEmploye(employe) {
    const carte = document.createElement('div');
    carte.className = `carte-employe ${employe.aPointe ? 'pointe' : ''}`;
    carte.dataset.employeId = employe.id;
    
    const photo = document.createElement('img');
    photo.className = 'photo-employe';
    photo.src = employe.photo_url || 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect fill="#e0e0e0" width="160" height="160" rx="80"/><circle cx="80" cy="55" r="25" fill="#999"/><ellipse cx="80" cy="135" rx="45" ry="35" fill="#999"/></svg>');
    
    const nom = document.createElement('div'); nom.className = 'nom-employe'; nom.textContent = employe.nom_complet;
    
    const info = document.createElement('div');
    if (employe.aPointe) {
        info.style.cssText = 'font-size:0.9rem;font-weight:700;color:#1a5632;margin-top:4px;';
        info.textContent = `${employe.sacs_faits || 0} sac(s) - ${(employe.salaire || 0).toLocaleString('fr-FR')} FCFA`;
    } else {
        info.style.cssText = 'font-size:0.85rem;color:#999;margin-top:4px;';
        info.textContent = '⏳ En attente de pointage';
    }
    
    const statut = document.createElement('span');
    statut.className = `statut-badge ${employe.aPointe ? 'fait' : 'attente'}`;
    statut.textContent = employe.aPointe ? '✓ Pointé' : '⏳ En attente';
    
    carte.appendChild(photo); carte.appendChild(nom); carte.appendChild(info); carte.appendChild(statut);
    
    if (!employe.aPointe) {
        carte.addEventListener('click', () => ouvrirPointageModal(employe));
        carte.style.cursor = 'pointer';
    }
    
    return carte;
}

// ==========================================
// MODAL POINTAGE INDIVIDUEL
// ==========================================
function ouvrirPointageModal(employe) {
    if (!configJournee) { afficherToast('⚠️ Configurez la journée', 'warning'); return; }
    if (employe.aPointe) { afficherToast('Déjà pointé', 'info'); return; }
    
    employeEnCours = employe;
    document.getElementById('pointageNomEmploye').textContent = employe.nom_complet;
    document.getElementById('pointagePhotoEmploye').src = employe.photo_url || '';
    document.getElementById('pointageSacs').value = '';
    document.getElementById('pointageSalaireEstime').textContent = '0 FCFA';
    document.getElementById('btnValiderPointage').disabled = false;
    document.getElementById('btnValiderPointage').textContent = '✅ Valider le pointage';
    
    const prix = configJournee.prix_par_personne || 0;
    document.getElementById('pointagePrixInfo').textContent = `💰 ${prix.toLocaleString('fr-FR')} FCFA par sac (${configJournee.nb_employes} personnes)`;
    
    document.getElementById('modalPointage').classList.remove('hidden');
    document.getElementById('pointageSacs').focus();
    
    // Supprimer l'ancien écouteur
    const input = document.getElementById('pointageSacs');
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    newInput.addEventListener('input', function() {
        const sacs = parseFloat(this.value) || 0;
        const salaire = sacs * (configJournee.prix_par_personne || 0);
        document.getElementById('pointageSalaireEstime').textContent = salaire.toLocaleString('fr-FR') + ' FCFA';
    });
}

function fermerPointageModal() {
    document.getElementById('modalPointage').classList.add('hidden');
    employeEnCours = null;
}

async function validerPointage() {
    if (!employeEnCours || !configJournee) return;
    
    const sacs = parseFloat(document.getElementById('pointageSacs').value) || 0;
    if (sacs < 0) { afficherToast('Nombre de sacs invalide', 'warning'); return; }
    
    const salaire = sacs * (configJournee.prix_par_personne || 0);
    
    const btn = document.getElementById('btnValiderPointage');
    btn.disabled = true; btn.textContent = '⏳...';
    
    try {
        const data = {
            employe_id: employeEnCours.id,
            date: getTodayDate(),
            type_travail: configJournee.type_travail || 'fabrication',
            signature_data: null,
            salaire_estime: Math.round(salaire),
            sacs_faits: sacs,
            paye: false,
            statut: 'present'
        };
        
        const result = await addPointageDirect(data);
        if (result) {
            afficherToast(`✅ ${employeEnCours.nom_complet} pointé ! ${sacs} sac(s) → ${Math.round(salaire).toLocaleString('fr-FR')} FCFA`, 'success');
            fermerPointageModal();
            await chargerPointagesDuJour();
            chargerListePointageSelection();
            afficherEmployes();
            afficherResumePointage();
        } else {
            afficherToast('❌ Erreur lors du pointage', 'error');
        }
    } catch(e) {
        afficherToast('Erreur: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '✅ Valider le pointage';
    }
}

// ==========================================
// POINTAGE EN GROUPE
// ==========================================
function ouvrirPointageGroupe() {
    if (employesSelectionnes.length === 0) { afficherToast('Sélectionnez des employés', 'warning'); return; }
    
    const noms = employesSelectionnes.map(e => e.nom_complet).join(', ');
    document.getElementById('pointageGroupeNoms').textContent = noms;
    document.getElementById('pointageGroupeSacs').value = '';
    document.getElementById('pointageGroupeSalaireEstime').textContent = '0 FCFA';
    document.getElementById('btnValiderGroupe').disabled = false;
    
    document.getElementById('modalPointageGroupe').classList.remove('hidden');
    
    const input = document.getElementById('pointageGroupeSacs');
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    newInput.addEventListener('input', function() {
        const sacs = parseFloat(this.value) || 0;
        const salaire = sacs * (configJournee.prix_par_personne || 0);
        document.getElementById('pointageGroupeSalaireEstime').textContent = salaire.toLocaleString('fr-FR') + ' FCFA par personne';
    });
}

function fermerPointageGroupe() {
    document.getElementById('modalPointageGroupe').classList.add('hidden');
}

async function validerPointageGroupe() {
    if (employesSelectionnes.length === 0) { afficherToast('Aucun employé sélectionné', 'warning'); return; }
    
    const sacs = parseFloat(document.getElementById('pointageGroupeSacs').value) || 0;
    if (sacs < 0) { afficherToast('Nombre de sacs invalide', 'warning'); return; }
    
    const salaire = sacs * (configJournee.prix_par_personne || 0);
    
    const btn = document.getElementById('btnValiderGroupe');
    btn.disabled = true; btn.textContent = '⏳...';
    
    try {
        let success = 0;
        for (const emp of employesSelectionnes) {
            const data = {
                employe_id: emp.id,
                date: getTodayDate(),
                type_travail: configJournee.type_travail || 'fabrication',
                signature_data: null,
                salaire_estime: Math.round(salaire),
                sacs_faits: sacs,
                paye: false,
                statut: 'present'
            };
            const result = await addPointageDirect(data);
            if (result) success++;
        }
        
        if (success > 0) {
            afficherToast(`✅ ${success} employé(s) pointés ! ${sacs} sac(s) → ${Math.round(salaire).toLocaleString('fr-FR')} FCFA chacun`, 'success');
            fermerPointageGroupe();
            annulerSelection();
            await chargerPointagesDuJour();
            chargerListePointageSelection();
            afficherEmployes();
            afficherResumePointage();
        } else {
            afficherToast('❌ Erreur lors du pointage', 'error');
        }
    } catch(e) {
        afficherToast('Erreur: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '✅ Valider';
    }
}

// ==========================================
// RÉSUMÉ DU POINTAGE
// ==========================================
function afficherResumePointage() {
    const container = document.getElementById('listePointage');
    if (!container) return;
    
    const pointes = pointagesDuJour || [];
    if (pointes.length === 0) {
        container.innerHTML = '<div class="etat-vide"><p>Aucun pointage enregistré</p></div>';
        document.getElementById('totalSacsPointes').textContent = '0';
        document.getElementById('totalSalaires').textContent = '0';
        return;
    }
    
    let html = '<div class="table-container"><table><thead><tr><th>Employé</th><th>Sacs</th><th>Salaire</th><th>Statut</th></tr></thead><tbody>';
    let totalSacs = 0;
    let totalSalaires = 0;
    
    pointes.forEach(p => {
        const emp = employes.find(e => e.id === p.employe_id);
        const nom = emp ? emp.nom_complet : 'Employé #' + p.employe_id;
        const sacs = p.sacs_faits || 0;
        const salaire = p.salaire_estime || 0;
        totalSacs += sacs;
        totalSalaires += salaire;
        html += `<tr>
            <td><strong>${nom}</strong></td>
            <td>${sacs}</td>
            <td><strong>${salaire.toLocaleString('fr-FR')} FCFA</strong></td>
            <td><span class="badge badge-success">✅ Pointé</span></td>
        </tr>`;
    });
    
    html += `<tr style="background:#f0f7f3;font-weight:bold;">
        <td>TOTAL</td>
        <td><strong>${totalSacs}</strong> / ${configJournee ? configJournee.total_sacs : '?'}</td>
        <td><strong>${totalSalaires.toLocaleString('fr-FR')} FCFA</strong></td>
        <td></td>
    </tr>`;
    html += '</tbody></table></div>';
    
    container.innerHTML = html;
    document.getElementById('totalSacsPointes').textContent = totalSacs;
    document.getElementById('totalSalaires').textContent = totalSalaires.toLocaleString('fr-FR');
}

// ==========================================
// SIGNATURE (conservé)
// ==========================================
function initialiserSignatureCanvas() {
    signatureCanvas = document.getElementById('signatureCanvas');
    if (!signatureCanvas) return;
    signatureContext = signatureCanvas.getContext('2d');
    signatureCanvas.addEventListener('mousedown', debuterSignature);
    signatureCanvas.addEventListener('mousemove', dessinerSignature);
    signatureCanvas.addEventListener('mouseup', terminerSignature);
    signatureCanvas.addEventListener('mouseleave', terminerSignature);
    signatureCanvas.addEventListener('touchstart', e => { e.preventDefault(); const t = e.touches[0]; signatureCanvas.dispatchEvent(new MouseEvent('mousedown', { clientX: t.clientX, clientY: t.clientY })); }, { passive: false });
    signatureCanvas.addEventListener('touchmove', e => { e.preventDefault(); const t = e.touches[0]; signatureCanvas.dispatchEvent(new MouseEvent('mousemove', { clientX: t.clientX, clientY: t.clientY })); }, { passive: false });
    signatureCanvas.addEventListener('touchend', e => { e.preventDefault(); signatureCanvas.dispatchEvent(new MouseEvent('mouseup', {})); }, { passive: false });
}

function redimensionnerCanvas() {
    if (!signatureCanvas) return;
    const c = signatureCanvas.parentElement;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const w = Math.min(r.width-6, 500), h = Math.min(250, innerHeight*0.4);
    signatureCanvas.width = w*2; signatureCanvas.height = h*2;
    signatureCanvas.style.width = w+'px'; signatureCanvas.style.height = h+'px';
    signatureContext = signatureCanvas.getContext('2d');
    signatureContext.scale(2,2);
    signatureContext.strokeStyle = '#000';
    signatureContext.lineWidth = 2.5;
    signatureContext.lineCap = 'round';
    signatureContext.lineJoin = 'round';
}

function debuterSignature(e) { signatureEnCours = true; const r = signatureCanvas.getBoundingClientRect(); signatureContext.beginPath(); signatureContext.moveTo(e.clientX-r.left, e.clientY-r.top); }
function dessinerSignature(e) { if (!signatureEnCours) return; const r = signatureCanvas.getBoundingClientRect(); signatureContext.lineTo(e.clientX-r.left, e.clientY-r.top); signatureContext.stroke(); }
function terminerSignature() { if (!signatureEnCours) return; signatureEnCours = false; signatureContext.closePath(); if (signatureCanvas) signatureData = signatureCanvas.toDataURL('image/png'); }
function effacerSignature() { if (!signatureCanvas||!signatureContext) return; signatureContext.clearRect(0,0,signatureCanvas.width/2,signatureCanvas.height/2); signatureData = null; signatureEnCours = false; }

// ==========================================
// TOAST
// ==========================================
function afficherToast(message, type) {
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<span>${type==='success'?'✅':type==='error'?'❌':type==='warning'?'⚠️':'ℹ️'}</span> ${message}`;
    c.appendChild(t);
    setTimeout(()=>{t.style.animation='slideInRight 0.3s ease reverse';setTimeout(()=>t.remove(),300);},4000);
}

document.addEventListener('keydown', e => {
    if (e.key==='Escape') {
        if (document.getElementById('modalPointage') && !document.getElementById('modalPointage').classList.contains('hidden')) fermerPointageModal();
        if (document.getElementById('modalPointageGroupe') && !document.getElementById('modalPointageGroupe').classList.contains('hidden')) fermerPointageGroupe();
    }
});

console.log('📋 Pointage V8.1 prêt - CORRIGÉ');
