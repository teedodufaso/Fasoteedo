/* =============================================
   FASO TEEDO - TABLEAU DE BORD
   Version 2.0 - Graphiques et statistiques
   ============================================= */

'use strict';

let periodeActuelle = 'today';
let chartEvolution = null;
let toutesVentes = [];
let tousAchats = [];
let stockInventaireComplet = [];
let dateDebutActive = '';
let dateFinActive = '';

document.addEventListener('DOMContentLoaded', async function() {
    await initialiserDashboard();
});

async function initialiserDashboard() {
    try {
        initialiserSelecteursPeriode();
        initialiserFiltreDates();
        await chargerDonneesPeriode('today');
        console.log('✅ Dashboard initialisé');
    } catch (error) { console.error('❌ Erreur:', error); }
}

function initialiserSelecteursPeriode() {
    document.querySelectorAll('.periode-btn').forEach(bouton => {
        bouton.addEventListener('click', async function() {
            document.querySelectorAll('.periode-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            periodeActuelle = this.getAttribute('data-periode');
            document.getElementById('filtreDateDebutDash').value = '';
            document.getElementById('filtreDateFinDash').value = '';
            dateDebutActive = ''; dateFinActive = '';
            await chargerDonneesPeriode(periodeActuelle);
        });
    });
}

function initialiserFiltreDates() {
    document.getElementById('btnFiltrerDatesDash').addEventListener('click', async function() {
        const dd = document.getElementById('filtreDateDebutDash').value;
        const df = document.getElementById('filtreDateFinDash').value;
        if (!dd || !df) { afficherToast('Sélectionnez les deux dates', 'warning'); return; }
        document.querySelectorAll('.periode-btn').forEach(b => b.classList.remove('active'));
        periodeActuelle = 'custom'; dateDebutActive = dd; dateFinActive = df;
        await chargerDonneesPeriode('custom', dd, df);
    });
}

function getDatesPeriode(periode, ddc, dfc) {
    const m = new Date(); let dd, df;
    switch (periode) {
        case 'today': dd = formatDate(m); df = formatDate(m); break;
        case 'yesterday': const h = new Date(m); h.setDate(h.getDate()-1); dd = formatDate(h); df = dd; break;
        case 'week': dd = getWeekStart(); df = formatDate(m); break;
        case 'month': dd = getMonthStart(); df = formatDate(m); break;
        case 'year': dd = getYearStart(); df = formatDate(m); break;
        case 'custom': dd = ddc; df = dfc; break;
        default: dd = formatDate(m); df = formatDate(m);
    }
    return { dateDebut: dd, dateFin: df };
}

async function chargerDonneesPeriode(periode, ddc, dfc) {
    const { dateDebut, dateFin } = getDatesPeriode(periode, ddc, dfc);
    dateDebutActive = dateDebut; dateFinActive = dateFin;
    try {
        const [ventes, achats, inventaire] = await Promise.all([
            getVentesPeriode(dateDebut, dateFin),
            getAchatsPeriode(dateDebut, dateFin),
            getStockInventaire()
        ]);
        toutesVentes = ventes || [];
        tousAchats = achats || [];
        stockInventaireComplet = inventaire || [];
        mettreAJourStats();
        mettreAJourGraphique(dateDebut, dateFin);
        mettreAJourVentesParProduit();
        mettreAJourInventaireDetail();
        mettreAJourTopClients();
        mettreAJourDernieresVentes();
    } catch (error) { console.error('❌ Erreur:', error); }
}

function mettreAJourStats() {
    const totalVentes = toutesVentes.filter(v => v.statut !== 'annule').reduce((s, v) => s + Math.round(parseFloat(v.total_vente)||0), 0);
    const totalSalaires = tousAchats.filter(a => a.categorie === 'salaires').reduce((s, a) => s + Math.round(parseFloat(a.total_achat)||0), 0);
    const totalInventaire = stockInventaireComplet.reduce((s, p) => s + ((parseFloat(p.quantite)||0)*(parseFloat(p.prix_unitaire)||0)), 0);
    const difference = totalVentes - totalSalaires - totalInventaire;
    document.getElementById('statVentes').textContent = totalVentes.toLocaleString('fr-FR') + ' FCFA';
    document.getElementById('statSalaires').textContent = totalSalaires.toLocaleString('fr-FR') + ' FCFA';
    document.getElementById('statInventaire').textContent = Math.round(totalInventaire).toLocaleString('fr-FR') + ' FCFA';
    document.getElementById('statDifference').textContent = difference.toLocaleString('fr-FR') + ' FCFA';
    const carteDiff = document.getElementById('carteDifference');
    if (difference >= 0) { carteDiff.classList.remove('negatif'); document.getElementById('statDifference').style.color = '#2980b9'; }
    else { carteDiff.classList.add('negatif'); document.getElementById('statDifference').style.color = '#e74c3c'; }
}

function mettreAJourGraphique(dateDebut, dateFin) {
    const ctx = document.getElementById('chartEvolution'); if (!ctx) return;
    if (chartEvolution) { chartEvolution.destroy(); chartEvolution = null; }
    const ventesFiltrees = toutesVentes.filter(v => v.statut !== 'annule');
    if (ventesFiltrees.length === 0 && tousAchats.filter(a=>a.categorie==='salaires').length === 0) { ctx.style.display = 'none'; return; }
    ctx.style.display = 'block';
    const donneesParDate = {};
    let d = new Date(dateDebut + 'T00:00:00');
    const fin = new Date(dateFin + 'T23:59:59');
    while (d <= fin) { donneesParDate[formatDate(d)] = { ventes: 0, depenses: 0 }; d.setDate(d.getDate()+1); }
    ventesFiltrees.forEach(v => { const dv = formatDate(v.date_vente); if (donneesParDate[dv] !== undefined) donneesParDate[dv].ventes += Math.round(parseFloat(v.total_vente)||0); });
    tousAchats.forEach(a => { if (a.categorie==='salaires') { const da = formatDate(a.date_achat); if (donneesParDate[da]!==undefined) donneesParDate[da].depenses += Math.round(parseFloat(a.total_achat)||0); } });
    const totalInv = stockInventaireComplet.reduce((s,p)=>s+((parseFloat(p.quantite)||0)*(parseFloat(p.prix_unitaire)||0)),0);
    const datesArray = Object.keys(donneesParDate).sort();
    const invParJour = totalInv / (datesArray.length || 1);
    datesArray.forEach(date => { donneesParDate[date].depenses += invParJour; });
    const labels = datesArray.map(date => { const dd = new Date(date+'T12:00:00'); return dd.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}); });
    const ventesData = datesArray.map(date => Math.round(donneesParDate[date].ventes));
    const depensesData = datesArray.map(date => Math.round(donneesParDate[date].depenses));
    chartEvolution = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: '💰 Ventes', data: ventesData, borderColor: '#27ae60', backgroundColor: 'rgba(39,174,96,0.1)', borderWidth: 3, fill: true, tension: 0.4, pointRadius: 3 },
                { label: '💸 Dépenses', data: depensesData, borderColor: '#e74c3c', backgroundColor: 'rgba(231,76,60,0.1)', borderWidth: 3, fill: true, tension: 0.4, pointRadius: 3 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: true,
            interaction: { intersect: false, mode: 'index' },
            plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } } },
            scales: {
                y: { beginAtZero: true, ticks: { callback: v => v.toLocaleString('fr-FR')+' FCFA' } },
                x: { ticks: { maxRotation: 45 } }
            }
        }
    });
}

