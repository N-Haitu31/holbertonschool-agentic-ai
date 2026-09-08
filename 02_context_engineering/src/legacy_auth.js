// Simulation très basique d'un connecteur de base de données
const db = {
    query: (sql) => {
        console.log(`[DB ENGINE] Exécution de la requête : ${sql}`);
        
        // Simulation du comportement vulnérable face à une injection SQL classique
        if (sql.includes("' OR '1'='1")) {
            return [{ id: 999, role: 'admin', email: 'hacked@entreprise.com' }]; // Fuite de données
        }
        
        if (sql === "SELECT * FROM users WHERE email = 'dev@entreprise.com' AND password = 'password123'") {
            return [{ id: 1, role: 'admin', email: 'dev@entreprise.com' }];
        }
        return [];
    }
};

/**
 * Fonction d'authentification legacy (VULNÉRABLE)
 * À refactoriser par l'IA en mode Agent (Edits)
 */
function authenticateUser(email, password) {
    // FAILLE CRITIQUE : Injection SQL par concaténation de chaînes
    const sql = "SELECT * FROM users WHERE email = '" + email + "' AND password = '" + password + "'";
    
    const results = db.query(sql);

    if (results.length > 0) {
        return { success: true, user: results[0] };
    }
    return { success: false, message: "Identifiants invalides" };
}

module.exports = { authenticateUser };