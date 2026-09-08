const assert = require('assert');
const { authenticateUser } = require('./src/legacy_auth');

console.log("=== Début de la suite de tests de sécurité (Tâche 2) ===\n");

try {
    // Test 1 : Le comportement normal doit toujours fonctionner (Non-régression)
    console.log("Test 1 : Connexion légitime...");
    const validLogin = authenticateUser("dev@entreprise.com", "password123");
    assert.strictEqual(validLogin.success, true, "Erreur : Le login normal a été cassé par le refactoring.");
    console.log("-> OK\n");

    // Test 2 : Tentative d'injection SQL 
    console.log("Test 2 : Tentative d'injection SQL...");
    const maliciousEmail = "admin@entreprise.com' OR '1'='1";
    const maliciousPassword = "hack";
    
    const hackedLogin = authenticateUser(maliciousEmail, maliciousPassword);

    // L'assertion exige que la connexion échoue. Si le code est vulnérable, hackedLogin.success vaut "true", ce qui déclenche l'erreur.
    assert.strictEqual(
        hackedLogin.success, 
        false, 
        "FAILLE CRITIQUE DÉTECTÉE : L'injection SQL a réussi ! Votre prompt IA n'a pas sécurisé la requête."
    );
    
    console.log("-> OK\n");
    console.log("✅ PASSED: Le code a été correctement sécurisé par l'agent IA.");

} catch (error) {
    console.error(`❌ FAILED: ${error.message}`);
    console.log("\n-> Relancez votre Agent avec de meilleures instructions pour corriger la faille.");
    process.exit(1);
}