function mettreAJourVentesParProduit() {
    const container = document.getElementById('ventesParProduit'); if (!container) return;
    const noms = { caramel_simple:'Caramel Simple', caramel_gingembre:'Caramel Gingembre', morceaux:'Morceaux (Casée)', farine_kilo:'Farine (Kilo)' };
    const parProduit = {};
    toutesVentes.filter(v => v.statut !== 'annule').forEach(v => {
        if (v.details) { try { JSON.parse(v.details).forEach(item => { if (!parProduit[item.type_produit]) parProduit[item.type_produit] = { qte: 0, total: 0 }; parProduit[item.type_produit].qte += parseFloat(item.quantite)||0; parProduit[item.type_produit].total += Math.round(parseFloat(item.total)||0); }); } catch(e) {} }
        else { if (!parProduit[v.type_produit]) parProduit[v.type_produit] = { qte: 0, total: 0 }; parProduit[v.type_produit].qte += parseFloat(v.quantite)||0; parProduit[v.type_produit].total += Math.round(parseFloat(v.total_vente)||0); }
    });
    if (Object.keys(parProduit).length === 0) { container.innerHTML = '<p style="color:#999;">Aucune vente</p>'; return; }
    const max = Math.max(...Object.values(parProduit).map(v => v.total), 1);
    let html = '<ul class="detail-liste">';
    Object.entries(parProduit).forEach(([type, data]) => { html += `<li><div style="display:flex;justify-content:space-between;"><span>${noms[type]||type}</span><span style="color:#27ae60;font-weight:700;">${data.total.toLocaleString('fr-FR')} FCFA</span></div><small>Qté: ${data.qte}</small><div style="height:6px;background:#eee;border-radius:3px;margin-top:4px;"><div style="height:100%;background:#27ae60;border-radius:3px;width:${(data.total/max)*100}%;"></div></div></li>`; });
    html += '</ul>'; container.innerHTML = html;
}

