# SSO Authentication System

Un système d'authentification Single Sign-On (SSO) professionnel avec gestion de crédits et réseau d'affiliés, construit avec Node.js, Express et MongoDB.

## ✨ Fonctionnalités

- ✅ **SSO (Single Sign-On)** - Authentification unique pour toutes les applications
- 👥 **Gestion des utilisateurs** - Création, modification, suppression
- 💰 **Système de crédits** - Solde, transferts, historique
- 🤝 **Réseau d'affiliés** - Parrainage, commissions
- 🌍 **Multi-pays** - Gestion par pays et ville
- 🔐 **Sécurité renforcée** - JWT, rate limiting, Helmet, CORS
- 📊 **Administration** - Dashboard et statistiques
- 🔌 **API RESTful** - Documentation Swagger complète
- 🐳 **Docker support** - Déploiement facile
- 📡 **Webhooks** - Événements en temps réel
- 🔄 **OAuth2** - Support des applications tierces

## 🚀 Installation Rapide

### Option 1: Avec Docker (Recommandé)

```bash
# Cloner le projet
git clone <repository-url>
cd sso-auth-system

# Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos valeurs

# Démarrer avec Docker Compose
docker-compose up -d
