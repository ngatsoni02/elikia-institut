# ISB Bibliothèque Numérique
## Institut Supérieur Biblique

Application de bureau professionnelle pour la gestion de la bibliothèque numérique.

---

## Fonctionnalités

### Bibliothèque de Documents
- Upload et gestion de livres (PDF, EPUB, DOC, DOCX, TXT, RTF)
- Catégorisation par thème biblique/théologique
- Recherche par titre, auteur ou tags
- Couvertures personnalisables
- Métadonnées complètes (ISBN, éditeur, année, langue)

### Vidéothèque de Cours
- Upload et lecture de vidéos (MP4, MKV, AVI, MOV, WebM)
- Organisation par année académique, semestre et cours
- Numérotation par épisodes
- Miniatures personnalisables
- Lecteur vidéo intégré avec reprise automatique

### Sessions Étudiantes
- Chaque étudiant a son propre compte avec progression sauvegardée
- Reprise automatique de la lecture (livres et vidéos)
- Système de favoris/signets
- Statistiques de progression personnelles

### Administration
- Gestion complète des utilisateurs (création, activation/désactivation, réinitialisation de mot de passe)
- Gestion des catégories de livres et de cours
- Upload facilité avec sélection de fichiers
- Tableau de bord avec statistiques globales

---

## Installation

### Prérequis
- Node.js 18+ installé sur l'ordinateur

### Étapes
```bash
# 1. Ouvrir un terminal dans le dossier du projet
cd isb-library

# 2. Installer les dépendances
npm install

# 3. Lancer l'application
npm start
```

---

## Connexion par défaut

| Rôle | Identifiant | Mot de passe |
|------|-------------|--------------|
| Administrateur | `admin` | `admin2024` |

> **Important** : Changez le mot de passe administrateur après la première connexion.

---

## Structure du Projet

```
isb-library/
├── main.js            # Processus principal Electron + Base de données
├── preload.js         # Pont sécurisé IPC
├── package.json       # Dépendances et scripts
├── src/
│   ├── index.html     # Interface principale
│   ├── css/
│   │   └── styles.css # Thème professionnel
│   └── js/
│       └── renderer.js # Logique frontend
└── assets/            # Icônes et ressources
```

## Données

Les données sont stockées localement dans :
- **Windows** : `%APPDATA%/isb-bibliotheque-numerique/isb-data/`
- Les fichiers uploadés (livres, vidéos) sont copiés dans ce dossier

---

## Technologies

- **Electron** - Application de bureau cross-platform
- **SQL.js** - Base de données SQLite embarquée (pur JavaScript)
- **bcryptjs** - Hashage sécurisé des mots de passe
- **UUID** - Identifiants uniques