function mettreAJourInventaireDetail() {
    const container = document.getElementById('inventaireDetail'); if (!container) return;
    if (stockInventaireComplet.length === 0) { container.innerHTML = '<p style="color:#999;">Stock vide</p>'; return; }
    const produits = stockInventaireComplet.map(p => ({ nom: p.nom_produit, unite: p.unite_mesure, qte: parseFloat(p.quantite)||0, prix: parseFloat(p.prix_unitaire)||0, total: (parseFloat(p.quantite)||0)*(parseFloat(p.prix_unitaire)||0) }));
    const max = Math.max(...produits.map(p => p.total), 1);
    let html = '<ul class="detail-liste">';
    produits.forEach(p => { html += `<li><div style="display:flex;justify-content:space-between;"><span>${p.nom}</span><span style="color:#f39c12;font-weight:700;">${Math.round(p.total).toLocaleString('fr-FR')} FCFA</span></div><small>${p.qte} ${p.unite} × ${Math.round(p.prix).toLocaleString('fr-FR')}</small></li>`; });
    html += '</ul>'; container.innerHTML = html;
}

function mettreAJourTopClients() {
    const container = document.getElementById('topClients'); if (!container) return;
    const clients = {};
    toutesVentes.filter(v => v.statut !== 'annule').forEach(v => { const nom = v.client_nom || 'Client passage'; const id = v.client_id || 'p_'+nom; if (!clients[id]) clients[id] = { nom, total: 0, nb: 0 }; clients[id].total += Math.round(parseFloat(v.total_vente)||0); clients[id].nb += 1; });
    const top = Object.values(clients).sort((a,b)=>b.total-a.total).slice(0,5);
    if (top.length === 0) { container.innerHTML = '<p style="color:#999;">Aucune vente</p>'; return; }
    let html = '<ul class="detail-liste">';
    top.forEach((c,i) => { html += `<li><div style="display:flex;justify-content:space-between;"><span>${i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1+'.')} ${c.nom}</span><span style="font-weight:700;">${c.total.toLocaleString('fr-FR')} FCFA</span></div><small>${c.nb} achat(s)</small></li>`; });
    html += '</ul>'; container.innerHTML = html;
}

function mettreAJourDernieresVentes() {
    const container = document.getElementById('dernieresVentes'); if (!container) return;
    const dernieres = [...toutesVentes].sort((a,b)=>new Date(b.date_vente)-new Date(a.date_vente)).slice(0,20);
    if (dernieres.length === 0) { container.innerHTML = '<p style="color:#999;">Aucune vente</p>'; return; }
    let html = '<div class="table-container"><table><thead><tr><th>N°</th><th>Date</th><th>Client</th><th>Total</th><th>Caissier</th></tr></thead><tbody>';
    dernieres.forEach(v => {
        const d = new Date(v.date_vente);
        const numero = v.numero_commande || ('C'+String(v.id).padStart(4,'0'));
        html += `<tr><td><strong>#${numero}</strong></td><td>${d.toLocaleDateString('fr-FR')}<br><small>${d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</small></td><td>${v.client_nom||'Client'}</td><td><strong>${Math.round(parseFloat(v.total_vente)||0).toLocaleString('fr-FR')} FCFA</strong></td><td>${v.caissier_nom}</td></tr>`;
    });
    html += '</tbody></table></div>'; container.innerHTML = html;
}

function afficherToast(m, t) { const c = document.getElementById('toastContainer'); if (!c) return; const d = document.createElement('div'); d.className = `toast toast-${t}`; d.innerHTML = `<span>${t==='success'?'✅':t==='error'?'❌':'⚠️'}</span> ${m}`; c.appendChild(d); setTimeout(() => { d.style.animation = 'slideInRight 0.3s ease reverse'; setTimeout(()=>d.remove(),300); }, 4000); }

console.log('📊 Dashboard prêt');
