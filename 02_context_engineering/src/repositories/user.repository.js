class UserRepository {
    constructor() {
        // Simulation d'une base de données en mémoire
        this.db = new Map();
        this.db.set('dev@entreprise.com', { id: 1, name: 'Dev', role: 'admin' });
    }

    /**
     * Recherche un utilisateur par son email
     * @param {string} email 
     * @returns {Object|null}
     */
    findByEmail(email) {
        return this.db.get(email) || null;
    }
}

module.exports = new UserRepository();