# 🏠 Système de Gestion des Dortoirs Multi-Fermes

Un système moderne et complet de gestion des dortoirs pour plusieurs fermes avec authentification Firebase et contrôle d'accès basé sur les rôles.

## 🚀 Fonctionnalités

### 🔐 **Authentification & Rôles**
- **Superadmin**: Accès complet à toutes les fermes et fonctionnalités
- **Admin**: Accès limité à leur ferme assignée
- **User**: Accès en lecture seule (configurable)
- Authentification Firebase avec documents Firestore

### 📊 **Tableau de Bord**
- Vue d'ensemble adaptée au rôle de l'utilisateur
- Statistiques en temps réel (ouvriers, chambres, occupation)
- Répartition par genre et analytics
- Cartes de fermes pour les superadmins

### 🏢 **Gestion des Fermes** (Superadmin seulement)
- CRUD complet des fermes
- **Création automatique des chambres** lors de la création d'une ferme
- Configuration séparée pour chambres hommes/femmes
- Numérotation automatique des chambres (ex: 101-110 pour hommes, 201-210 pour femmes)
- Définition de la capacité par type de chambre
- Informations détaillées (nom, adresse, capacité)
- Statistiques par ferme
- Interface de recherche et filtrage

### 👥 **Gestion des Ouvriers**
- Ajout, modification, suppression d'ouvriers
- Informations complètes (nom, CIN, téléphone, âge, etc.)
- Assignation aux chambres et dortoirs
- Filtrage par ferme, genre, statut
- Export des données

### 🛏️ **Gestion des Chambres**
- Gestion des chambres par ferme
- Suivi de l'occupation en temps réel
- Assignation par genre (hommes/femmes)
- Visualisation de la capacité et disponibilité

### 📈 **Statistiques Avancées**
- Analytics détaillées avec graphiques
- Répartition par âge et genre
- Taux d'occupation par ferme
- Tendances et insights automatiques
- Filtres temporels et par ferme

### ⚙️ **Outils d'Administration**
- Création d'utilisateurs avec rôles
- Assignation des fermes aux admins
- Interface de configuration système

## 🛠️ Stack Technique

### **Frontend**
- **React 18** avec TypeScript
- **Tailwind CSS** pour le styling
- **shadcn/ui** pour les composants
- **React Router 6** pour la navigation
- **Lucide React** pour les icônes

### **Backend & Base de Données**
- **Firebase Authentication** pour l'auth
- **Cloud Firestore** pour la base de données
- **React Hooks** personnalisés pour Firestore

### **Outils de Développement**
- **Vite** pour le build
- **TypeScript** pour la sécurité de type
- **ESLint** & **Prettier** pour la qualité du code

## 🗄️ Structure de la Base de Données

### Collection `users`
```json
{
  "uid": "firebase-auth-uid",
  "email": "admin@ferme01.com",
  "role": "admin", // "user", "admin", "superadmin"
  "fermeId": "ferme01", // pour les admins
  "nom": "Yassine Benali",
  "telephone": "0612345678"
}
```

### Collection `fermes`
```json
{
  "id": "ferme01",
  "nom": "Ferme Atlas 01",
  "totalChambres": 30,
  "totalOuvriers": 120,
  "admins": ["uid1", "uid2"]
}
```

### Collection `workers`
```json
{
  "nom": "Khalid Amrani",
  "cin": "AA998877",
  "fermeId": "ferme01",
  "telephone": "0612345678",
  "sexe": "homme",
  "age": 27,
  "chambre": "101",
  "dortoir": "Bloc A",
  "dateEntree": "2024-07-15",
  "statut": "actif"
}
```

### Collection `rooms`
```json
{
  "numero": "101",
  "fermeId": "ferme01",
  "genre": "hommes",
  "capaciteTotale": 4,
  "occupantsActuels": 3,
  "listeOccupants": ["AA998877", "BB123456"]
}
```

## 🚀 Installation & Configuration

### 1. **Installation des dépendances**
```bash
npm install
```

### 2. **Configuration Firebase**
Le projet est déjà configuré avec Firebase (`timdouin25`). Les configurations sont dans `client/lib/firebase.ts`.

### 3. **Création des utilisateurs initiaux**
Référez-vous au fichier `setup-firebase-users.md` pour:
- Créer les utilisateurs dans Firebase Authentication
- Ajouter les documents utilisateurs dans Firestore
- Configurer les données d'exemple

### 4. **Lancement en développement**
```bash
npm run dev
```

### 5. **Build pour la production**
```bash
npm run build
npm run start
```

## 📱 Pages de l'Application

