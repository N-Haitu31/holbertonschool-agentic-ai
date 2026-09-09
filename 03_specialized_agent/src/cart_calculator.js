/**
 * Calcule le total d'un panier e-commerce avec gestion des taxes et réductions.
 * @param {Array} items - Liste des articles [{ price: 10, quantity: 2 }]
 * @param {Number} taxRate - Taux de taxe (ex: 0.20 pour 20%)
 * @param {Number} discount - Réduction fixe en euros
 * @returns {Number} Total TTC arrondi à 2 décimales
 */
function calculateTotal(items, taxRate = 0.20, discount = 0) {
    if (!Array.isArray(items) || items.length === 0) {
        return 0;
    }

    // Sous-total HT
    let subTotal = items.reduce((total, item) => {
        const itemPrice = Math.max(0, item.price || 0);
        const itemQty = Math.max(0, item.quantity || 1);
        return total + (itemPrice * itemQty);
    }, 0);

    // Application réduction et taxes
    subTotal = Math.max(0, subTotal - discount);
    const totalTTC = subTotal * (1 + taxRate);

    return Math.round(totalTTC * 100) / 100;
}

module.exports = { calculateTotal };