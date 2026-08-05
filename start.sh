#!/bin/bash

echo "========================================="
echo "   🏭 FASO TEEDO - Démarrage"
echo "========================================="
echo ""
echo "📍 Serveur en cours de lancement..."
echo "📍 Adresse : http://localhost:8080"
echo ""
echo "Appuyez sur Ctrl+C pour arrêter"
echo "========================================="

cd ~/faso_teedo
python3 -m http.server 8080