| Page | URL | Accès | Description |
|------|-----|-------|-------------|
| **Tableau de bord** | `/` | Tous | Vue d'ensemble adaptée au rôle |
| **Fermes** | `/fermes` | Superadmin | Gestion complète des fermes |
| **Ouvriers** | `/ouvriers` | Admin+ | Gestion des ouvriers |
| **Chambres** | `/chambres` | Admin+ | Gestion des chambres |
| **Statistiques** | `/statistiques` | Tous | Analytics et rapports |
| **Administration** | `/admin` | Superadmin | Outils d'admin système |

## 🔒 Sécurité & Permissions

### **Règles Firestore**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    match /fermes/{fermeId} {
      allow read: if isAuthenticated();
      allow write: if isSuperAdmin();
    }
    match /workers/{workerId} {
      allow read, write: if isSuperAdmin() || isAdminOfFerme(resource.data.fermeId);
    }
    match /rooms/{roomId} {
      allow read, write: if isSuperAdmin() || isAdminOfFerme(resource.data.fermeId);
    }
  }
}
```

### **Contrôle d'Accès Frontend**
- Redirection automatique basée sur les rôles
- Masquage des fonctionnalités non autorisées
- Validation côté client et serveur

## 🎨 Interface Utilisateur

### **Design System**
- **Couleurs**: Palette bleue moderne avec gradients
- **Typography**: Police système optimisée
- **Composants**: shadcn/ui pour la cohérence
- **Responsive**: Mobile-first design

### **Expérience Utilisateur**
- Navigation intuitive avec menu adaptatif
- Feedback visuel en temps réel
- Messages d'erreur informatifs
- Chargement progressif des données

## 📊 Métriques & Analytics

### **Statistiques Disponibles**
- Nombre total d'ouvriers par ferme
- Taux d'occupation des chambres
- Répartition par genre et âge
- Tendances d'occupation
- Nouveaux arrivants par période

### **Exports & Rapports**
- Export des données en format CSV
- Filtres avancés par date, ferme, statut
- Rapports personnalisables

## ✨ Fonctionnalité Avancée: Création Automatique des Chambres

### **Configuration lors de la création d'une ferme**
Lorsque vous créez une nouvelle ferme, vous pouvez activer la création automatique des chambres avec:

#### **Options de Configuration**
- **Chambres Hommes**: Nombre, capacité par chambre, numéro de départ
- **Chambres Femmes**: Nombre, capacité par chambre, numéro de départ
- **Aperçu en temps réel**: Total des chambres et capacité calculés automatiquement

#### **Exemple de Configuration**
- **Hommes**: 10 chambres, 4 places chacune, numérotées 101-110
- **Femmes**: 10 chambres, 4 places chacune, numérotées 201-210
- **Résultat**: 20 chambres total, 80 places disponibles

#### **Avantages**
- ✅ Gain de temps: Plus besoin de créer chaque chambre individuellement
- ✅ Cohérence: Numérotation logique et structurée
- ✅ Séparation automatique par genre
- ✅ Calcul automatique des capacités totales

## 🔧 Développement

### **Structure du Projet**
```
client/
├── components/         # Composants réutilisables
│   ├── ui/            # Composants shadcn/ui
│   └── ...
├── contexts/          # Contexts React (Auth, etc.)
├── hooks/             # Hooks personnalisés
├── lib/               # Utilitaires et config
├── pages/             # Pages de l'application
└── ...

server/                # Backend Express (optionnel)
shared/                # Types partagés
```

### **Hooks Personnalisés**
- `useAuth()`: Gestion de l'authentification
- `useFirestore()`: Interface Firestore générique
- `useFirestoreDoc()`: Document Firestore spécifique

### **Composants Clés**
- `Layout`: Layout principal avec navigation
- `StatsCard`: Cartes de statistiques
- `FermeCard`: Cartes de fermes
- `UserSetupDialog`: Configuration utilisateur

## 🚀 Déploiement

### **Production avec Netlify**
Le projet est configuré pour un déploiement automatique sur Netlify:

```bash
# Build de production
npm run build

# Les fichiers sont dans dist/spa/
```

### **Variables d'Environnement**
Firebase est configuré directement dans le code. Pour la production, considérez l'utilisation de variables d'environnement.

## 🤝 Contribution

1. Fork le projet
2. Créez une branche feature (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Commit vos changements (`git commit -am 'Ajout nouvelle fonctionnalité'`)
4. Push vers la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. Créez une Pull Request

## 📝 License

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 📞 Support

Pour toute question ou problème:
- Consultez la documentation dans `/setup-firebase-users.md`
- Créez une issue sur GitHub
- Contactez l'équipe de développement

---

**🏆 Système de Gestion des Dortoirs Multi-Fermes** - Une solution moderne et complète pour la gestion des logements ouvriers.
