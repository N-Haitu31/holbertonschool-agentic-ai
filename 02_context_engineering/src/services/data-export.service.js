const userRepository = require('../repositories/user.repository');

class DataExportService {
    async exportUserData(email) {
        const user = userRepository.findByEmail(email);
        if (!user) {
            throw new Error("Utilisateur introuvable dans le système");
        }
        return user;
    }
}

module.exports = new DataExportService();
